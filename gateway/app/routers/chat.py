"""POST /chat - the streaming heart of the gateway.

Request flow: rate limit -> semantic cache lookup -> RAG retrieval -> lane
selection -> streamed completion through the LiteLLM proxy, with TTFT,
tokens/sec, cost and cache metrics recorded along the way.
"""

from __future__ import annotations

import json
import time

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from ..config import get_settings
from ..models import ChatRequest
from ..services import cache, db, llm, routing, store, tracing

router = APIRouter()

SYSTEM_TEMPLATE = (
    "You are a precise technical assistant. Answer using the retrieved "
    "context when it is relevant; say when it is not.\n\n"
    "Retrieved context:\n{context}"
)
SYSTEM_PLAIN = "You are a precise technical assistant."


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def _retrieve(prompt: str) -> list[dict]:
    settings = get_settings()
    try:
        [vec] = await llm.embed([prompt])
        return await db.search(vec, settings.rag_top_k)
    except Exception:
        # retrieval is an enhancement, never a hard dependency of answering
        return []


@router.post("/chat")
async def chat(req: ChatRequest, request: Request):
    settings = get_settings()
    prompt = next((m.content for m in reversed(req.messages) if m.role == "user"), "")
    if not prompt:
        raise HTTPException(status_code=422, detail="no user message supplied")

    client_ip = request.client.host if request.client else "unknown"
    if not await store.check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="rate limit exceeded")

    cached = None
    if req.use_cache:
        try:
            cached = await cache.lookup(prompt)
        except Exception:
            # cache is an optimisation, never a hard dependency of answering
            cached = None
    if cached is not None:
        async def replay():
            started = time.perf_counter()
            await store.incr_metric("cache_hits", 1, req.conversation_id)
            yield _sse("meta", {"cached": True, "lane": "cache", "model": cached["model"],
                                "similarity": round(cached["similarity"], 4)})
            for tok in cached["response"].split(" "):
                yield _sse("token", {"token": tok + " "})
            await store.log_request({
                "ts": time.time(), "conversation_id": req.conversation_id,
                "prompt": prompt[:120], "lane": "cache", "model": cached["model"],
                "cached": True, "similarity": round(cached["similarity"], 4),
                "status": "ok", "ttft_ms": 0.0,
                "elapsed_s": round(time.perf_counter() - started, 3),
                "tokens_in": 0, "tokens_out": 0, "tokens_per_sec": 0.0, "cost_usd": 0.0,
            })
            yield _sse("done", {"cost_usd": 0.0, "tokens_out": 0, "ttft_ms": 0.0})
        return StreamingResponse(replay(), media_type="text/event-stream")

    await store.incr_metric("cache_misses", 1, req.conversation_id)
    contexts = await _retrieve(prompt) if req.use_rag else []
    ctx_text = "\n\n".join(h["content"] for h in contexts)
    ctx_tokens = sum(len(h["content"].split()) for h in contexts)

    if req.force_lane:
        lane, reason = req.force_lane, "forced by caller"
    else:
        lane, reason = routing.choose_lane(prompt, ctx_tokens)
    model_alias = settings.lane_local_alias if lane == "local" else settings.lane_cloud_alias

    messages = [
        {"role": "system", "content": SYSTEM_TEMPLATE.format(context=ctx_text) if ctx_text else SYSTEM_PLAIN},
        *[{"role": m.role, "content": m.content} for m in req.messages],
    ]

    async def stream():
        started = time.perf_counter()
        first_token_at: float | None = None
        collected: list[str] = []
        usage: dict = {}

        with tracing.trace("chat", {"lane": lane, "conversation_id": req.conversation_id}) as span:
            yield _sse("meta", {
                "cached": False, "lane": lane, "model": model_alias, "route_reason": reason,
                "contexts": [{"doc_id": h["doc_id"], "score": round(h["score"], 4)} for h in contexts],
            })
            async for event in llm.stream_chat(messages, model_alias):
                if "error" in event:
                    await store.log_request({
                        "ts": time.time(), "conversation_id": req.conversation_id,
                        "prompt": prompt[:120], "lane": lane, "model": model_alias,
                        "cached": False, "status": "error",
                        "error": event["error"][:200],
                        "elapsed_s": round(time.perf_counter() - started, 3),
                        "tokens_in": 0, "tokens_out": 0, "tokens_per_sec": 0.0,
                        "cost_usd": 0.0,
                    })
                    yield _sse("error", {"message": event["error"]})
                    return
                if "usage" in event:
                    usage = event["usage"]
                    continue
                if first_token_at is None:
                    first_token_at = time.perf_counter()
                    ttft_ms = (first_token_at - started) * 1000
                    await store.record_latency("ttft", ttft_ms, req.conversation_id)
                collected.append(event["token"])
                yield _sse("token", {"token": event["token"]})

            elapsed_s = time.perf_counter() - started
            text = "".join(collected)
            tokens_in = int(usage.get("prompt_tokens", 0))
            tokens_out = int(usage.get("completion_tokens", 0))
            cost = 0.0
            if lane == "cloud":
                cost = (tokens_in * settings.cloud_input_cost_per_mtok
                        + tokens_out * settings.cloud_output_cost_per_mtok) / 1_000_000
            tps = tokens_out / elapsed_s if elapsed_s else 0.0

            await store.record_latency("generation", elapsed_s * 1000, req.conversation_id)
            await store.log_request({
                "ts": time.time(), "conversation_id": req.conversation_id,
                "prompt": prompt[:120], "lane": lane, "model": model_alias,
                "cached": False, "status": "ok",
                "ttft_ms": round((first_token_at - started) * 1000, 1) if first_token_at else None,
                "elapsed_s": round(elapsed_s, 2),
                "tokens_in": tokens_in, "tokens_out": tokens_out,
                "tokens_per_sec": round(tps, 2), "cost_usd": round(cost, 6),
                "contexts_used": len(contexts),
            })
            await store.incr_metric("requests", 1, req.conversation_id)
            await store.incr_metric(f"lane_{lane}", 1, req.conversation_id)
            await store.incr_metric("tokens_in", tokens_in, req.conversation_id)
            await store.incr_metric("tokens_out", tokens_out, req.conversation_id)
            await store.incr_metric("cost_usd", cost, req.conversation_id)

            if req.use_cache and text:
                try:
                    await cache.save(prompt, text, model_alias)
                except Exception:
                    pass  # a failed cache write must not kill a good answer
            span.update(output=text[:500], metadata={"cost_usd": cost, "ttft_ms": (
                (first_token_at - started) * 1000 if first_token_at else None)})

            yield _sse("done", {
                "cost_usd": round(cost, 6),
                "tokens_in": tokens_in, "tokens_out": tokens_out,
                "tokens_per_sec": round(tps, 2),
                "ttft_ms": round((first_token_at - started) * 1000, 1) if first_token_at else None,
                "elapsed_s": round(elapsed_s, 2),
            })

    return StreamingResponse(stream(), media_type="text/event-stream")

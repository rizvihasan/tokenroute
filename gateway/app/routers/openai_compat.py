"""OpenAI-compatible surface: POST /v1/chat/completions.

The drop-in replacement promise: point any OpenAI SDK at the gateway and it
works. This route runs the same pipeline as /chat (cache, RAG, lane router,
metering) and speaks the OpenAI wire format - both streamed and not.

Model names are the lane aliases: "chat-local" (cheap lane), "chat-cloud"
(strong lane), or "auto" (let the heuristic choose, the default).
"""

from __future__ import annotations

import json
import time
import uuid

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from ..config import get_settings
from ..models import ChatMessage, ChatRequest
from ..services import cache, db, llm, routing, store, tenancy

router = APIRouter()

SYSTEM_PLAIN = "You are a precise technical assistant."
SYSTEM_TEMPLATE = (
    "You are a precise technical assistant. Answer using the retrieved "
    "context when it is relevant; say when it is not.\n\n"
    "Retrieved context:\n{context}"
)


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


def _chunk(cid: str, model: str, delta: dict, finish: str | None = None) -> dict:
    return {
        "id": cid, "object": "chat.completion.chunk", "created": int(time.time()),
        "model": model,
        "choices": [{"index": 0, "delta": delta, "finish_reason": finish}],
    }


async def _authenticate(request: Request):
    """Tenancy gate. Returns (TenantContext | None, error response | None)."""
    if not get_settings().tenancy_enabled:
        return None, None
    auth = request.headers.get("authorization", "")
    raw = auth[7:] if auth.lower().startswith("bearer ") else ""
    if not raw:
        return None, JSONResponse(status_code=401, content={
            "error": {"message": "missing API key", "type": "auth_error"}})
    ctx = await tenancy.resolve(raw)
    if ctx is None:
        return None, JSONResponse(status_code=401, content={
            "error": {"message": "invalid or revoked API key", "type": "auth_error"}})
    if await tenancy.budget_exceeded(ctx):
        return None, JSONResponse(status_code=402, content={
            "error": {"message": "monthly budget cap reached", "type": "budget_exceeded"}})
    return ctx, None


async def _run_pipeline(req: ChatRequest):
    """Shared cache/RAG/lane prep. Returns (messages, lane, model_alias, cached)."""
    settings = get_settings()
    prompt = next((m.content for m in reversed(req.messages) if m.role == "user"), "")

    if req.use_cache and prompt:
        try:
            hit = await cache.lookup(prompt)
        except Exception:
            hit = None
        if hit is not None:
            return None, "cache", hit["model"], hit

    contexts: list[dict] = []
    if req.use_rag and prompt:
        try:
            [vec] = await llm.embed([prompt])
            contexts = await db.search(vec, settings.rag_top_k)
        except Exception:
            contexts = []
    ctx_text = "\n\n".join(h["content"] for h in contexts)
    ctx_tokens = sum(len(h["content"].split()) for h in contexts)

    if req.force_lane:
        lane, _reason = req.force_lane, "forced"
    else:
        lane, _reason = routing.choose_lane(prompt, ctx_tokens)
    model_alias = settings.lane_local_alias if lane == "local" else settings.lane_cloud_alias

    system = SYSTEM_TEMPLATE.format(context=ctx_text) if ctx_text else SYSTEM_PLAIN
    messages = [{"role": "system", "content": system}]
    messages += [{"role": m.role, "content": m.content} for m in req.messages
                 if m.role != "system"]
    return messages, lane, model_alias, None


@router.post("/v1/chat/completions")
async def chat_completions(payload: dict, request: Request):
    settings = get_settings()
    raw_messages = payload.get("messages") or []
    if not raw_messages:
        return JSONResponse(status_code=400, content={"error": {"message": "messages required"}})
    stream = bool(payload.get("stream"))
    model_req = str(payload.get("model") or "auto")
    force = None
    if model_req == settings.lane_local_alias:
        force = "local"
    elif model_req == settings.lane_cloud_alias:
        force = "cloud"
    # explicit provider routing: "openai:gpt-4o-mini", "anthropic:claude-...", ...
    explicit_model = model_req if llm.provider_target(model_req) is not None else None

    ctx, err = await _authenticate(request)
    if err is not None:
        return err
    keys = ctx.provider_keys if ctx else None

    client_ip = ctx.key_id if ctx else (request.client.host if request.client else "unknown")
    if not await store.check_rate_limit(client_ip):
        return JSONResponse(status_code=429, content={"error": {"message": "rate limit exceeded"}})

    req = ChatRequest(
        conversation_id=f"v1-{client_ip}",
        messages=[ChatMessage(role=m["role"], content=m["content"]) for m in raw_messages
                  if m.get("role") in ("system", "user", "assistant")],
        force_lane=force,  # type: ignore[arg-type]
    )
    prompt = next((m.content for m in reversed(req.messages) if m.role == "user"), "")
    messages, lane, model_alias, cached = await _run_pipeline(req)
    if explicit_model is not None:
        model_alias = explicit_model
    cid = f"chatcmpl-{uuid.uuid4().hex[:24]}"

    async def gen_sse():
        started = time.perf_counter()
        if cached is not None:
            for tok in cached["response"].split(" "):
                yield _sse(_chunk(cid, cached["model"], {"content": tok + " "}))
            yield _sse(_chunk(cid, cached["model"], {}, "stop"))
            yield "data: [DONE]\n\n"
            return
        collected: list[str] = []
        usage: dict = {}
        error: str | None = None
        async for event in llm.stream_chat(messages, model_alias, keys):
            if "error" in event:
                error = event["error"]
                break
            if "usage" in event:
                usage = event["usage"]
                continue
            collected.append(event["token"])
            yield _sse(_chunk(cid, model_alias, {"content": event["token"]}))
        if error is not None:
            yield _sse({"error": {"message": error, "type": "upstream_error"}})
            yield "data: [DONE]\n\n"
            return
        final = _chunk(cid, model_alias, {}, "stop")
        if usage:
            final["usage"] = {
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
                "total_tokens": usage.get("total_tokens", 0),
            }
        yield _sse(final)
        yield "data: [DONE]\n\n"
        text = "".join(collected)
        tokens_in = int(usage.get("prompt_tokens", 0))
        tokens_out = int(usage.get("completion_tokens", 0))
        cost = 0.0
        if lane == "cloud":
            cost = (tokens_in * settings.cloud_input_cost_per_mtok
                    + tokens_out * settings.cloud_output_cost_per_mtok) / 1_000_000
        await store.log_request({
            "ts": time.time(), "conversation_id": req.conversation_id,
            "prompt": prompt[:120], "lane": lane, "model": model_alias,
            "cached": False, "status": "ok", "ttft_ms": None,
            "elapsed_s": round(time.perf_counter() - started, 2),
            "tokens_in": tokens_in, "tokens_out": tokens_out,
            "tokens_per_sec": 0.0, "cost_usd": round(cost, 6),
        })
        if ctx is not None:
            await store.record_spend(ctx.key_id, cost)
        if text:
            try:
                await cache.save(prompt, text, model_alias)
            except Exception:
                pass

    if stream:
        return StreamingResponse(gen_sse(), media_type="text/event-stream")

    # non-streaming: collect the pipeline result into one JSON body
    if cached is not None:
        return JSONResponse({
            "id": cid, "object": "chat.completion", "created": int(time.time()),
            "model": cached["model"],
            "choices": [{"index": 0, "finish_reason": "stop",
                         "message": {"role": "assistant", "content": cached["response"]}}],
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
        })
    collected: list[str] = []
    usage = {}
    async for event in llm.stream_chat(messages, model_alias, keys):
        if "error" in event:
            return JSONResponse(status_code=502,
                                content={"error": {"message": event["error"], "type": "upstream_error"}})
        if "usage" in event:
            usage = event["usage"]
            continue
        collected.append(event["token"])
    text = "".join(collected)
    if text:
        try:
            await cache.save(prompt, text, model_alias)
        except Exception:
            pass
    return JSONResponse({
        "id": cid, "object": "chat.completion", "created": int(time.time()),
        "model": model_alias,
        "choices": [{"index": 0, "finish_reason": "stop",
                     "message": {"role": "assistant", "content": text}}],
        "usage": {
            "prompt_tokens": int(usage.get("prompt_tokens", 0)),
            "completion_tokens": int(usage.get("completion_tokens", 0)),
            "total_tokens": int(usage.get("total_tokens", 0)),
        },
    })

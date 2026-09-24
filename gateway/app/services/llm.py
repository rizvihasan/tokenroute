"""Async client for the LiteLLM proxy (OpenAI-compatible)."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator

import httpx

from ..config import get_settings


def _headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {get_settings().litellm_master_key}"}


async def embed(texts: list[str]) -> list[list[float]]:
    settings = get_settings()
    async with httpx.AsyncClient(base_url=settings.litellm_base_url, timeout=120) as client:
        resp = await client.post(
            "/v1/embeddings",
            headers=_headers(),
            json={"model": settings.embed_alias, "input": texts},
        )
        resp.raise_for_status()
        data = resp.json()
    return [row["embedding"] for row in sorted(data["data"], key=lambda d: d["index"])]


async def stream_chat(
    messages: list[dict], model_alias: str
) -> AsyncIterator[dict]:
    """Yield parsed SSE events: {'token': str} or {'usage': {...}} or {'error': ...}."""
    settings = get_settings()
    payload = {
        "model": model_alias,
        "messages": messages,
        "stream": True,
        "stream_options": {"include_usage": True},
    }
    async with httpx.AsyncClient(base_url=settings.litellm_base_url, timeout=180) as client:
        async with client.stream(
            "POST", "/v1/chat/completions", headers=_headers(), json=payload
        ) as resp:
            if resp.status_code != 200:
                body = await resp.aread()
                yield {"error": f"upstream {resp.status_code}: {body.decode(errors='replace')[:400]}"}
                return
            async for line in resp.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data = line[len("data:"):].strip()
                if data == "[DONE]":
                    return
                try:
                    event = json.loads(data)
                except json.JSONDecodeError:
                    continue
                choices = event.get("choices") or []
                if choices:
                    delta = choices[0].get("delta") or {}
                    token = delta.get("content")
                    if token:
                        yield {"token": token}
                if event.get("usage"):
                    yield {"usage": event["usage"]}


async def complete_chat(messages: list[dict], model_alias: str) -> dict:
    """Non-streaming completion, used by the eval runner."""
    settings = get_settings()
    async with httpx.AsyncClient(base_url=settings.litellm_base_url, timeout=180) as client:
        resp = await client.post(
            "/v1/chat/completions",
            headers=_headers(),
            json={"model": model_alias, "messages": messages},
        )
        resp.raise_for_status()
        return resp.json()

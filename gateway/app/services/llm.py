"""Async client for the model providers, all OpenAI-compatible.

The deployed stack talks directly to Groq (chat) and Jina (embeddings).
There is no proxy container in the middle: the official LiteLLM image needs
~4Gi per worker and would not stay up on a 512MB free-tier instance, so the
routing it did (alias -> provider model, one fallback hop) lives here now.
Local docker-compose still runs LiteLLM for the Ollama path; point the
CHAT_* / EMBED_* env vars at it and the same code works unchanged.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator

import httpx

from ..config import get_settings

# OpenAI-compatible provider presets for explicit "provider:model" requests.
# Groq is the platform default (lanes); the rest light up when the matching
# *_API_KEY env is set, or when a tenant supplies one via BYOK.
PROVIDERS: dict[str, tuple[str, str]] = {
    "groq": ("https://api.groq.com/openai/v1", "groq_api_key"),
    "openai": ("https://api.openai.com/v1", "openai_api_key"),
    "anthropic": ("https://api.anthropic.com/v1", "anthropic_api_key"),
    "gemini": ("https://generativelanguage.googleapis.com/v1beta/openai", "gemini_api_key"),
}


def provider_target(target: str, keys: dict | None = None) -> tuple[str, str, str] | None:
    """Resolve an explicit "provider:model" request to (base_url, api_key,
    model). Returns None when target is a lane alias, not a provider target.
    A tenant BYOK key for the provider wins over the platform env key."""
    provider, sep, model = target.partition(":")
    if not sep or provider not in PROVIDERS or not model:
        return None
    base, key_attr = PROVIDERS[provider]
    key = (keys or {}).get(provider) or getattr(get_settings(), key_attr)
    return (base, key, model)


def _chat_provider(alias: str, keys: dict | None = None) -> tuple[str, str, str]:
    """Resolve a lane alias to (base_url, api_key, provider model).

    keys: a tenant's BYOK provider keys (provider name -> plaintext). A tenant
    key for the configured chat provider wins over the platform's env key -
    that is the BYOK path; without one, the platform key serves the request.
    """
    explicit = provider_target(alias, keys)
    if explicit is not None:
        return explicit
    s = get_settings()
    tenant_key = (keys or {}).get(s.chat_provider)
    if alias == s.lane_cloud_alias:
        return (s.chat_cloud_base_url, tenant_key or s.chat_cloud_api_key or s.groq_api_key,
                s.chat_cloud_model)
    return (s.chat_local_base_url, tenant_key or s.chat_local_api_key or s.groq_api_key,
            s.chat_local_model)


async def embed(texts: list[str], keys: dict | None = None) -> list[list[float]]:
    s = get_settings()
    payload: dict = {"model": s.embed_model, "input": texts}
    if s.embed_dimensions:
        payload["dimensions"] = s.embed_dimensions
    async with httpx.AsyncClient(base_url=s.embed_base_url, timeout=120) as client:
        resp = await client.post(
            "/embeddings",
            headers={"Authorization": f"Bearer {(keys or {}).get(s.embed_provider) or s.embed_api_key or s.jina_api_key}"},
            json=payload,
        )
        if resp.status_code == 422 and "dimensions" in payload:
            # provider without Matryoshka support: retry at native size
            payload.pop("dimensions")
            resp = await client.post(
                "/embeddings",
                headers={"Authorization": f"Bearer {(keys or {}).get(s.embed_provider) or s.embed_api_key or s.jina_api_key}"},
                json=payload,
            )
        resp.raise_for_status()
        data = resp.json()
    return [row["embedding"] for row in sorted(data["data"], key=lambda d: d["index"])]


async def _stream_once(
    messages: list[dict], alias: str, keys: dict | None = None
) -> AsyncIterator[dict]:
    """Stream one attempt against the alias's provider. Raises httpx.HTTPError
    on transport failure; yields {'error'} on a non-200 before any token."""
    base, key, model = _chat_provider(alias, keys)
    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "stream_options": {"include_usage": True},
    }
    async with httpx.AsyncClient(base_url=base, timeout=180) as client:
        async with client.stream(
            "POST",
            "/chat/completions",
            headers={"Authorization": f"Bearer {key}"},
            json=payload,
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


async def stream_chat(messages: list[dict], model_alias: str, keys: dict | None = None) -> AsyncIterator[dict]:
    """Yield {'token'} / {'usage'} / {'error'} events.

    Fallback (previously LiteLLM's router_settings.fallbacks): if the chosen
    lane fails before producing any token - non-200 or unreachable - retry
    once against the other lane. Mid-stream failures cannot fall back: the
    client already has partial output, so we surface the error instead.
    """
    s = get_settings()
    aliases = [model_alias]
    if provider_target(model_alias) is not None:
        pass  # explicit provider target: no cross-lane fallback
    elif model_alias == s.lane_local_alias:
        aliases.append(s.lane_cloud_alias)
    elif model_alias == s.lane_cloud_alias:
        aliases.append(s.lane_local_alias)

    last_error = "no provider attempted"
    for alias in aliases:
        yielded_token = False
        try:
            async for event in _stream_once(messages, alias, keys):
                if "error" in event and not yielded_token:
                    last_error = event["error"]
                    break  # clean pre-token refusal: try the fallback lane
                if "token" in event:
                    yielded_token = True
                yield event
            else:
                return  # stream completed
            continue
        except httpx.HTTPError as exc:
            if yielded_token:
                yield {"error": f"stream interrupted: {exc.__class__.__name__}"}
                return
            last_error = f"upstream unreachable: {exc.__class__.__name__}"
            continue
    yield {"error": last_error}


async def complete_chat(messages: list[dict], model_alias: str, keys: dict | None = None) -> dict:
    """Non-streaming completion, used by the eval runner."""
    base, key, model = _chat_provider(model_alias, keys)
    async with httpx.AsyncClient(base_url=base, timeout=180) as client:
        resp = await client.post(
            "/chat/completions",
            headers={"Authorization": f"Bearer {key}"},
            json={"model": model, "messages": messages},
        )
        resp.raise_for_status()
        return resp.json()

"""MCP server (JSON-RPC 2.0 over streamable HTTP, POST /mcp).

Exposes TokenRoute as tools any MCP client (Claude, Cursor, ...) can call:
  - tokenroute_chat:   run a chat completion through the gateway
                       (routing + cache + RAG + guardrails all apply)
  - tokenroute_usage:  this key's monthly spend vs its cap (metrics scope)

Auth: the same tenant Bearer keys as /v1 when tenancy is on; open when off.
No SDK dependency - the handshake is small enough to implement honestly.
"""

from __future__ import annotations

import time

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..config import get_settings
from ..services import guardrails, llm, routing, store, tenancy

router = APIRouter()

PROTOCOL_VERSION = "2025-06-18"

_TOOLS = [
    {
        "name": "tokenroute_chat",
        "description": "Send a prompt through the TokenRoute gateway (lane routing, semantic cache, RAG).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "prompt": {"type": "string", "description": "The user prompt"},
                "model": {"type": "string",
                          "description": "auto | chat-local | chat-cloud | provider:model (default auto)"},
            },
            "required": ["prompt"],
        },
    },
    {
        "name": "tokenroute_usage",
        "description": "This API key's monthly spend and remaining budget.",
        "inputSchema": {"type": "object", "properties": {}},
    },
]


async def _auth(request: Request):
    """Same tenancy gate as /v1. Returns (TenantContext|None, error|None)."""
    if not get_settings().tenancy_enabled:
        return None, None
    auth = request.headers.get("authorization", "")
    raw = auth[7:] if auth.lower().startswith("bearer ") else ""
    ctx = await tenancy.resolve(raw) if raw else None
    if ctx is None:
        return None, {"code": -32001, "message": "missing or invalid API key"}
    return ctx, None


def _result(rid, result):
    return JSONResponse({"jsonrpc": "2.0", "id": rid, "result": result})


def _error(rid, code: int, message: str):
    return JSONResponse({"jsonrpc": "2.0", "id": rid, "error": {"code": code, "message": message}})


def _text(text: str) -> dict:
    return {"content": [{"type": "text", "text": text}]}


@router.post("/mcp")
async def mcp(request: Request):
    try:
        body = await request.json()
    except Exception:
        return _error(None, -32700, "parse error")
    rid = body.get("id")
    method = body.get("method", "")

    if method == "initialize":
        return _result(rid, {
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": {"tools": {}},
            "serverInfo": {"name": "tokenroute", "version": "0.2.0"},
        })
    if method == "notifications/initialized" or method.startswith("notifications/"):
        return JSONResponse(status_code=202, content=None)
    if method == "ping":
        return _result(rid, {})

    ctx, err = await _auth(request)
    if err:
        return _error(rid, err["code"], err["message"])

    if method == "tools/list":
        tools = _TOOLS if (ctx is None or ctx.has_scope("metrics")) else _TOOLS[:1]
        return _result(rid, {"tools": tools})

    if method == "tools/call":
        params = body.get("params") or {}
        name = params.get("name", "")
        args = params.get("arguments") or {}
        settings = get_settings()

        if name == "tokenroute_chat":
            if ctx is not None and not ctx.has_scope("chat"):
                return _error(rid, -32003, "key lacks the chat scope")
            prompt = str(args.get("prompt") or "").strip()
            if not prompt:
                return _error(rid, -32602, "prompt is required")
            hit = guardrails.check_input(prompt) if guardrails.mode() != "off" else None
            if hit is not None and guardrails.mode() == "block":
                return _result(rid, {**_text(f"rejected by input guardrail ({hit.rule})"), "isError": True})
            model_req = str(args.get("model") or "auto")
            explicit = llm.provider_target(model_req)
            if explicit is not None:
                alias = model_req
            elif model_req == settings.lane_cloud_alias:
                alias = settings.lane_cloud_alias
            else:
                alias = settings.lane_local_alias if model_req == settings.lane_local_alias \
                    else (settings.lane_local_alias
                          if routing.choose_lane(prompt, 0)[0] == "local"
                          else settings.lane_cloud_alias)
            started = time.perf_counter()
            text_parts: list[str] = []
            error: str | None = None
            keys = ctx.provider_keys if ctx else None
            try:
                async for event in llm.stream_chat(
                        [{"role": "user", "content": prompt}], alias, keys):
                    if "error" in event:
                        error = event["error"]
                        break
                    if "token" in event:
                        text_parts.append(event["token"])
            except Exception as exc:
                error = f"{exc.__class__.__name__}"
            if error is not None:
                return _result(rid, {**_text(f"upstream error: {error}"), "isError": True})
            text = "".join(text_parts)
            if ctx is not None:
                await store.record_spend(ctx.key_id, 0.0)
            return _result(rid, _text(text))

        if name == "tokenroute_usage":
            if ctx is None:
                return _result(rid, _text("tenancy disabled: usage is unmetered"))
            if not ctx.has_scope("metrics"):
                return _error(rid, -32003, "key lacks the metrics scope")
            spent = await store.monthly_spend(ctx.key_id)
            remaining = (round(ctx.monthly_cap_usd - spent, 6)
                         if ctx.monthly_cap_usd is not None else None)
            return _result(rid, _text(
                f"month spend: ${spent:.6f}"
                + (f" | cap: ${ctx.monthly_cap_usd} | remaining: ${remaining}"
                   if ctx.monthly_cap_usd is not None else " | no cap")))

        return _error(rid, -32601, f"unknown tool: {name}")

    return _error(rid, -32601, f"method not found: {method}")


@router.get("/mcp")
async def mcp_get():
    # MCP streamable-HTTP servers may offer an SSE stream here; we don't.
    return JSONResponse(status_code=405,
                        content={"error": "POST JSON-RPC to this endpoint"})

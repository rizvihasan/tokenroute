"""MCP server: JSON-RPC handshake + tool dispatch + tenancy gate."""
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_initialize_handshake():
    resp = client.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "initialize",
                                     "params": {"protocolVersion": "2025-06-18",
                                                "capabilities": {}, "clientInfo": {"name": "t", "version": "0"}}})
    assert resp.status_code == 200
    body = resp.json()
    assert body["result"]["serverInfo"]["name"] == "tokenroute"
    assert body["result"]["protocolVersion"]


def test_tools_list_open_mode():
    with patch("app.routers.mcp.get_settings") as gs:
        gs.return_value = type("S", (), {"tenancy_enabled": False})()
        resp = client.post("/mcp", json={"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
    names = [t["name"] for t in resp.json()["result"]["tools"]]
    assert "tokenroute_chat" in names and "tokenroute_usage" in names


def test_tools_call_chat_open_mode(monkeypatch):
    async def fake_stream(*_a, **_kw):
        yield {"token": "pong"}

    monkeypatch.setattr("app.routers.mcp.llm.stream_chat", fake_stream)
    monkeypatch.setattr("app.routers.mcp.routing.choose_lane", lambda p, c: ("local", "test"))
    with patch("app.routers.mcp.get_settings") as gs:
        gs.return_value = type("S", (), {"tenancy_enabled": False, "lane_local_alias": "chat-local",
                                         "lane_cloud_alias": "chat-cloud", "guardrails_mode": "off"})()
        resp = client.post("/mcp", json={"jsonrpc": "2.0", "id": 3, "method": "tools/call",
                                         "params": {"name": "tokenroute_chat",
                                                    "arguments": {"prompt": "ping"}}})
    body = resp.json()["result"]
    assert body["content"][0]["text"] == "pong"


def test_unknown_method():
    resp = client.post("/mcp", json={"jsonrpc": "2.0", "id": 4, "method": "resources/list"})
    assert resp.json()["error"]["code"] == -32601

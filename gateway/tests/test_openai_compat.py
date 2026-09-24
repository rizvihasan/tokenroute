"""The OpenAI-compatible surface: drop-in SDK compatibility claims must hold."""
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _patch_pipeline(monkeypatch, events):
    async def fake_stream(messages, alias):
        for e in events:
            yield e

    monkeypatch.setattr("app.routers.openai_compat.llm.stream_chat", fake_stream)
    monkeypatch.setattr("app.routers.openai_compat.cache.lookup", AsyncMock(return_value=None))
    monkeypatch.setattr("app.routers.openai_compat.cache.save", AsyncMock())
    monkeypatch.setattr("app.routers.openai_compat.store.log_request", AsyncMock())
    monkeypatch.setattr("app.routers.openai_compat.store.check_rate_limit", AsyncMock(return_value=True))
    monkeypatch.setattr("app.routers.openai_compat.llm.embed", AsyncMock(side_effect=Exception("no embed in tests")))


def test_non_streaming_completion_shape(monkeypatch):
    _patch_pipeline(monkeypatch, [{"token": "p95 "}, {"token": "latency"},
                                  {"usage": {"prompt_tokens": 10, "completion_tokens": 2, "total_tokens": 12}}])
    resp = client.post("/v1/chat/completions", json={
        "model": "chat-local",
        "messages": [{"role": "user", "content": "what is p95 latency?"}],
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["object"] == "chat.completion"
    assert body["choices"][0]["message"]["content"] == "p95 latency"
    assert body["usage"]["total_tokens"] == 12


def test_streaming_emits_openai_chunks(monkeypatch):
    _patch_pipeline(monkeypatch, [{"token": "hello"}, {"usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2}}])
    with client.stream("POST", "/v1/chat/completions", json={
        "model": "auto", "stream": True,
        "messages": [{"role": "user", "content": "hi"}],
    }) as resp:
        assert resp.status_code == 200
        raw = "".join(resp.iter_text())
    assert '"object": "chat.completion.chunk"' in raw
    assert "hello" in raw
    assert "data: [DONE]" in raw


def test_upstream_error_is_502_not_500(monkeypatch):
    _patch_pipeline(monkeypatch, [{"error": "upstream unreachable: ConnectError"}])
    resp = client.post("/v1/chat/completions", json={
        "model": "chat-cloud",
        "messages": [{"role": "user", "content": "hi"}],
    })
    assert resp.status_code == 502
    assert resp.json()["error"]["type"] == "upstream_error"


def test_rate_limit_returns_429(monkeypatch):
    monkeypatch.setattr("app.routers.openai_compat.store.check_rate_limit", AsyncMock(return_value=False))
    resp = client.post("/v1/chat/completions", json={
        "model": "auto", "messages": [{"role": "user", "content": "hi"}],
    })
    assert resp.status_code == 429

"""Tenancy gate behavior: off = open, on = keyed; budget hard-caps."""
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import app
from app.services import tenancy

client = TestClient(app, raise_server_exceptions=False)


def _settings(**kw):
    s = type("S", (), {})()
    s.tenancy_enabled = kw.get("tenancy", True)
    s.rate_limit_per_minute = 30
    s.lane_local_alias = "chat-local"
    s.lane_cloud_alias = "chat-cloud"
    return s


def test_open_when_tenancy_disabled():
    with patch("app.routers.openai_compat.get_settings", return_value=_settings(tenancy=False)), \
         patch("app.routers.openai_compat.store.check_rate_limit", AsyncMock(return_value=False)):
        resp = client.post("/v1/chat/completions", json={
            "model": "auto", "messages": [{"role": "user", "content": "hi"}]})
    assert resp.status_code == 429  # passed auth, hit the rate limiter


def test_401_without_key_when_enabled():
    with patch("app.routers.openai_compat.get_settings", return_value=_settings()):
        resp = client.post("/v1/chat/completions", json={
            "model": "auto", "messages": [{"role": "user", "content": "hi"}]})
    assert resp.status_code == 401


def test_401_on_unknown_key():
    with patch("app.routers.openai_compat.get_settings", return_value=_settings()), \
         patch("app.routers.openai_compat.tenancy.resolve", AsyncMock(return_value=None)):
        resp = client.post("/v1/chat/completions",
                           headers={"Authorization": "Bearer tr_nope"},
                           json={"model": "auto", "messages": [{"role": "user", "content": "hi"}]})
    assert resp.status_code == 401


def test_402_on_budget_cap():
    ctx = tenancy.TenantContext(tenant_id="t1", key_id="k1", monthly_cap_usd=1.0)
    with patch("app.routers.openai_compat.get_settings", return_value=_settings()), \
         patch("app.routers.openai_compat.tenancy.resolve", AsyncMock(return_value=ctx)), \
         patch("app.routers.openai_compat.tenancy.budget_exceeded", AsyncMock(return_value=True)):
        resp = client.post("/v1/chat/completions",
                           headers={"Authorization": "Bearer tr_capped"},
                           json={"model": "auto", "messages": [{"role": "user", "content": "hi"}]})
    assert resp.status_code == 402
    assert resp.json()["error"]["type"] == "budget_exceeded"


def test_key_storage_is_hash_only():
    raw, hashed = tenancy.generate_key()
    assert raw.startswith("tr_")
    assert hashed == tenancy.hash_key(raw)
    assert raw not in hashed and len(hashed) == 64


def test_chat_endpoint_requires_key_when_enabled():
    with patch("app.routers.chat.get_settings", return_value=_settings()):
        resp = client.post("/chat", json={
            "messages": [{"role": "user", "content": "hi"}]})
    assert resp.status_code == 401

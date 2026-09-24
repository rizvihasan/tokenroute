"""Billing scaffolding: plans readable, checkout 501s until configured,
webhook signature verification works."""
import hashlib
import hmac
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import app
from app.services import billing

client = TestClient(app)


def test_plans_public():
    resp = client.get("/billing/plans")
    assert resp.status_code == 200
    body = resp.json()
    assert body["plans"]["free"]["monthly_cap_usd"] == 5.0
    assert body["configured"] is False


def test_checkout_501_until_configured():
    with patch("app.routers.billing.get_settings") as gs:
        gs.return_value = type("S", (), {"admin_key": "adm"})()
        resp = client.post("/billing/checkout", json={"tenant_id": "t1", "email": "a@b.c"},
                           headers={"x-admin-key": "adm"})
    assert resp.status_code == 501
    assert resp.json()["detail"]["error"] == "billing not configured"


def test_checkout_requires_admin_key():
    with patch("app.routers.billing.get_settings") as gs:
        gs.return_value = type("S", (), {"admin_key": "adm"})()
        resp = client.post("/billing/checkout", json={"tenant_id": "t1", "email": "a@b.c"})
    assert resp.status_code == 401


def test_razorpay_webhook_signature():
    with patch("app.services.billing.get_settings") as gs:
        gs.return_value = type("S", (), {"razorpay_webhook_secret": "whsec"})()
        body = b'{"event":"subscription.activated"}'
        good = hmac.new(b"whsec", body, hashlib.sha256).hexdigest()
        assert billing.verify_razorpay_webhook(body, good) is True
        assert billing.verify_razorpay_webhook(body, "bad") is False


def test_stripe_webhook_signature():
    import time
    with patch("app.services.billing.get_settings") as gs:
        gs.return_value = type("S", (), {"stripe_webhook_secret": "whsec"})()
        body = b'{"type":"customer.subscription.created"}'
        ts = int(time.time())
        sig = hmac.new(b"whsec", f"{ts}.".encode() + body, hashlib.sha256).hexdigest()
        assert billing.verify_stripe_webhook(body, f"t={ts},v1={sig}") is True
        assert billing.verify_stripe_webhook(body, f"t={ts},v1=bad") is False
        assert billing.verify_stripe_webhook(body, f"t={ts - 1000},v1={sig}") is False  # replay window


def test_webhook_503_without_secret():
    with patch("app.routers.billing.get_settings") as gs, \
         patch("app.services.billing.get_settings") as bs:
        gs.return_value = type("S", (), {"razorpay_webhook_secret": ""})()
        bs.return_value = gs.return_value
        resp = client.post("/billing/webhook/razorpay", content=b"{}",
                           headers={"x-razorpay-signature": "x"})
    assert resp.status_code == 503

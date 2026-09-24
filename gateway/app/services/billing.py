"""Billing: plan tiers + subscription state. Structure is complete; the
provider rails stay dormant until BILLING_PROVIDER + credentials are set
(Razorpay first - INR; Stripe supported as the alternate).

Free tier is real, not a funnel: $5/mo platform cap, all providers, BYOK.
Pro raises the platform cap and adds the metrics scope by default.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time

import httpx

from ..config import get_settings
from . import db

PLANS = {
    "free": {"monthly_cap_usd": 5.0, "price_inr": 0, "price_usd": 0},
    "pro": {"monthly_cap_usd": 50.0, "price_inr": 499, "price_usd": 6},
}

DDL = """
CREATE TABLE IF NOT EXISTS subscriptions (
    tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'active',  -- trialing|active|past_due|cancelled
    provider TEXT NOT NULL DEFAULT '',
    provider_subscription_id TEXT NOT NULL DEFAULT '',
    current_period_end TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""


async def init_schema() -> None:
    async with await db.get_conn() as conn:
        await conn.execute(DDL)
        await conn.commit()


async def get_subscription(tenant_id: str) -> dict:
    async with await db.get_conn() as conn:
        cur = await conn.execute(
            "SELECT plan, status, provider, current_period_end FROM subscriptions WHERE tenant_id = %s",
            (tenant_id,))
        row = await cur.fetchone()
    if row is None:
        return {"plan": "free", "status": "active", "provider": "", "current_period_end": None}
    return {"plan": row[0], "status": row[1], "provider": row[2],
            "current_period_end": row[3].isoformat() if row[3] else None}


async def _set_subscription(tenant_id: str, plan: str, status: str,
                            provider: str, sub_id: str) -> None:
    async with await db.get_conn() as conn:
        await conn.execute(
            """
            INSERT INTO subscriptions (tenant_id, plan, status, provider, provider_subscription_id)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (tenant_id) DO UPDATE SET plan = EXCLUDED.plan,
                status = EXCLUDED.status, provider = EXCLUDED.provider,
                provider_subscription_id = EXCLUDED.provider_subscription_id,
                updated_at = now()
            """,
            (tenant_id, plan, status, provider, sub_id),
        )
        if status == "active":
            # the plan's platform cap applies to the tenant's keys
            cap = PLANS[plan]["monthly_cap_usd"]
            await conn.execute(
                "UPDATE api_keys SET monthly_cap_usd = %s WHERE tenant_id = %s",
                (cap, tenant_id),
            )
        await conn.commit()


def configured() -> bool:
    s = get_settings()
    if s.billing_provider == "razorpay":
        return bool(s.razorpay_key_id and s.razorpay_key_secret and s.razorpay_plan_id_pro)
    if s.billing_provider == "stripe":
        return bool(s.stripe_api_key and s.stripe_price_id_pro)
    return False


async def create_checkout(tenant_id: str, email: str, plan: str = "pro") -> dict:
    """Create a provider checkout/subscription link. 501 at the router when
    unconfigured; this function assumes configuration is present."""
    s = get_settings()
    if s.billing_provider == "razorpay":
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.razorpay.com/v1/subscriptions",
                auth=(s.razorpay_key_id, s.razorpay_key_secret),
                json={"plan_id": s.razorpay_plan_id_pro, "total_count": 120,
                      "customer_notify": 1, "notes": {"tenant_id": tenant_id, "email": email}},
            )
            resp.raise_for_status()
            data = resp.json()
        return {"provider": "razorpay", "checkout_url": data.get("short_url"),
                "subscription_id": data.get("id")}
    if s.billing_provider == "stripe":
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.stripe.com/v1/checkout/sessions",
                headers={"Authorization": f"Bearer {s.stripe_api_key}"},
                data={"mode": "subscription", "line_items[0][price]": s.stripe_price_id_pro,
                      "line_items[0][quantity]": "1", "customer_email": email,
                      "metadata[tenant_id]": tenant_id,
                      "success_url": "https://tokenroute.vercel.app/dashboard?billing=ok",
                      "cancel_url": "https://tokenroute.vercel.app/dashboard?billing=cancelled"},
            )
            resp.raise_for_status()
            data = resp.json()
        return {"provider": "stripe", "checkout_url": data.get("url"),
                "subscription_id": data.get("subscription")}
    raise RuntimeError(f"unknown billing provider: {s.billing_provider}")


def verify_razorpay_webhook(body: bytes, signature: str) -> bool:
    secret = get_settings().razorpay_webhook_secret
    if not secret:
        return False
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def verify_stripe_webhook(body: bytes, header: str) -> bool:
    secret = get_settings().stripe_webhook_secret
    if not secret:
        return False
    try:
        parts = dict(p.split("=", 1) for p in header.split(","))
        ts, sig = parts["t"], parts["v1"]
        if abs(time.time() - int(ts)) > 300:
            return False
        expected = hmac.new(secret.encode(), f"{ts}.".encode() + body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, sig)
    except (KeyError, ValueError):
        return False


async def handle_event(provider: str, payload: dict) -> dict:
    """Normalize a provider webhook into a subscription-state transition."""
    if provider == "razorpay":
        event = payload.get("event", "")
        entity = (payload.get("payload", {}).get("subscription", {}) or {}).get("entity", {})
        tenant_id = (entity.get("notes") or {}).get("tenant_id", "")
        sub_id = entity.get("id", "")
        mapping = {"subscription.activated": ("pro", "active"),
                   "subscription.halted": ("pro", "past_due"),
                   "subscription.cancelled": ("free", "cancelled")}
        if event in mapping and tenant_id:
            plan, status = mapping[event]
            await _set_subscription(tenant_id, plan, status, "razorpay", sub_id)
            return {"applied": True, "plan": plan, "status": status}
        return {"applied": False, "event": event}
    if provider == "stripe":
        event = payload.get("type", "")
        obj = payload.get("data", {}).get("object", {})
        tenant_id = (obj.get("metadata") or {}).get("tenant_id", "")
        sub_id = obj.get("id", "")
        mapping = {"customer.subscription.created": ("pro", "active"),
                   "customer.subscription.updated": ("pro", "active"),
                   "customer.subscription.deleted": ("free", "cancelled")}
        if event in mapping and tenant_id:
            plan, status = mapping[event]
            await _set_subscription(tenant_id, plan, status, "stripe", sub_id)
            return {"applied": True, "plan": plan, "status": status}
        return {"applied": False, "event": event}
    return {"applied": False}

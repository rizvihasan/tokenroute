"""Billing API. Structure-complete and dormant until credentials are set:
checkout returns 501 with a clear message, webhooks 503. Plans are always
readable. Admin-key protected, like /admin - the web app calls these
server-side after sign-in."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from ..config import get_settings
from ..services import billing

router = APIRouter()


def _authorize(request: Request) -> None:
    expected = get_settings().admin_key
    if not expected or request.headers.get("x-admin-key") != expected:
        raise HTTPException(status_code=401, detail="invalid admin key")


class CheckoutIn(BaseModel):
    tenant_id: str
    email: str = Field(min_length=3, max_length=320)
    plan: str = Field(default="pro", pattern="^(pro)$")


@router.get("/billing/plans")
async def plans():
    return {"plans": billing.PLANS, "provider": get_settings().billing_provider or None,
            "configured": billing.configured()}


@router.get("/billing/status")
async def status(tenant_id: str, request: Request):
    _authorize(request)
    return await billing.get_subscription(tenant_id)


@router.post("/billing/checkout")
async def checkout(body: CheckoutIn, request: Request):
    _authorize(request)
    if not billing.configured():
        raise HTTPException(status_code=501, detail={
            "error": "billing not configured",
            "hint": "set BILLING_PROVIDER + provider credentials to enable checkout",
        })
    return await billing.create_checkout(body.tenant_id, body.email, body.plan)


@router.post("/billing/webhook/razorpay")
async def razorpay_webhook(request: Request):
    raw = await request.body()
    sig = request.headers.get("x-razorpay-signature", "")
    if not billing.verify_razorpay_webhook(raw, sig):
        raise HTTPException(status_code=503 if not get_settings().razorpay_webhook_secret else 401,
                            detail="webhook not configured" if not get_settings().razorpay_webhook_secret
                            else "invalid signature")
    return await billing.handle_event("razorpay", await request.json())


@router.post("/billing/webhook/stripe")
async def stripe_webhook(request: Request):
    raw = await request.body()
    sig = request.headers.get("stripe-signature", "")
    if not billing.verify_stripe_webhook(raw, sig):
        raise HTTPException(status_code=503 if not get_settings().stripe_webhook_secret else 401,
                            detail="webhook not configured" if not get_settings().stripe_webhook_secret
                            else "invalid signature")
    return await billing.handle_event("stripe", await request.json())

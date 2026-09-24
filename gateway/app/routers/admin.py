"""Tenant provisioning API - protected by ADMIN_KEY, called server-to-server
(e.g. by the web app after a Google sign-in), never by browsers directly.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from ..config import get_settings
from ..services import tenancy

router = APIRouter()


def _authorize(request: Request) -> None:
    expected = get_settings().admin_key
    if not expected or request.headers.get("x-admin-key") != expected:
        raise HTTPException(status_code=401, detail="invalid admin key")


class TenantIn(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    name: str | None = Field(default=None, max_length=256)


class KeyIn(BaseModel):
    tenant_id: str
    name: str = Field(default="default", max_length=128)
    monthly_cap_usd: float | None = None
    scopes: list[str] | None = None  # subset of {"chat", "metrics"}; default ["chat"]


class ProviderKeyIn(BaseModel):
    tenant_id: str
    provider: str = Field(pattern="^(groq|openai|gemini|jina|openrouter)$")
    api_key: str = Field(min_length=8, max_length=512)


@router.post("/admin/tenants")
async def upsert_tenant(body: TenantIn, request: Request):
    _authorize(request)
    return await tenancy.create_tenant(body.email, body.name)


@router.post("/admin/keys")
async def create_key(body: KeyIn, request: Request):
    _authorize(request)
    # the raw key is returned once, here; only its hash is stored
    return await tenancy.create_api_key(body.tenant_id, body.name, body.monthly_cap_usd, body.scopes)


@router.get("/admin/keys")
async def list_keys(tenant_id: str, request: Request):
    _authorize(request)
    return await tenancy.list_api_keys(tenant_id)


@router.post("/admin/keys/revoke")
async def revoke_key(request: Request):
    _authorize(request)
    body = await request.json()
    ok = await tenancy.revoke_api_key(str(body.get("key_id", "")))
    if not ok:
        raise HTTPException(status_code=404, detail="key not found or already revoked")
    return {"ok": True}


@router.post("/admin/provider-keys")
async def set_provider_key(body: ProviderKeyIn, request: Request):
    _authorize(request)
    await tenancy.set_provider_key(body.tenant_id, body.provider, body.api_key)
    return {"ok": True}

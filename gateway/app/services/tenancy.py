"""Multi-tenancy: tenants, API keys, BYOK provider keys, budgets.

Open-core design: everything here is Apache 2.0 and self-hostable. Tenancy is
OFF by default (TENANCY_ENABLED=false) so local dev and the public demo stay
keyless; a hosted deployment flips it on and every /v1 + /chat call then
requires a tenant API key.

Storage is Postgres (already in the stack). Provider keys are encrypted at
rest with Fernet (BYOK_MASTER_KEY env); only hashes of tenant API keys are
stored - a database dump leaks neither.
"""

from __future__ import annotations

import hashlib
import secrets
import time
import uuid
from dataclasses import dataclass, field

from cryptography.fernet import Fernet

from ..config import get_settings
from . import db

DDL = """
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'default',
    key_hash TEXT UNIQUE NOT NULL,
    key_prefix TEXT NOT NULL,
    monthly_cap_usd NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS provider_keys (
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    ciphertext TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, provider)
);
"""


@dataclass
class TenantContext:
    tenant_id: str
    key_id: str
    provider_keys: dict[str, str] = field(default_factory=dict)  # provider -> plaintext
    monthly_cap_usd: float | None = None


def _fernet() -> Fernet:
    key = get_settings().byok_master_key
    if not key:
        raise RuntimeError("BYOK_MASTER_KEY is not configured")
    return Fernet(key.encode() if isinstance(key, str) else key)


def hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def generate_key() -> tuple[str, str]:
    """Return (raw key shown once, sha256 hash stored)."""
    raw = f"tr_{secrets.token_urlsafe(24)}"
    return raw, hash_key(raw)


async def init_schema() -> None:
    async with await db.get_conn() as conn:
        await conn.execute(DDL)
        await conn.commit()


async def create_tenant(email: str, name: str | None = None) -> dict:
    tid = uuid.uuid4().hex
    async with await db.get_conn() as conn:
        await conn.execute(
            "INSERT INTO tenants (id, email, name) VALUES (%s, %s, %s) "
            "ON CONFLICT (email) DO NOTHING",
            (tid, email, name),
        )
        row = await conn.execute("SELECT id, email, name FROM tenants WHERE email = %s", (email,))
        tenant = await row.fetchone()
        await conn.commit()
    return {"id": tenant[0], "email": tenant[1], "name": tenant[2]}


async def create_api_key(tenant_id: str, name: str = "default",
                         monthly_cap_usd: float | None = None) -> dict:
    raw, hashed = generate_key()
    kid = uuid.uuid4().hex
    async with await db.get_conn() as conn:
        await conn.execute(
            "INSERT INTO api_keys (id, tenant_id, name, key_hash, key_prefix, monthly_cap_usd) "
            "VALUES (%s, %s, %s, %s, %s, %s)",
            (kid, tenant_id, name, hashed, raw[:12], monthly_cap_usd),
        )
        await conn.commit()
    return {"id": kid, "key": raw, "prefix": raw[:12], "name": name}


async def set_provider_key(tenant_id: str, provider: str, plaintext: str) -> None:
    ct = _fernet().encrypt(plaintext.encode()).decode()
    async with await db.get_conn() as conn:
        await conn.execute(
            "INSERT INTO provider_keys (tenant_id, provider, ciphertext) VALUES (%s, %s, %s) "
            "ON CONFLICT (tenant_id, provider) DO UPDATE SET ciphertext = EXCLUDED.ciphertext",
            (tenant_id, provider, ct),
        )
        await conn.commit()


async def resolve(raw_key: str) -> TenantContext | None:
    """API key -> tenant context, or None if unknown/revoked."""
    async with await db.get_conn() as conn:
        row = await conn.execute(
            "SELECT id, tenant_id, monthly_cap_usd FROM api_keys "
            "WHERE key_hash = %s AND revoked_at IS NULL",
            (hash_key(raw_key),),
        )
        key = await row.fetchone()
        if key is None:
            return None
        rows = await conn.execute(
            "SELECT provider, ciphertext FROM provider_keys WHERE tenant_id = %s",
            (key[1],),
        )
        provider_rows = await rows.fetchall()
    f = _fernet()
    return TenantContext(
        tenant_id=key[1], key_id=key[0],
        monthly_cap_usd=float(key[2]) if key[2] is not None else None,
        provider_keys={p: f.decrypt(ct.encode()).decode() for p, ct in provider_rows},
    )


async def budget_exceeded(ctx: TenantContext) -> bool:
    """Hard-cap check: this month's recorded spend vs the key's cap."""
    if ctx.monthly_cap_usd is None:
        return False
    from . import store  # redis counters live there
    spent = await store.monthly_spend(ctx.key_id)
    return spent >= ctx.monthly_cap_usd


async def list_api_keys(tenant_id: str) -> list[dict]:
    async with await db.get_conn() as conn:
        rows = await conn.execute(
            "SELECT id, prefix, name, created_at, monthly_cap_usd FROM api_keys "
            "WHERE tenant_id = %s AND revoked_at IS NULL ORDER BY created_at DESC",
            (tenant_id,),
        )
        fetched = await rows.fetchall()
    return [
        {"id": r[0], "prefix": r[1], "name": r[2],
         "created_at": r[3].isoformat(), "monthly_cap_usd": float(r[4]) if r[4] is not None else None}
        for r in fetched
    ]


async def revoke_api_key(key_id: str) -> bool:
    async with await db.get_conn() as conn:
        cur = await conn.execute(
            "UPDATE api_keys SET revoked_at = now() WHERE id = %s AND revoked_at IS NULL",
            (key_id,),
        )
        await conn.commit()
        return cur.rowcount > 0

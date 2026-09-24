"""Redis-backed runtime state: metrics counters, rate limiting, job status."""

from __future__ import annotations

import time

import redis.asyncio as aioredis

from ..config import get_settings

_client: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    global _client
    if _client is None:
        _client = aioredis.from_url(get_settings().redis_url, decode_responses=True)
    return _client


# ---- metrics ----
# All metrics live in one hash per conversation plus a global hash, so the
# console can render both per-chat and fleet views without a database.

async def incr_metric(name: str, amount: float = 1.0, conversation_id: str | None = None) -> None:
    r = get_redis()
    pipe = r.pipeline()
    pipe.hincrbyfloat("metrics:global", name, amount)
    if conversation_id:
        pipe.hincrbyfloat(f"metrics:conv:{conversation_id}", name, amount)
    await pipe.execute()


async def record_latency(kind: str, ms: float, conversation_id: str | None = None) -> None:
    # keep count + sum; average is derived at read time
    await incr_metric(f"{kind}_count", 1, conversation_id)
    await incr_metric(f"{kind}_sum_ms", ms, conversation_id)


async def get_metrics(conversation_id: str | None = None) -> dict:
    r = get_redis()
    raw = await r.hgetall(f"metrics:conv:{conversation_id}" if conversation_id else "metrics:global")
    out = {k: float(v) for k, v in raw.items()}
    for kind in ("ttft", "generation"):
        count = out.get(f"{kind}_count", 0.0)
        out[f"{kind}_avg_ms"] = (out.get(f"{kind}_sum_ms", 0.0) / count) if count else 0.0
    hits = out.get("cache_hits", 0.0)
    misses = out.get("cache_misses", 0.0)
    out["cache_hit_rate"] = hits / (hits + misses) if (hits + misses) else 0.0
    return out


# ---- rate limiting (fixed window per minute per key) ----

async def check_rate_limit(key: str) -> bool:
    """True if the request is allowed, False if over the limit."""
    limit = get_settings().rate_limit_per_minute
    bucket = f"rl:{key}:{int(time.time() // 60)}"
    r = get_redis()
    count = await r.incr(bucket)
    if count == 1:
        await r.expire(bucket, 90)
    return count <= limit

"""Redis-backed runtime state: metrics counters, request log, rate limiting."""

from __future__ import annotations

import json
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


# ---- request log (ring buffer for the analytics console) ----
# One JSON event per completed /chat call, newest first. The console derives
# its aggregates from this log, so percentiles and the live feed always agree.

REQUESTS_KEY = "requests:global"
REQUESTS_CAP = 500


async def log_request(event: dict) -> None:
    r = get_redis()
    pipe = r.pipeline()
    pipe.lpush(REQUESTS_KEY, json.dumps(event))
    pipe.ltrim(REQUESTS_KEY, 0, REQUESTS_CAP - 1)
    await pipe.execute()


async def get_request_log(limit: int = 100) -> list[dict]:
    r = get_redis()
    raw = await r.lrange(REQUESTS_KEY, 0, max(0, limit - 1))
    out = []
    for item in raw:
        try:
            out.append(json.loads(item))
        except json.JSONDecodeError:
            continue
    return out


def percentile(values: list[float], q: float) -> float:
    """Linear-interpolation percentile; q in [0, 1]."""
    if not values:
        return 0.0
    s = sorted(values)
    if len(s) == 1:
        return s[0]
    pos = q * (len(s) - 1)
    lo = int(pos)
    hi = min(lo + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (pos - lo)


def summarize_requests(events: list[dict]) -> dict:
    """Aggregate the request-log window into console summary stats."""
    now = time.time()
    n = len(events)
    hits = [e for e in events if e.get("lane") == "cache"]
    completed = [e for e in events if e.get("status") == "ok"]
    errors = [e for e in events if e.get("status") == "error"]
    generated = [e for e in completed if e.get("lane") in ("local", "cloud")]
    ttfts = [e["ttft_ms"] for e in generated if e.get("ttft_ms")]
    speeds = [e["tokens_per_sec"] for e in generated if e.get("tokens_per_sec")]
    non_cache = n - len(hits)
    return {
        "window": n,
        "requests_last_hour": sum(1 for e in events if now - e.get("ts", 0) < 3600),
        "errors": len(errors),
        "cache_hits": len(hits),
        "cache_hit_rate": (len(hits) / n) if n else 0.0,
        "lane_local": sum(1 for e in events if e.get("lane") == "local"),
        "lane_cloud": sum(1 for e in events if e.get("lane") == "cloud"),
        "lane_cache": len(hits),
        "ttft_avg_ms": (sum(ttfts) / len(ttfts)) if ttfts else 0.0,
        "ttft_p50_ms": percentile(ttfts, 0.50),
        "ttft_p95_ms": percentile(ttfts, 0.95),
        "avg_tokens_per_sec": (sum(speeds) / len(speeds)) if speeds else 0.0,
        "tokens_in": sum(e.get("tokens_in", 0) for e in generated),
        "tokens_out": sum(e.get("tokens_out", 0) for e in generated),
        "cost_usd": sum(e.get("cost_usd", 0.0) for e in generated),
        "avg_similarity_on_hits": (
            sum(e.get("similarity", 0.0) for e in hits) / len(hits) if hits else 0.0
        ),
        "generated_requests": len(generated),
        "non_cache_requests": non_cache,
    }


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

"""Semantic response cache.

Entries are stored in Redis with their prompt embedding. A lookup embeds the
incoming prompt and returns the cached answer when cosine similarity clears
the configured threshold - so paraphrases hit, and hits cost zero tokens.

The scan is O(N) over a capped entry set, which is honest for a personal
deployment; the swap-in path for production is pgvector or Redis vector
search, and the interface here already isolates that decision.
"""

from __future__ import annotations

import json
import time

import numpy as np

from ..config import get_settings
from . import llm, store

CACHE_KEY = "semcache:entries"


def cosine(a: list[float], b: list[float]) -> float:
    va, vb = np.asarray(a, dtype=np.float32), np.asarray(b, dtype=np.float32)
    denom = float(np.linalg.norm(va) * np.linalg.norm(vb))
    return float(np.dot(va, vb) / denom) if denom else 0.0


async def lookup(prompt: str) -> dict | None:
    settings = get_settings()
    r = store.get_redis()
    entries = await r.lrange(CACHE_KEY, 0, settings.cache_max_entries)
    if not entries:
        return None
    [query_vec] = await llm.embed([prompt])

    best_score, best = -1.0, None
    for raw in entries:
        entry = json.loads(raw)
        score = cosine(query_vec, entry["embedding"])
        if score > best_score:
            best_score, best = score, entry
    if best is not None and best_score >= settings.cache_threshold:
        return {"response": best["response"], "model": best["model"], "similarity": best_score}
    return None


async def save(prompt: str, response: str, model: str) -> None:
    settings = get_settings()
    [vec] = await llm.embed([prompt])
    r = store.get_redis()
    entry = json.dumps(
        {
            "prompt": prompt,
            "embedding": vec,
            "response": response,
            "model": model,
            "created_at": time.time(),
        }
    )
    pipe = r.pipeline()
    pipe.lpush(CACHE_KEY, entry)
    pipe.ltrim(CACHE_KEY, 0, settings.cache_max_entries - 1)
    await pipe.execute()

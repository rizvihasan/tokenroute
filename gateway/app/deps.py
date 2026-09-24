"""Shared dependency wiring."""

from __future__ import annotations

from functools import lru_cache

from redis import Redis
from rq import Queue

from .config import get_settings


@lru_cache
def _sync_redis() -> Redis:
    return Redis.from_url(get_settings().redis_url)


def ingest_queue() -> Queue:
    return Queue("ingest", connection=_sync_redis())


def evals_queue() -> Queue:
    return Queue("evals", connection=_sync_redis())

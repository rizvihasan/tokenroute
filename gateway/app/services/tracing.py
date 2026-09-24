"""Langfuse tracing. No-op until keys are configured - the instrumentation
points stay in the code so flipping on observability is a config change."""

from __future__ import annotations

from contextlib import contextmanager

from ..config import get_settings

_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    s = get_settings()
    if not (s.langfuse_public_key and s.langfuse_secret_key):
        _client = None
        return None
    from langfuse import Langfuse

    _client = Langfuse(
        public_key=s.langfuse_public_key,
        secret_key=s.langfuse_secret_key,
        host=s.langfuse_host,
    )
    return _client


@contextmanager
def trace(name: str, metadata: dict | None = None):
    """Yield a span-like object with .update(); a null object when disabled."""
    client = _get_client()
    if client is None:
        yield _NullSpan()
        return
    span = client.trace(name=name, metadata=metadata or {})
    try:
        yield span
    finally:
        client.flush()


class _NullSpan:
    def update(self, **kwargs):
        return None

    def generation(self, **kwargs):
        return _NullSpan()

    def event(self, **kwargs):
        return _NullSpan()

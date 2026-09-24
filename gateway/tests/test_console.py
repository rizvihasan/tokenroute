import time

from app.services import store


def test_percentile_basic():
    assert store.percentile([], 0.5) == 0.0
    assert store.percentile([10.0], 0.95) == 10.0
    assert store.percentile([1.0, 2.0, 3.0, 4.0], 0.5) == 2.5
    assert store.percentile([1.0, 2.0, 3.0, 4.0], 1.0) == 4.0


def _event(**kw):
    base = {
        "ts": time.time(), "conversation_id": "t", "prompt": "hi",
        "lane": "local", "model": "chat-local", "cached": False,
        "status": "ok", "ttft_ms": 500.0, "elapsed_s": 2.0,
        "tokens_in": 10, "tokens_out": 100, "tokens_per_sec": 50.0,
        "cost_usd": 0.0,
    }
    base.update(kw)
    return base


def test_summarize_mixed_window():
    events = [
        _event(lane="cache", ttft_ms=0.0, tokens_in=0, tokens_out=0, similarity=0.97),
        _event(lane="local"),
        _event(lane="cloud", cost_usd=0.001),
        _event(status="error", lane="local"),
    ]
    s = store.summarize_requests(events)
    assert s["window"] == 4
    assert s["cache_hit_rate"] == 0.25
    assert s["lane_cache"] == 1 and s["lane_local"] == 2 and s["lane_cloud"] == 1
    assert s["errors"] == 1
    assert s["tokens_out"] == 200  # error and cache events contribute none
    assert abs(s["cost_usd"] - 0.001) < 1e-9
    assert s["ttft_avg_ms"] == 500.0  # only generated completions count
    assert s["requests_last_hour"] == 4


def test_summarize_empty_window():
    s = store.summarize_requests([])
    assert s["window"] == 0
    assert s["cache_hit_rate"] == 0.0
    assert s["ttft_p95_ms"] == 0.0

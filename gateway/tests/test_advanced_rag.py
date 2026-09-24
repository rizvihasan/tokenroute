"""Advanced RAG: rerank fallback behavior (DB legs need live pgvector; CI covers logic)."""
from unittest.mock import patch

from app.services import llm


def _settings(jina=""):
    s = type("S", (), {})()
    s.jina_api_key = jina
    s.embed_base_url = "https://api.jina.ai/v1"
    return s


async def test_rerank_without_key_returns_top_k_slice():
    docs = [{"content": f"doc{i}", "score": 1.0 / (i + 1)} for i in range(6)]
    with patch("app.services.llm.get_settings", return_value=_settings()):
        out = await llm.rerank("q", docs, 2)
    assert len(out) == 2 and out[0]["content"] == "doc0"


async def test_rerank_empty_docs():
    with patch("app.services.llm.get_settings", return_value=_settings(jina="jina_x")):
        assert await llm.rerank("q", [], 3) == []

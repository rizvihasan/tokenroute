"""Chunking + retrieval. No framework: the pipeline is readable end to end."""

from __future__ import annotations

import re


def chunk_text(text: str, size: int = 800, overlap: int = 120) -> list[str]:
    """Split text into overlapping chunks on paragraph/sentence boundaries.

    Chunks target `size` characters with `overlap` characters of shared
    context, preferring to break at paragraph or sentence ends rather than
    mid-word.
    """
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    if len(text) <= size:
        return [text]

    chunks: list[str] = []
    start = 0
    n = len(text)
    while start < n:
        end = min(start + size, n)
        if end < n:
            # walk back to a sentence or clause boundary
            boundary = max(
                text.rfind(". ", start, end),
                text.rfind("? ", start, end),
                text.rfind("! ", start, end),
                text.rfind("; ", start, end),
                text.rfind(", ", start, end),
            )
            if boundary > start + size // 2:
                end = boundary + 1
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= n:
            break
        start = max(end - overlap, start + 1)
    return chunks


async def retrieve(prompt: str, top_k: int, keys: dict | None = None) -> list[dict]:
    """Hybrid retrieval pipeline: embed -> vector+keyword (RRF) -> Jina rerank.
    Any leg failing degrades to the simpler one; retrieval is an enhancement,
    never a hard dependency of answering."""
    from . import db, llm  # local import: keeps chunking importable without DB deps
    try:
        [vec] = await llm.embed([prompt], keys)
        contexts = await db.search_hybrid(vec, prompt, top_k * 2)
        return await llm.rerank(prompt, contexts, top_k, keys)
    except Exception:
        return []

"""RQ jobs: document ingestion and eval runs. Heavy work never blocks /chat."""

from __future__ import annotations

import asyncio
import json

from ..config import get_settings
from ..services import db, llm, rag, store


def _run(coro):
    return asyncio.run(coro)


def ingest_document(doc_id: str, text: str, metadata: dict) -> dict:
    settings = get_settings()

    async def _ingest():
        await db.init_schema()
        chunks = rag.chunk_text(text, settings.chunk_size, settings.chunk_overlap)
        embeddings = await llm.embed(chunks)
        await db.upsert_chunks(doc_id, chunks, embeddings, metadata)
        return {"doc_id": doc_id, "chunks": len(chunks)}

    return _run(_ingest())


def run_evals(lane: str = "local") -> dict:
    from ..evals.runner import run_golden_set

    result = _run(run_golden_set(lane))

    async def _record():
        await store.incr_metric("eval_runs", 1)
        await store.get_redis().set("evals:latest", json.dumps(result))

    _run(_record())
    return result

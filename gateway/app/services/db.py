"""pgvector persistence for RAG chunks."""

from __future__ import annotations

import json

import psycopg
from pgvector.psycopg import register_vector_async

from ..config import get_settings

DDL = f"""
CREATE TABLE IF NOT EXISTS chunks (
    id BIGSERIAL PRIMARY KEY,
    doc_id TEXT NOT NULL,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{{}}',
    embedding vector({get_settings().embedding_dim}),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (doc_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS chunks_embedding_idx
    ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS fts tsvector
    GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;
CREATE INDEX IF NOT EXISTS chunks_fts_idx ON chunks USING gin (fts);
"""


async def get_conn() -> psycopg.AsyncConnection:
    conn = await psycopg.AsyncConnection.connect(get_settings().database_url)
    # extension must exist before the vector type can be registered
    await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
    await register_vector_async(conn)
    return conn


async def init_schema() -> None:
    async with await get_conn() as conn:
        await conn.execute(DDL)
        await conn.commit()


async def upsert_chunks(doc_id: str, chunks: list[str], embeddings: list[list[float]], metadata: dict) -> int:
    async with await get_conn() as conn:
        for i, (content, vec) in enumerate(zip(chunks, embeddings)):
            await conn.execute(
                """
                INSERT INTO chunks (doc_id, chunk_index, content, metadata, embedding)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (doc_id, chunk_index)
                DO UPDATE SET content = EXCLUDED.content,
                              metadata = EXCLUDED.metadata,
                              embedding = EXCLUDED.embedding
                """,
                (doc_id, i, content, json.dumps(metadata), vec),
            )
        await conn.commit()
    return len(chunks)


async def search_hybrid(query_embedding: list[float], query_text: str, top_k: int) -> list[dict]:
    """Vector + keyword (BM25-ish ts_rank) retrieval merged with reciprocal
    rank fusion. Falls back to pure vector search when the fts column is
    missing (older schema) or the keyword leg matches nothing."""
    k = 60  # RRF constant
    try:
        async with await get_conn() as conn:
            cur = await conn.execute(
                """
                WITH vec AS (
                    SELECT id, doc_id, content, metadata,
                           ROW_NUMBER() OVER (ORDER BY embedding <=> %s::vector) AS vrank
                    FROM chunks LIMIT %s
                ),
                kw AS (
                    SELECT id, doc_id, content, metadata,
                           ROW_NUMBER() OVER (ORDER BY ts_rank_cd(fts, plainto_tsquery('english', %s)) DESC) AS krank
                    FROM chunks
                    WHERE fts @@ plainto_tsquery('english', %s)
                    LIMIT %s
                )
                SELECT COALESCE(v.doc_id, k2.doc_id) AS doc_id,
                       COALESCE(v.content, k2.content) AS content,
                       COALESCE(v.metadata, k2.metadata) AS metadata,
                       COALESCE(1.0/(%s + v.vrank), 0) + COALESCE(1.0/(%s + k2.krank), 0) AS rrf
                FROM vec v FULL OUTER JOIN kw k2 ON v.id = k2.id
                ORDER BY rrf DESC
                LIMIT %s
                """,
                (query_embedding, top_k * 2, query_text, query_text, top_k * 2, k, k, top_k),
            )
            rows = await cur.fetchall()
        return [{"doc_id": d, "content": c, "metadata": m, "score": float(sc)} for d, c, m, sc in rows]
    except Exception:
        return await search(query_embedding, top_k)


async def search(query_embedding: list[float], top_k: int) -> list[dict]:
    async with await get_conn() as conn:
        cur = await conn.execute(
            """
            SELECT doc_id, content, metadata, 1 - (embedding <=> %s::vector) AS score
            FROM chunks
            ORDER BY embedding <=> %s::vector
            LIMIT %s
            """,
            (query_embedding, query_embedding, top_k),
        )
        rows = await cur.fetchall()
    return [
        {"doc_id": d, "content": c, "metadata": m, "score": float(s)} for d, c, m, s in rows
    ]

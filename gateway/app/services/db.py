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

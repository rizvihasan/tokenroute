from contextlib import asynccontextmanager

from fastapi import FastAPI

from .routers import chat, evals, ingest, metrics
from .services import db


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await db.init_schema()
    except Exception:
        # the API still serves chat without RAG; retrieval degrades gracefully
        pass
    yield


app = FastAPI(title="TokenRoute Gateway", version="0.1.0", lifespan=lifespan)
app.include_router(chat.router)
app.include_router(ingest.router)
app.include_router(evals.router)
app.include_router(metrics.router)


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}

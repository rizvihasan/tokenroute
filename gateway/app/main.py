from contextlib import asynccontextmanager

from fastapi import FastAPI

from .config import get_settings

from .routers import admin, chat, evals, ingest, mcp, metrics, openai_compat
from .services import db, tenancy


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await db.init_schema()
        if get_settings().tenancy_enabled:
            await tenancy.init_schema()
    except Exception:
        # the API still serves chat without RAG; retrieval degrades gracefully
        pass
    yield


app = FastAPI(title="TokenRoute Gateway", version="0.1.0", lifespan=lifespan)
app.include_router(chat.router)
app.include_router(openai_compat.router)
app.include_router(ingest.router)
app.include_router(evals.router)
app.include_router(metrics.router)
app.include_router(admin.router)
app.include_router(mcp.router)


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}

from fastapi import APIRouter, Query

from ..services import store

router = APIRouter()


@router.get("/metrics")
async def metrics(conversation_id: str | None = None):
    return await store.get_metrics(conversation_id)


@router.get("/metrics/console")
async def metrics_console(limit: int = Query(default=100, ge=1, le=500)):
    """Analytics-console payload: recent request events + derived aggregates."""
    events = await store.get_request_log(limit)
    return {"summary": store.summarize_requests(events), "requests": events}

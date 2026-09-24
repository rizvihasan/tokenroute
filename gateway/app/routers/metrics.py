from fastapi import APIRouter

from ..services import store

router = APIRouter()


@router.get("/metrics")
async def metrics(conversation_id: str | None = None):
    return await store.get_metrics(conversation_id)

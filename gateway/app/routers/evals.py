import json

from fastapi import APIRouter

from ..deps import evals_queue
from ..models import EvalRequest, JobStatus
from ..services import store

router = APIRouter()


@router.post("/evals", response_model=JobStatus, status_code=202)
async def start_evals(req: EvalRequest):
    job = evals_queue().enqueue("app.workers.jobs.run_evals", req.lane, job_timeout=1800)
    return JobStatus(job_id=job.id, status=job.get_status())


@router.get("/evals/latest")
async def latest_evals():
    raw = await store.get_redis().get("evals:latest")
    return json.loads(raw) if raw else {"status": "no eval run recorded yet"}

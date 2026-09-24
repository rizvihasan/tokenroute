from fastapi import APIRouter

from ..deps import ingest_queue
from ..models import IngestRequest, JobStatus

router = APIRouter()


@router.post("/ingest", response_model=JobStatus, status_code=202)
async def ingest(req: IngestRequest):
    job = ingest_queue().enqueue(
        "app.workers.jobs.ingest_document", req.doc_id, req.text, req.metadata
    )
    return JobStatus(job_id=job.id, status=job.get_status())

#!/bin/sh
# Single-container entrypoint for hosted demos (e.g. Render free tier, where
# background workers are paid). RUN_WORKER=1 runs the RQ worker in-process;
# the compose stack keeps API and worker as separate services instead.
set -e

if [ "$RUN_WORKER" = "1" ]; then
  rq worker --url "$REDIS_URL" ingest evals &
fi

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"

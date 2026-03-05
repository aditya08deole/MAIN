import asyncio
import logging
from datetime import datetime

from background_jobs import process_job
from database import SessionLocal
from models import Job
from sqlalchemy import select

logger = logging.getLogger("db_worker")


async def _claim_and_process(job: Job):
    job_id = job.id
    # Mark as running
    async with SessionLocal() as session:
        db_job = await session.get(Job, job_id)
        if not db_job or db_job.status != "queued":
            return
        db_job.status = "running"
        db_job.started_at = datetime.utcnow()
        await session.commit()

    # Ensure background_jobs has an in-memory entry to avoid KeyError
    try:
        import background_jobs as bj
        bj._jobs[job_id] = {"id": job_id, "type": job.type, "status": "running", "payload": job.payload}
    except Exception:
        logger.exception("Failed to prepare in-memory job state for %s", job_id)

    try:
        await process_job(job_id, job.payload)
    except Exception:
        logger.exception("Processing failed for job %s", job_id)


async def _loop(poll_interval: float = 2.0):
    logger.info("DB worker started, polling for queued jobs")
    while True:
        try:
            async with SessionLocal() as session:
                    q = await session.execute(select(Job).where(Job.status == "queued").limit(5))
                    jobs = q.scalars().all()
                    for job in jobs:
                        await _claim_and_process(job)
        except Exception:
            logger.exception("DB worker loop exception")
        await asyncio.sleep(poll_interval)


def main():
    logging.basicConfig(level=logging.INFO)
    try:
        asyncio.run(_loop())
    except KeyboardInterrupt:
        logger.info("DB worker stopped by user")


if __name__ == "__main__":
    main()

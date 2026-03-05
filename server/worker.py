"""Simple asyncio worker that listens on Redis list 'evara:jobs' and processes jobs.
Run with: .venv\Scripts\python.exe worker.py
"""
import asyncio
import json
import logging
from config import get_settings
import redis.asyncio as aioredis
from background_jobs import process_job
from database import SessionLocal
from models import Job

logger = logging.getLogger("worker")

async def run_worker():
    cfg = get_settings()
    redis_url = cfg.REDIS_URL
    if not redis_url:
        logger.error("REDIS_URL not configured. Exiting.")
        return

    redis = aioredis.from_url(redis_url)
    key = "evara:jobs"
    logger.info("Worker connected to Redis, listening on %s", key)

    while True:
        try:
            # BLPOP returns (key, value)
            item = await redis.blpop(key, timeout=0)
            if not item:
                await asyncio.sleep(1)
                continue
            _, job_id = item
            job_id = job_id.decode() if isinstance(job_id, bytes) else str(job_id)
            logger.info("Worker popped job %s", job_id)
            # Load job payload from DB
            async with SessionLocal() as session:
                db_job = await session.get(Job, job_id)
                if not db_job:
                    logger.warning("Job %s not found in DB", job_id)
                    continue
                payload = db_job.payload or {}
            # Process
            await process_job(job_id, payload)
        except Exception as e:
            logger.exception("Worker error: %s", e)
            await asyncio.sleep(2)

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_worker())

import asyncio
import uuid
import logging
from typing import Any, Dict, Optional
from datetime import datetime

from auth_helper import _get_supabase, get_blocking_executor
from database import SessionLocal
from models import Customer, Job
from config import get_settings
import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

# Simple in-memory job queue and status store. Designed for small deployments
# where a full worker queue (Redis/Celery) is not available.
_job_queue: Optional[asyncio.Queue] = None
_jobs: Dict[str, Dict[str, Any]] = {}
_worker_tasks: Optional[list] = None
_redis_client: Optional[aioredis.Redis] = None
_redis_queue_key = "evara:jobs"

async def _process_create_customer(job_id: str, payload: Dict[str, Any]):
    """Process a create_customer job: create Supabase auth user, insert DB profile.
    Performs compensating delete on DB failure."""
    _jobs[job_id]["status"] = "running"
    email = payload.get("email")
    password = payload.get("password")
    display_name = payload.get("display_name")
    role = payload.get("role") or "customer"
    community_id = payload.get("community_id")

    try:
        sb = _get_supabase()
        if sb is None:
            raise RuntimeError("Supabase client not configured")

        # Call sync SDK in bounded threadpool
        loop = asyncio.get_running_loop()
        executor = get_blocking_executor()
        def _create():
            return sb.auth.admin.create_user({
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {"role": role, "display_name": display_name},
            })

        resp = await asyncio.wait_for(loop.run_in_executor(executor, _create), timeout=20.0)
        user_id = str(resp.user.id)
        _jobs[job_id]["meta"] = {"supabase_user_id": user_id}

        # Create DB profile
        async with SessionLocal() as session:
            cust = Customer(
                id=user_id,
                email=email,
                display_name=display_name,
                full_name=payload.get("full_name"),
                phone_number=payload.get("phone_number"),
                role=role,
                community_id=community_id,
                status="active",
            )
            session.add(cust)
            await session.commit()

            # Persist job success into jobs table
            try:
                db_job = await session.get(Job, job_id)
                if db_job:
                    db_job.status = "succeeded"
                    db_job.result = {"user_id": user_id}
                    db_job.finished_at = datetime.utcnow()
                    await session.commit()
            except Exception:
                logger.exception("[Jobs] Failed to persist job success for %s", job_id)

        _jobs[job_id]["status"] = "succeeded"
        _jobs[job_id]["result"] = {"user_id": user_id}
    except asyncio.TimeoutError:
        _jobs[job_id]["status"] = "failed"
        _jobs[job_id]["error"] = "supabase_timeout"
        # Persist
        try:
            async with SessionLocal() as session:
                db_job = await session.get(Job, job_id)
                if db_job:
                    db_job.status = "failed"
                    db_job.error = "supabase_timeout"
                    db_job.finished_at = datetime.utcnow()
                    await session.commit()
        except Exception:
            logger.exception("[Jobs] Failed to persist timeout for %s", job_id)
    except Exception as e:
        logger.exception("[Jobs] create_customer job failed: %s", e)
        _jobs[job_id]["status"] = "failed"
        _jobs[job_id]["error"] = str(e)
        # Try compensating delete if supabase user created
        supabase_id = _jobs[job_id].get("meta", {}).get("supabase_user_id")
        if supabase_id:
            try:
                sb = _get_supabase()
                if sb:
                    sb.auth.admin.delete_user(supabase_id)
                    logger.info("[Jobs] Deleted Supabase user %s after job failure", supabase_id)
            except Exception:
                logger.exception("[Jobs] Failed to delete Supabase user %s", supabase_id)
        # Persist failure
        try:
            async with SessionLocal() as session:
                db_job = await session.get(Job, job_id)
                if db_job:
                    db_job.status = "failed"
                    db_job.error = str(e)
                    db_job.finished_at = datetime.utcnow()
                    await session.commit()
        except Exception:
            logger.exception("[Jobs] Failed to persist failure for %s", job_id)


async def process_job(job_id: str, payload: Dict[str, Any]):
    """Public wrapper that runs the create_customer processing logic."""
    await _process_create_customer(job_id, payload)


async def _worker_loop():
    global _job_queue
    while True:
        job = await _job_queue.get()
        job_id = job["id"]
        try:
            _jobs[job_id]["started_at"] = asyncio.get_event_loop().time()
            if job["type"] == "create_customer":
                await _process_create_customer(job_id, job["payload"])
            else:
                _jobs[job_id]["status"] = "failed"
                _jobs[job_id]["error"] = "unknown_job_type"
        except Exception as e:
            logger.exception("[Jobs] Unhandled error processing job %s: %s", job_id, e)
            _jobs[job_id]["status"] = "failed"
            _jobs[job_id]["error"] = str(e)
        finally:
            _job_queue.task_done()


def start_background_jobs(worker_count: int = 2):
    global _job_queue, _worker_tasks
    if _job_queue is None:
        _job_queue = asyncio.Queue()
    if _worker_tasks is None:
        _worker_tasks = [asyncio.create_task(_worker_loop()) for _ in range(worker_count)]
    logger.info("[Jobs] Started %d worker(s)", worker_count)


async def enqueue_job(job_type: str, payload: Dict[str, Any]) -> str:
    """Create a persistent job row and enqueue it for processing."""
    # Persist job to DB first
    async with SessionLocal() as session:
        job = Job(type=job_type, payload=payload, status="queued")
        session.add(job)
        await session.commit()
        await session.refresh(job)
        job_id = job.id

    # Ensure background workers are running
    start_background_jobs()

    # Try to push to Redis-backed queue if configured — do this asynchronously
    # so an unavailable Redis does not block the API request.
    cfg = get_settings()
    if cfg.REDIS_URL:
        async def _push_to_redis(jid: str):
            try:
                global _redis_client
                if _redis_client is None:
                    _redis_client = aioredis.from_url(cfg.REDIS_URL)
                # Use a short timeout to avoid long waits when Redis is unreachable
                try:
                    await asyncio.wait_for(_redis_client.rpush(_redis_queue_key, jid), timeout=1.0)
                    logger.info("[Jobs] Enqueued job %s to Redis queue", jid)
                except asyncio.TimeoutError:
                    logger.warning("[Jobs] Redis push timed out for job %s", jid)
                except Exception:
                    logger.exception("[Jobs] Redis push failed for job %s", jid)
            except Exception:
                logger.exception("[Jobs] Failed to initialize Redis client for job %s", jid)

        # Fire-and-forget — do not await the Redis push in the request flow.
        try:
            asyncio.create_task(_push_to_redis(job_id))
        except Exception:
            logger.exception("[Jobs] Could not schedule Redis push task for %s", job_id)

    # Create in-memory tracking and enqueue (for local workers)
    _jobs[job_id] = {"id": job_id, "type": job_type, "status": "queued", "payload": payload}
    # Put job into queue
    await _job_queue.put(_jobs[job_id])
    return job_id


async def stop_background_jobs():
    global _worker_tasks
    if _worker_tasks:
        for t in _worker_tasks:
            t.cancel()
        _worker_tasks = None


async def get_job_status(job_id: str) -> Optional[Dict[str, Any]]:
    # Prefer in-memory status if present, otherwise read from DB
    if job_id in _jobs:
        return _jobs[job_id]
    try:
        async with SessionLocal() as session:
            db_job = await session.get(Job, job_id)
            if not db_job:
                return None
            return {
                "id": db_job.id,
                "type": db_job.type,
                "status": db_job.status,
                "payload": db_job.payload,
                "result": db_job.result,
                "error": db_job.error,
                "created_at": db_job.created_at.isoformat() if db_job.created_at else None,
                "started_at": db_job.started_at.isoformat() if db_job.started_at else None,
                "finished_at": db_job.finished_at.isoformat() if db_job.finished_at else None,
            }
    except Exception:
        logger.exception("[Jobs] Failed to read job status from DB for %s", job_id)
        return None


async def recover_pending_jobs():
    """
    P31: On server startup, re-enqueue any jobs that were queued or running
    when the server last shut down (or crashed). Prevents provisioning jobs
    from being silently lost on restarts/deploys.

    Only recovers jobs in 'queued' or 'running' state — completed/failed
    jobs are left as-is.
    """
    if _job_queue is None:
        logger.warning("[Jobs] recover_pending_jobs called before start_background_jobs — skipping")
        return
    recovered = 0
    try:
        from sqlalchemy import text as _text
        async with SessionLocal() as session:
            result = await session.execute(
                _text("SELECT id, type, payload, status FROM jobs WHERE status IN ('queued', 'running') ORDER BY created_at ASC")
            )
            rows = result.fetchall()
            for row in rows:
                job_id = str(row[0])
                if job_id not in _jobs:
                    _jobs[job_id] = {
                        "id": job_id,
                        "type": row[1],
                        "status": "queued",     # reset to queued so workers pick it up
                        "payload": row[3] if row[3] is not None else {},
                    }
                    await _job_queue.put(_jobs[job_id])
                    recovered += 1
        if recovered:
            logger.info("[Jobs] Recovered %d pending jobs from DB on startup", recovered)
        else:
            logger.debug("[Jobs] No pending jobs to recover on startup")
    except Exception:
        logger.exception("[Jobs] Failed to recover pending jobs — continuing without recovery")


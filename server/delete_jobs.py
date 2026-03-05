"""Delete job rows from the `jobs` table.

Usage:
  python delete_jobs.py --job-id <uuid>
  python delete_jobs.py --status succeeded --days 7

Be careful: deletions are permanent. This helper runs against the same
database configured by the application `.env` / settings.
"""
import argparse
import asyncio
from datetime import datetime, timedelta

from database import SessionLocal
from models import Job
from sqlalchemy import select, delete


async def delete_by_id(job_id: str):
    async with SessionLocal() as session:
        j = await session.get(Job, job_id)
        if not j:
            print("Job not found", job_id)
            return
        await session.delete(j)
        await session.commit()
        print("Deleted job", job_id)


async def delete_by_status(status: str, days: int | None = None):
    cutoff = None
    if days is not None:
        cutoff = datetime.utcnow() - timedelta(days=days)
    async with SessionLocal() as session:
        stmt = select(Job).where(Job.status == status)
        if cutoff is not None:
            stmt = stmt.where(Job.created_at >= cutoff)
        q = await session.execute(stmt)
        jobs = q.scalars().all()
        if not jobs:
            print("No jobs found for status", status)
            return
        ids = [j.id for j in jobs]
        # Delete
        del_stmt = delete(Job).where(Job.id.in_(ids))
        await session.execute(del_stmt)
        await session.commit()
        print(f"Deleted {len(ids)} job(s):", ids)


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--job-id", help="Delete a single job by id")
    p.add_argument("--status", help="Delete jobs by status (e.g. succeeded)")
    p.add_argument("--days", type=int, help="Only consider jobs created in the last N days")
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    if not args.job_id and not args.status:
        print("Provide --job-id or --status")
        raise SystemExit(1)
    if args.job_id:
        asyncio.run(delete_by_id(args.job_id))
    else:
        asyncio.run(delete_by_status(args.status, args.days))

# Worker & Local Dev Notes

This document explains how to run the background job processors and helper scripts locally (Windows dev environment).

Run backend (server directory):

```
cd server
.\.venv\Scripts\Activate.ps1
.\.venv\Scripts\python.exe main.py
```

DB-polling worker (no Redis required):

```
cd server
.\.venv\Scripts\Activate.ps1
.\.venv\Scripts\python.exe db_worker.py
```

Redis-backed worker (if you have Docker):

```
docker compose up -d redis
cd server
.\.venv\Scripts\Activate.ps1
.\.venv\Scripts\python.exe worker.py
```

Enqueue a job for development (dev only API):

```
# use the provided helper to create a queued job row for the DB worker
.\.venv\Scripts\python.exe insert_job_with_community.py <community_id>

# or enqueue via API (development mode only)
# POST /api/v1/admin/devtools/enqueue-create-customer
```

Cleanup test artifacts:

```
# Remove a test user by email
.\.venv\Scripts\python.exe cleanup_test_user.py --email test+123@example.com

# Or remove by Supabase user id
.\.venv\Scripts\python.exe cleanup_test_user.py --user-id <uuid>
```

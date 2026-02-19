# Backend & Supabase Integration – Deep Analysis & Fix Plan

## Executive summary

The dashboard does not show data even though the backend runs and data exists in Supabase. This document explains the architecture, root causes, and a concrete fix plan so the backend and dashboard work correctly with Supabase.

---

## 1. Architecture overview

### 1.1 Data flow (current design)

```
┌─────────────────┐     Supabase Auth      ┌──────────────────┐
│  React client   │ ──────────────────────►│  Supabase        │
│  (Vite)         │     JWT in localStorage │  (Auth + maybe   │
│                 │     sb-*-auth-token     │   users_profiles)│
└────────┬────────┘                         └──────────────────┘
         │
         │  Bearer <JWT>  (or dev-bypass token)
         │  GET /api/v1/nodes/, /dashboard/stats, /dashboard/alerts
         ▼
┌─────────────────┐     SQLAlchemy         ┌──────────────────┐
│  FastAPI        │ ──────────────────────►│  PostgreSQL      │
│  backend        │  DATABASE_URL          │  (Supabase DB or  │
│                 │                        │   separate DB)   │
└─────────────────┘                        └──────────────────┘
```

- **Frontend** uses Supabase for auth (and optionally `users_profiles` in Supabase).
- **Backend** does **not** use the Supabase JS client. It uses **SQLAlchemy** and **one** database pointed to by `DATABASE_URL`.
- All dashboard data (nodes, stats, alerts) is served by the **FastAPI backend** from that database. So “data in Supabase” must mean: the **same** Postgres that Supabase provides, and the backend must use **that** as `DATABASE_URL`.

### 1.2 Where Supabase is used

| Layer   | Use |
|--------|-----|
| **Client** | `supabase.auth` (login/session), `supabase.from('users_profiles')` for profile, `supabase.from('audit_logs')` for audit. |
| **Backend** | Only **JWT verification** (Supabase JWTs). No Supabase client; DB access is via SQLAlchemy only. |

So: **backend “integration” with Supabase** = same Postgres (Supabase’s) + verifying Supabase JWTs. Data visibility on the dashboard depends on the backend DB (connection + schema + auth).

---

## 2. Root causes: why data is not visible on the dashboard

### 2.1 Backend not using Supabase Postgres (most likely)

- In `server/app/core/config.py`, **default** is:
  - `DATABASE_URL: str = "sqlite+aiosqlite:///./test.db"`
- If `server/.env` does **not** set `DATABASE_URL` to the Supabase Postgres connection string, the backend uses **SQLite**.
- Then:
  - Any data you see “in Supabase” (e.g. in Supabase Dashboard → Table Editor) is in **Supabase Postgres**.
  - The backend reads/writes **only** SQLite.
  - Result: backend “works” (health, 200s) but **data is empty** on the dashboard because it’s reading from the wrong database.

**Fix:** Set `DATABASE_URL` in `server/.env` to the **Supabase Postgres** connection string (URI format, with password). Use “Transaction” or “Session” pooler and replace `postgres://` with `postgresql+asyncpg://` (session.py already does this).

---

### 2.2 No Bearer token sent for “dev bypass” login

- Dashboard and nodes require auth: `get_current_user_token` (Bearer).
- The API client in `client/src/services/api.ts` **only** attaches a token from localStorage keys like `sb-*-auth-token` (Supabase session).
- **Dev bypass** logins (e.g. `ritik@evaratech.com` / `evaratech@1010`) do **not** use Supabase; they only set `evara_session` in localStorage with a mock user (`id: 'dev-bypass-id-' + email`).
- So for dev bypass there is **no** `sb-*-auth-token` → **no** `Authorization: Bearer ...` → backend returns **401** for `/nodes/`, `/dashboard/stats`, `/dashboard/alerts` → dashboard shows no data.

**Fix:** In `api.ts`, if no Supabase token is found, check `evara_session`; if the user `id` starts with `dev-bypass-`, send `Authorization: Bearer <user.id>` so the backend’s existing dev-bypass logic accepts the request.

---

### 2.3 User not synced to backend (real Supabase login)

- After a **real** Supabase login, the backend’s `GET /nodes/` (and dashboard) need a **local** user row in `users_profiles` (backend DB). They resolve the user by `user_payload.get("sub")` and `UserRepository(db).get(user_id)`.
- If the frontend **never** calls `POST /auth/sync` after login, the backend has **no** row for that user → returns **401** “User … not synchronized” → no nodes, no dashboard data.

**Fix:** After successful Supabase `signInWithPassword`, call `POST /api/v1/auth/sync` (using the same API client so the Supabase token is attached). Optionally also call sync when restoring session on app load.

---

### 2.4 Backend bug: missing `User` import in nodes endpoint

- In `server/app/api/api_v1/endpoints/nodes.py`, for dev-bypass users the code does `current_user = User(...)`. The class `User` is **not** imported → **NameError** when a dev-bypass user hits `/nodes/`, so the request fails even if the token is sent.

**Fix:** Add `from app.models.all_models import User` in `nodes.py`.

---

### 2.5 Community filter (empty list even when DB has data)

- For non–superadmin users, nodes are filtered by `current_user.community_id`. If the user’s `community_id` does not match any node’s `community_id`, the list is **empty** even though the DB has nodes.
- Seeder uses `community_id="comm_myhome"`. Sync and dev-bypass also use `comm_myhome`. So this is only an issue if users or nodes use different community IDs.

**Recommendation:** Ensure synced and dev-bypass users have a `community_id` that matches the nodes you expect to see (e.g. `comm_myhome`). For superadmin, no filter is applied.

---

### 2.6 Health endpoint path

- Frontend calls `api.get('/health')` → `GET /api/v1/health`.
- Backend mounts health router with `prefix="/health"` and route `@router.get("/")` → full path is `/api/v1/health/`. Some clients may require a trailing slash. If you see 404/307 on health, add the trailing slash in the client or ensure redirect is followed.

---

## 3. What must be true for “data in Supabase” to show on the dashboard

1. **Backend** uses **Supabase Postgres**: `DATABASE_URL` in `server/.env` = Supabase connection string (with `postgresql+asyncpg://`).
2. **Schema exists** in that DB: Backend runs `create_tables()` on startup (already in `main.py`), so tables are created in the DB pointed to by `DATABASE_URL`. If you previously created tables manually in Supabase, ensure names/columns match the SQLAlchemy models (e.g. `nodes`, `users_profiles`, etc.).
3. **Data exists** in that same DB: Either run the backend once so `seed_db()` runs (when DB is empty), or insert/migrate data into the same database the backend uses.
4. **Auth**:
   - **Dev bypass:** Frontend sends `Authorization: Bearer <dev-bypass-id>`; backend accepts it and either finds or auto-creates the user (with `User` imported).
   - **Supabase login:** Frontend sends Supabase JWT; backend verifies it; frontend has called `POST /auth/sync` so the user exists in the backend DB and has a valid `community_id`.
5. **Dashboard** calls only backend APIs (`/nodes/`, `/dashboard/stats`, `/dashboard/alerts`); no change needed to “fetch from Supabase” for nodes/stats/alerts—they all come from the backend DB.

---

## 4. Fix plan (concise)

| # | Item | Action |
|---|------|--------|
| 1 | Backend DB | Set `DATABASE_URL` in `server/.env` to Supabase Postgres URI; ensure `postgresql+asyncpg://` (session.py already converts). |
| 2 | API client (dev bypass) | In `api.ts`, if no `sb-*-auth-token`, read `evara_session` and if `user.id` starts with `dev-bypass-`, set `Authorization: Bearer <user.id>`. |
| 3 | Nodes endpoint | In `nodes.py`, add `from app.models.all_models import User`. |
| 4 | Auth sync | After successful Supabase login in AuthContext, call `api.post('/auth/sync')` so the backend has the user. |
| 5 | Health URL | If needed, use `api.get('/health/')` or ensure redirect is followed. |
| 6 | Optional | Add a small “backend sync” indicator or error message on the dashboard when 401 “not synchronized” is returned, and document that new users must log in once so sync runs. |

---

## 5. Environment checklist

### Backend (`server/.env`)

- `DATABASE_URL` = Supabase Postgres connection string (e.g. from Supabase Dashboard → Project Settings → Database; use “Connection string” and replace password).
- `SUPABASE_JWT_SECRET` = Supabase JWT secret (Project Settings → API → JWT Secret) so the backend can verify Supabase tokens.
- Optional: `SUPABASE_URL`, `SUPABASE_KEY` if you add server-side Supabase client usage later.

### Frontend (`client/.env` or `client/.env.local`)

- `VITE_SUPABASE_URL` = Supabase project URL.
- `VITE_SUPABASE_ANON_KEY` = Supabase anon key.
- `VITE_API_URL` = Backend API base (e.g. `http://localhost:8000/api/v1`).

---

## 6. Optional improvements (later)

- **Pipelines / alert rules:** Frontend calls `/pipelines/` and `/alerts/rules` but there are no matching backend routes; add them or stub them if the dashboard needs them.
- **Users API:** Backend users router is commented out; re-enable if you need user management via API.
- **Error handling:** In `useNodes` and dashboard services, surface 401 “not synchronized” so users know to log in again or run sync.
- **RLS:** If you ever read nodes or other app data directly from Supabase with the anon key, you’ll need RLS policies; currently app data is only read via the backend.

---

## 7. Summary

- **Why data isn’t visible:** (1) Backend is likely using SQLite instead of Supabase Postgres; (2) dev bypass sends no Bearer token so all auth-required calls return 401; (3) real Supabase login often skips `/auth/sync` so the backend has no user; (4) missing `User` import in nodes breaks dev-bypass.
- **What to do:** Point backend to Supabase Postgres, send Bearer for dev-bypass from `evara_session`, add `User` import in nodes, and call `POST /auth/sync` after Supabase login. After that, the same data you see in Supabase (in the same DB) will be returned by the backend and shown on the dashboard.

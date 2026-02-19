# Deep Analysis: Why Dashboard Data Is Not Visible (Backend + Supabase)

## Executive summary

The backend runs and data exists in Supabase, but the dashboard shows no (or wrong) data because of **where the backend reads from**, **how auth is sent**, and **one optional frontend/health quirk**. This document explains exactly what is wrong and what to fix.

---

## 1. Architecture (how data is supposed to flow)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND (React/Vite)                                                       │
│  - Login: Supabase Auth (JWT) OR Dev Bypass (mock user in evara_session)     │
│  - All dashboard data: from BACKEND API only (not from Supabase client)      │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                    Authorization: Bearer <JWT or dev-bypass-id>
                    GET /api/v1/nodes/, /dashboard/stats, /dashboard/alerts
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  BACKEND (FastAPI)                                                           │
│  - Verifies token (Supabase JWT or dev-bypass-*)                             │
│  - Reads/writes ONLY via SQLAlchemy → DATABASE_URL                           │
│  - Does NOT use Supabase JS client; “Supabase integration” = same DB + JWT   │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  DATABASE (whatever DATABASE_URL points to)                                  │
│  - Default in code: SQLite (./test.db)                                       │
│  - For “data in Supabase”: must be Supabase Postgres (same as Table Editor)  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Critical point:** “Data in Supabase” means rows in **Supabase’s Postgres**. The dashboard only shows data that the **backend** returns. The backend only sees the database in **`DATABASE_URL`**. If that is SQLite, the backend never sees Supabase’s data.

---

## 2. Root causes (what we are doing wrong)

### 2.1 Backend is using the wrong database (most likely)

**What we are doing wrong:** Relying on the default `DATABASE_URL` in code.

- In `server/app/core/config.py`:  
  `DATABASE_URL: str = "sqlite+aiosqlite:///./test.db"`
- If `server/.env` does **not** set `DATABASE_URL`, the backend uses **SQLite**.
- You see data in **Supabase Dashboard → Table Editor** (Supabase Postgres).
- The backend reads/writes **only** SQLite.
- **Result:** Backend is “running” and returns 200, but queries hit an empty (or different) DB, so the dashboard shows no data.

**What to do:** Set `DATABASE_URL` in `server/.env` to the **Supabase Postgres** connection string (URI). Use “Session” or “Transaction” pooler; replace `postgres://` with `postgresql+asyncpg://` (session.py already does this). Restart the server so seed/create_tables run against that DB.

---

### 2.2 Auth: no Bearer token sent (dev bypass)

**What we are doing wrong:** Assuming the dashboard “just works” after dev bypass login without checking that the backend receives a token.

- `/nodes/`, `/dashboard/stats`, `/dashboard/alerts` all require `get_current_user_token` (Bearer).
- The API client in `client/src/services/api.ts` attaches a token from:
  1. Supabase: `sb-*-auth-token` (access_token), or  
  2. Dev bypass: `evara_session.user.id` when it starts with `dev-bypass-`.
- If you use **dev bypass** (e.g. ritik@evaratech.com / evaratech@1010), there is **no** `sb-*-auth-token`. If the client does not send `Authorization: Bearer <dev-bypass-id>`, the backend returns **401** (or 403 if Bearer is missing) and the dashboard gets no nodes/stats/alerts.

**Current code:** Your `api.ts` already has the dev-bypass fallback. So this is only a problem if:
- `evara_session` is missing or malformed after login, or
- You are not actually logged in with dev bypass when testing.

**What to do:** Ensure after dev bypass login, `evara_session` exists and `user.id` starts with `dev-bypass-`. Then the interceptor will send `Authorization: Bearer <user.id>`. If you still get 401, check backend logs and `ENVIRONMENT` (see 2.5).

---

### 2.3 Real Supabase login: user not synced to backend

**What we are doing wrong:** Expecting the backend to know the user without ever creating a row in **its** DB.

- Backend resolves the user by `user_payload["sub"]` and then `UserRepository(db).get(user_id)`.
- That table is the **backend’s** `users_profiles` (the DB pointed to by `DATABASE_URL`), not Supabase Auth.
- If the frontend never calls `POST /api/v1/auth/sync` after Supabase login, the backend has **no** row for that user → returns **401** “User … not synchronized” → no nodes, no dashboard data.

**Current code:** Your `AuthContext` already calls `api.post('/auth/sync')` after Supabase sign-in and in session restore. So this is correct **if** the request actually runs and succeeds (same origin, CORS, and token attached).

**What to do:** After any Supabase login (and on app load when restoring session), ensure `POST /auth/sync` is called with the Supabase JWT attached. If you still get “not synchronized”, check backend DB has a row in `users_profiles` for that `sub` and that `community_id` matches nodes (e.g. `comm_myhome`).

---

### 2.4 Community filter (empty list even when DB has data)

**What we are doing wrong:** Ignoring that non–superadmin users only see nodes in **their** community.

- In `nodes.py`, non–superadmin users get:  
  `nodes = [n for n in all_nodes if n.community_id == current_user.community_id]`
- If the user’s `community_id` does not match any node’s `community_id`, the list is **empty** even though the DB has rows.
- Seeder and sync use `community_id="comm_myhome"`; nodes are seeded with `comm_myhome`. So this only bites if users or nodes use different community IDs.

**What to do:** Ensure synced and dev-bypass users have `community_id` that matches the nodes you expect (e.g. `comm_myhome`). Superadmin sees all nodes (no filter).

---

### 2.5 Dev bypass rejected in non-development

**What we are doing wrong:** Using dev bypass while the backend thinks it’s in production.

- In `server/app/core/security_supabase.py`, if the token starts with `dev-bypass-` and `settings.ENVIRONMENT != "development"`, the backend raises **401** “Dev Bypass not allowed in production”.
- Default in config is `ENVIRONMENT: str = "development"`. If you set `ENVIRONMENT=production` (or staging) in `server/.env`, dev bypass stops working.

**What to do:** For local/dev, keep `ENVIRONMENT=development` (or omit it). Do not set `ENVIRONMENT=production` when testing with dev bypass.

---

### 2.6 Health endpoint path (minor)

- Frontend calls `api.get('/health')` → `GET /api/v1/health`.
- Backend health route is registered with `prefix="/health"` and `@router.get("/")` → full path is **`/api/v1/health/`** (trailing slash).
- Some clients may 404 on `/api/v1/health` or require the trailing slash. If health fails, the dashboard might show “undefined” for DB/ThingSpeak.

**What to do:** Call `api.get('/health/')` (trailing slash) or ensure the backend also serves `GET /api/v1/health` (no slash). Optional.

---

### 2.7 Frontend does not call `/dashboard/stats`

- The dashboard page uses **nodes** from `useNodes()` (i.e. `GET /nodes/`) and derives “Total Assets”, “Tanks”, “Flow”, “Deep”, “Alerts” from that list.
- It also calls `getSystemHealth()` and `getActiveAlerts()` (`/dashboard/alerts`).
- It does **not** call `getDashboardStats()` (`/dashboard/stats`). So “data not visible” is not caused by missing `/dashboard/stats`; it’s caused by **empty or failed `/nodes/`** (and optionally failed health/alerts). Fixing nodes and auth fixes the dashboard.

---

## 3. What must be true for “data in Supabase” to show on the dashboard

1. **Backend uses Supabase Postgres**  
   `DATABASE_URL` in `server/.env` = Supabase connection string (`postgresql+asyncpg://...`).

2. **Schema and data in that DB**  
   Backend runs `create_tables()` and `seed_db()` on startup against `DATABASE_URL`. If you use Supabase Postgres, ensure you’re not also creating tables manually in Supabase with different names/columns; the backend expects its SQLAlchemy models (e.g. `nodes`, `users_profiles`).

3. **Auth**  
   - **Dev bypass:** Frontend sends `Authorization: Bearer <dev-bypass-id>`. Backend accepts it (and `ENVIRONMENT=development`). Backend auto-creates user in DB if missing.  
   - **Supabase login:** Frontend sends Supabase JWT; frontend has called `POST /auth/sync` so the user exists in the backend DB with a valid `community_id`.

4. **Dashboard only talks to the backend**  
   Nodes, stats, and alerts all come from backend APIs; no change needed to “fetch from Supabase” for dashboard data.

---

## 4. Fix checklist (concise)

| # | Item | Action |
|---|------|--------|
| 1 | Backend DB | Set `DATABASE_URL` in `server/.env` to Supabase Postgres URI; use `postgresql+asyncpg://`. |
| 2 | Dev bypass token | Confirm `api.ts` sends Bearer from `evara_session.user.id` when `user.id.startsWith('dev-bypass-')` (already implemented). |
| 3 | Auth sync | After Supabase login, ensure `POST /auth/sync` is called (already in AuthContext). |
| 4 | ENVIRONMENT | Keep `ENVIRONMENT=development` (or unset) when using dev bypass. |
| 5 | Health URL | If health fails, use `api.get('/health/')` or add a route without trailing slash. |
| 6 | Community | Ensure test users and nodes share the same `community_id` (e.g. `comm_myhome`). |

---

## 5. Optional improvements

- **Alerts rules:** Frontend calls `/alerts/rules` (get/create/delete); there are no such backend routes. Add or stub them if the dashboard needs alert rules.
- **User profile in Supabase:** `AuthContext` builds the displayed user from `supabase.from('users_profiles')`. If that table is empty, the UI might not show “logged in” even though API calls work. Optionally sync profile to Supabase or create it via trigger.
- **Error handling:** In `useNodes` and dashboard, surface 401 (“not synchronized”) so users know to log in again or run sync.
- **RLS:** If you ever read app data (e.g. nodes) directly from Supabase with the anon key, you’ll need RLS; currently app data is only read via the backend.

---

## 6. Summary: what is the problem?

- **Main problem:** Backend is almost certainly using **SQLite** (default) while the data you care about is in **Supabase Postgres**. So the backend “works” but returns empty (or different) data.
- **Secondary:** Auth must be correct: Bearer token sent (dev bypass or Supabase JWT), user present in backend DB (sync for Supabase), and for dev bypass `ENVIRONMENT=development`.
- **Tertiary:** Community filter and health URL are minor; fix them if you see empty lists despite DB having rows or health showing wrong/undefined.

**Next step:** Set `DATABASE_URL` in `server/.env` to your Supabase Postgres connection string, restart the server, then log in (dev bypass or Supabase with sync). The same data you see in Supabase Table Editor will then be returned by the backend and shown on the dashboard.

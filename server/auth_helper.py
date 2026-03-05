import asyncio
import base64
import logging
from concurrent.futures import ThreadPoolExecutor
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from typing import Dict, Any, Optional

from config import get_settings

settings = get_settings()
security = HTTPBearer()
logger = logging.getLogger(__name__)

# Dedicated threadpool for blocking/sync 3rd-party SDK calls.
# Keeps the default event loop executor free and limits concurrent blocking tasks.
_BLOCKING_EXECUTOR: ThreadPoolExecutor | None = None

def get_blocking_executor(max_workers: int = 12) -> ThreadPoolExecutor:
    global _BLOCKING_EXECUTOR
    if _BLOCKING_EXECUTOR is None:
        _BLOCKING_EXECUTOR = ThreadPoolExecutor(max_workers=max_workers)
    return _BLOCKING_EXECUTOR

# ── Module-level Supabase client (created once, not per-request) ─────────────
_supabase_client = None

def _get_supabase():
    global _supabase_client
    if _supabase_client is None:
        try:
            from supabase import create_client
            _supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
        except Exception as e:
            logger.error("[AUTH] Could not create Supabase client: %s", e)
    return _supabase_client


def _supabase_get_user_sync(token: str):
    """Synchronous wrapper — called via run_in_executor so we don't block the event loop."""
    sb = _get_supabase()
    if sb is None:
        raise RuntimeError("Supabase client not available")
    return sb.auth.get_user(jwt=token)

def verify_jwt(token: str) -> Dict[str, Any]:
    """
    Verify and decode a Supabase JWT token (HS256).
    Tries the raw secret first, then base64-decoded bytes — because the
    Supabase dashboard displays the JWT secret base64-encoded.
    """
    decode_opts = {"verify_aud": False, "leeway": 60}

    secrets_to_try = [settings.SUPABASE_JWT_SECRET]
    try:
        decoded_bytes = base64.b64decode(settings.SUPABASE_JWT_SECRET)
        secrets_to_try.append(decoded_bytes)
    except Exception:
        pass

    last_err = None
    for secret in secrets_to_try:
        try:
            return jwt.decode(token, secret, algorithms=["HS256"], options=decode_opts)
        except JWTError as e:
            last_err = e

    logger.warning("[AUTH] JWT verification failed: %s", type(last_err).__name__)
    logger.error("[AUTH] Both raw and base64-decoded SUPABASE_JWT_SECRET failed — check server/.env")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

async def get_current_user(auth: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """
    Validate the bearer token and return the current user.
    Primary: supabase.auth.get_user(jwt=token) run in a thread pool (sync call).
    Fallback: local python-jose decode with raw and base64-decoded JWT secret.
    """
    token = auth.credentials

    # ── Primary: Supabase server-side token validation ───────────────────────
    # supabase-py 2.x auth methods are synchronous — run in executor so we
    # don't block asyncio's event loop.
    try:
        loop = asyncio.get_event_loop()
        # Use bounded executor and guard with a short timeout so slow Supabase
        # calls don't hang the request forever or exhaust the default pool.
        executor = get_blocking_executor()
        resp_task = loop.run_in_executor(executor, _supabase_get_user_sync, token)
        resp = await asyncio.wait_for(resp_task, timeout=8.0)
        if resp and resp.user:
            u = resp.user
            app_meta  = u.app_metadata  or {}
            user_meta = u.user_metadata or {}
            role = (app_meta.get("role") or user_meta.get("role") or "customer")
            logger.debug("[AUTH] Supabase API validated user %s role=%s", u.id, role)
            return {
                "id":    str(u.id),
                "email": u.email,
                "role":  role.lower(),
            }
    except Exception as supabase_err:
        logger.warning("[AUTH] Supabase API validation failed — falling back to local decode: %s", supabase_err)

    # ── Fallback: local JWT decode ───────────────────────────────────────────
    payload  = verify_jwt(token)
    user_id  = payload.get("sub")
    app_meta  = payload.get("app_metadata")  or {}
    user_meta = payload.get("user_metadata") or {}
    role = (
        app_meta.get("role")
        or user_meta.get("role")
        or payload.get("role")
        or "customer"
    )

    if not user_id and role != "service_role":
        logger.warning("[AUTH] Token accepted but missing 'sub' claim")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload: missing sub",
        )

    return {
        "id":    user_id or "service-account",
        "email": payload.get("email"),
        "role":  role.lower(),
    }

async def requires_superadmin(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Require superadmin privileges.
    Uses the `superadmin` DB table as source of truth — NOT JWT claims.
    """
    from sqlalchemy import text
    from database import SessionLocal

    user_id = user.get("id", "")

    # service_role tokens (ingestion service / internal tooling) get full access
    if user.get("role") == "service_role" or user_id == "service-account":
        return {**user, "role": "superadmin"}

    # IMPORTANT: use CAST(:uid AS uuid) — the ":uid::uuid" syntax triggers a
    # PostgreSQL syntax error when asyncpg substitutes the positional parameter.
    async with SessionLocal() as db:
        result = await db.execute(
            text("""
                SELECT 1 FROM public.superadmin
                WHERE id = CAST(:uid AS uuid)
                UNION ALL
                SELECT 1 FROM public.customers
                WHERE id = CAST(:uid AS uuid)
                  AND role IN ('superadmin', 'super_admin')
                LIMIT 1
            """),
            {"uid": user_id},
        )
        is_admin = result.fetchone() is not None

    if not is_admin:
        logger.warning("[AUTH] User %s is not superadmin", user_id)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superadmin role required",
        )
    return {**user, "role": "superadmin"}

async def get_optional_user(
    auth: HTTPAuthorizationCredentials = Depends(HTTPBearer(auto_error=False))
) -> Optional[Dict[str, Any]]:
    """Return current user if a valid token is present, otherwise None."""
    if not auth:
        return None

    # Try Supabase API first
    try:
        loop = asyncio.get_event_loop()
        resp = await loop.run_in_executor(None, _supabase_get_user_sync, auth.credentials)
        if resp and resp.user:
            u = resp.user
            app_meta  = u.app_metadata  or {}
            user_meta = u.user_metadata or {}
            role = (app_meta.get("role") or user_meta.get("role") or "customer")
            return {"id": str(u.id), "email": u.email, "role": role.lower()}
    except Exception:
        pass

    # Fallback: local decode
    try:
        payload   = verify_jwt(auth.credentials)
        user_id   = payload.get("sub")
        app_meta  = payload.get("app_metadata")  or {}
        user_meta = payload.get("user_metadata") or {}
        role = (
            app_meta.get("role") or user_meta.get("role")
            or payload.get("role") or "customer"
        )
        return {
            "id":    user_id or "anonymous",
            "email": payload.get("email"),
            "role":  role.lower() if isinstance(role, str) else role,
        }
    except Exception:
        return None


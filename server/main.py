from fastapi import FastAPI, Depends, Request
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from app.api.api_v1.api import api_router
from app.core.logging import setup_logging
from app.db.session import create_tables
from app.core.background import start_background_tasks
from app.services.seeder import seed_db
from app.core.security_supabase import get_current_user_token
from app.core.errors import http_exception_handler, validation_exception_handler, general_exception_handler

from app.core.config import get_settings
from collections import defaultdict
import time
import asyncio

settings = get_settings()

# Phase 22: Enhanced API Documentation
app = FastAPI(
    title="EvaraTech IoT Platform API",
    version="2.0.0",
    description="""
## EvaraTech Water Infrastructure Management System

This API provides endpoints for:
- **Device Management**: CRUD operations for IoT nodes (Sensors, Pumps, Tanks)
- **Telemetry**: Real-time sensor data ingestion and retrieval
- **Dashboard**: Aggregated statistics and system health
- **Administration**: User, Community, and Distributor management
- **Authentication**: Supabase JWT-based auth with RBAC

### Authentication
All endpoints require a valid Bearer token. Use the Supabase login flow or dev-bypass tokens for testing.
    """,
    contact={"name": "EvaraTech Engineering", "email": "dev@evaratech.com"},
    license_info={"name": "Proprietary"},
    openapi_tags=[
        {"name": "auth", "description": "Authentication & User Sync"},
        {"name": "nodes", "description": "Device/Node Management"},
        {"name": "dashboard", "description": "Dashboard Statistics"},
        {"name": "admin", "description": "Administration Panel"},
        {"name": "devices", "description": "Device Configuration"},
        {"name": "health", "description": "System Health Checks"},
        {"name": "websockets", "description": "Real-time WebSocket Events"},
    ]
)

# Register Global Exception Handlers
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

# Configure CORS to allow requests from the React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"]) # In prod, restrict this!

# ─── RATE LIMITING MIDDLEWARE ───
class RateLimiter:
    def __init__(self, requests_per_minute: int = 60):
        self.requests_per_minute = requests_per_minute
        self.history = defaultdict(list)

    async def is_allowed(self, identity: str) -> bool:
        now = time.time()
        # Clean old records
        self.history[identity] = [t for t in self.history[identity] if now - t < 60]
        if len(self.history[identity]) >= self.requests_per_minute:
            return False
        self.history[identity].append(now)
        return True

admin_limiter = RateLimiter(requests_per_minute=30) # Strict for admin

@app.middleware("http")
async def rate_limit_middleware(request, call_next):
    from fastapi import Response
    
    # Phase 23: Rate Limiting for sensitive endpoints
    if request.url.path.startswith("/api/v1/admin") or request.url.path.startswith("/api/v1/auth"):
        client_ip = request.client.host if request.client else "unknown"
        if not await admin_limiter.is_allowed(client_ip):
            return Response(
                content='{"status":"error","message":"Rate limit exceeded. Please try again in a minute."}',
                status_code=429,
                media_type="application/json"
            )
            
    return await call_next(request)

@app.middleware("http")
async def log_requests(request, call_next):
    from fastapi import Request
    import time
    start_time = time.time()
    
    path = request.url.path
    method = request.method
    auth = request.headers.get("Authorization", "No Auth")
    
    response = await call_next(request)
    
    process_time = (time.time() - start_time) * 1000
    print(f"REQUEST: {method} {path} | Auth: {auth[:20]}... | Status: {response.status_code} | Time: {process_time:.2f}ms")
    
    return response

app.include_router(api_router, prefix="/api/v1")

# Setup logging
logger = setup_logging()

@app.on_event("startup")
async def startup_event():
    logger.info("Starting EvaraTech Backend...")
    startup_time = time.time()
    
    # P43: Run startup health checks
    checks = {}
    
    # Check 1: Database connection
    try:
        await create_tables()
        checks["database"] = "[OK] Connected"
    except Exception as e:
        checks["database"] = f"[ERROR] Failed: {e}"
        logger.error(f"DB startup check failed: {e}")
    
    # Check 2: Required env vars
    required_vars = ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_JWT_SECRET"]
    missing = [v for v in required_vars if not getattr(settings, v.lower(), None) and not getattr(settings, v, None)]
    checks["env_vars"] = "[OK] All present" if not missing else f"[WARN] Missing: {missing}"
    
    # Check 3: Supabase Auth endpoint
    try:
        import httpx
        async with httpx.AsyncClient(timeout=3) as client:
            resp = await client.get(f"{settings.SUPABASE_URL}/auth/v1/settings")
            checks["supabase_auth"] = f"[OK] Reachable (HTTP {resp.status_code})"
    except Exception as e:
        checks["supabase_auth"] = f"[WARN] Unreachable: {e}"
    
    # Check 4: ThingSpeak API (non-critical)
    try:
        import httpx
        async with httpx.AsyncClient(timeout=3) as client:
            resp = await client.get("https://api.thingspeak.com/channels/public.json?page=1")
            checks["thingspeak"] = f"[OK] Reachable (HTTP {resp.status_code})"
    except Exception as e:
        checks["thingspeak"] = f"[WARN] Unreachable (non-critical): {e}"
    
    # Log all checks
    logger.info("=== STARTUP HEALTH CHECKS ===")
    for name, status in checks.items():
        logger.info(f"  {name}: {status}")
    logger.info("=============================")
    
    # Store startup time for uptime calculation 
    app.state.startup_time = startup_time
    app.state.health_checks = checks
    
    try:
        await seed_db()
        await start_background_tasks()
        logger.info("Background tasks started.")
    except Exception as e:
        logger.error(f"Startup task failed (DB might be unreachable): {e}")

# P44: Graceful shutdown
@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down EvaraTech Backend...")
    try:
        from app.db.session import engine
        await engine.dispose()
        logger.info("Database connections closed.")
    except Exception as e:
        logger.error(f"Shutdown error: {e}")

# P45: Comprehensive system status endpoint
@app.get("/health")
async def health_check():
    from sqlalchemy import text
    from app.db.session import engine
    
    # Database check
    db_status = "ok"
    db_latency_ms = None
    try:
        start = time.time()
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db_latency_ms = round((time.time() - start) * 1000, 1)
    except Exception as e:
        db_status = f"error: {e}"
    
    # Uptime
    uptime_seconds = round(time.time() - getattr(app.state, 'startup_time', time.time()))
    
    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "database": {"status": db_status, "latency_ms": db_latency_ms},
        "uptime_seconds": uptime_seconds,
        "startup_checks": getattr(app.state, 'health_checks', {}),
        "version": "2.0.0"
    }


@app.get("/")
async def root():
    return {"message": "Welcome to EvaraTech Backend API. Docs at /docs"}

# Phase 27: Metrics endpoint
@app.get("/metrics", tags=["health"])
async def get_metrics():
    """Return system performance metrics."""
    from app.middleware.monitoring import metrics
    return metrics.get_summary()

# Phase 24: Feature Flags endpoint
@app.get("/api/v1/feature-flags", tags=["health"])
async def get_feature_flags():
    """Return current feature flag states."""
    from app.core.feature_flags import FeatureFlags
    return {"flags": FeatureFlags.get_all_flags()}

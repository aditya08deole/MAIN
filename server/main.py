from fastapi import FastAPI, Depends, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime
import asyncio

# Local imports
from config import get_settings
from database import get_db, init_db, engine
from schemas import HealthResponse
from logger import setup_logger
# from performance import metrics, get_performance_report, check_slow_queries, check_slow_endpoints
from thingspeak import get_thingspeak_client

settings = get_settings()
logger = setup_logger(__name__, settings.LOG_LEVEL)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="EvaraTech IoT Platform Backend",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Request Logging Middleware ──────────────────────────────────────────

@app.middleware("http")
async def log_requests(request, call_next):
    import time
    start_time = time.time()
    response = await call_next(request)
    duration = round((time.time() - start_time) * 1000, 2)
    response.headers["X-Process-Time"] = str(duration)
    return response

# ─── Lifecycle ───────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    # await init_db() # Schema managed via migrations
    print(f"EvaraTech IoT Backend Started | Env: {settings.ENVIRONMENT}")

@app.on_event("shutdown")
async def shutdown_event():
    ts = get_thingspeak_client()
    await ts.close()
    await engine.dispose()
    print("EvaraTech IoT Backend Shutdown")


# ─── Root & Health Endpoints ─────────────────────────────────────────────

@app.get("/", tags=["root"])
async def root():
    """Root endpoint with API information."""
    return {
        "message": "EvaraTech Backend API",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
        "docs": "/docs",
        "health": "/health",
        "api_prefix": "/api/v1",
    }


@app.get("/config-check", tags=["root"])
async def config_check():
    """Check if critical environment variables are configured (values NOT exposed)."""
    import os
    return {
        "database_url_set": bool(os.getenv("DATABASE_URL")),
        "supabase_url_set": bool(os.getenv("SUPABASE_URL")),
        "supabase_jwt_secret_set": bool(os.getenv("SUPABASE_JWT_SECRET")),
        "supabase_key_set": bool(os.getenv("SUPABASE_KEY")),
        "cors_origins_set": bool(os.getenv("CORS_ORIGINS")),
        "environment": settings.ENVIRONMENT,
        "note": "If any value is false, add it to Render environment variables",
    }


@app.get("/health", response_model=HealthResponse, tags=["health"])
async def health_check():
    """Comprehensive system health check endpoint."""
    import time
    import asyncio

    db_status = "ok"
    thingspeak_status = "ok"
    overall_status = "ok"

    try:
        start_time = time.time()

        async def check_db():
            async with engine.connect() as conn:
                result = await conn.execute(text("SELECT 1"))
                result.fetchone()

        await asyncio.wait_for(check_db(), timeout=15.0)
        response_time = round((time.time() - start_time) * 1000, 2)
        if response_time > 3000:
            db_status = "slow"
            overall_status = "degraded"
    except asyncio.TimeoutError:
        db_status = "error: timeout"
        overall_status = "critical"
        thingspeak_status = "unknown"
    except Exception as e:
        db_status = f"error: {str(e)[:100]}"
        overall_status = "critical"
        thingspeak_status = "unknown"

    try:
        ts = get_thingspeak_client()
        thingspeak_status = "ok" if ts else "not_initialized"
    except Exception:
        thingspeak_status = "error"

    return HealthResponse(
        status=overall_status,
        database=db_status,
        timestamp=datetime.utcnow(),
        services={"database": db_status, "thingspeak": thingspeak_status},
    )


# ─── Include Domain Routers ─────────────────────────────────────────────
from routers import admin, telemetry, stats

api_router = APIRouter()
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(telemetry.router)
api_router.include_router(stats.router)

# Mount all API routes under /api/v1
app.include_router(api_router, prefix="/api/v1")


# ─── Debug Endpoints (Development Only) ─────────────────────────────────

if settings.ENVIRONMENT == "development":

    @app.get("/debug/db-status", tags=["debug"])
    async def debug_db_status(db: AsyncSession = Depends(get_db)):
        """Check database connection and table status."""
        try:
            await db.execute(text("SELECT 1"))
            profile_count = await db.execute(text("SELECT COUNT(*) FROM profiles"))
            device_count = await db.execute(text("SELECT COUNT(*) FROM devices"))
            return {"status": "ok", "tables": {"profiles": profile_count.scalar(), "device": device_count.scalar()}}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    @app.get("/debug/performance", tags=["debug"])
    async def debug_performance():
        """Get performance metrics and identify slow queries/endpoints."""
        return {"status": "not_implemented", "message": "Performance module is disabled in this environment."}


# ─── Main ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

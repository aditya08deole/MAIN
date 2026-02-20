"""
EvaraTech IoT Platform - Production-Grade FastAPI Application

Architecture:
- Clean separation of concerns (Controller/Service/Repository)
- SOLID principles throughout
- Dependency injection for testability
- Factory pattern for application construction
- Middleware-based cross-cutting concerns
"""
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from app.core.application import ApplicationFactory
from app.core.logging import setup_logging
from app.core.config import get_settings
from app.middleware.core_middleware import (
    create_request_logging_middleware,
    create_rate_limit_middleware
)
from sqlalchemy import text
import time

# Initialize logging
logger = setup_logging()
settings = get_settings()

# Create application using factory pattern
app, app_state, lifecycle = ApplicationFactory.create_app()


# ═══════════════════════════════════════════════════════════════════════════
# MIDDLEWARE REGISTRATION
# ═══════════════════════════════════════════════════════════════════════════

# Request logging middleware (structured logging with metrics)
request_logger = create_request_logging_middleware(log_auth=False)

@app.middleware("http")
async def request_logging(request: Request, call_next):
    """Log all requests with performance metrics."""
    return await request_logger(request, call_next)


# Rate limiting middleware (token bucket algorithm)
rate_limiter = create_rate_limit_middleware({
    "/api/v1/admin": {"requests_per_minute": 30, "burst_capacity": 50},
    "/api/v1/auth": {"requests_per_minute": 20, "burst_capacity": 30}
})

@app.middleware("http")
async def rate_limiting(request: Request, call_next):
    """Apply rate limits to sensitive endpoints."""
    return await rate_limiter(request, call_next)

# ═══════════════════════════════════════════════════════════════════════════
# HEALTH & STATUS ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/health", tags=["health"])
async def health_check():
    """
    Comprehensive system health check endpoint.
    Returns detailed status of all system components.
    Compatible with frontend SystemHealth interface.
    """
    from app.db.session import engine
    import httpx
    
    # Initialize status
    db_status = "unknown"
    thingspeak_status = "unknown"
    overall_status = "ok"
    
    # 1. Database connectivity check
    try:
        start = time.time()
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception as e:
        db_status = "error"
        overall_status = "critical"
        logger.error(f"Health check database error: {e}")
    
    # 2. ThingSpeak connectivity check
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get("https://api.thingspeak.com/channels/public.json", timeout=2.0)
            if resp.status_code == 200:
                thingspeak_status = "ok"
            else:
                thingspeak_status = "degraded"
    except Exception as e:
        thingspeak_status = "error"
        logger.warning(f"ThingSpeak health check failed: {e}")
    
    # 3. Get application state
    health_summary = app_state.get_health_summary()
    
    # Return structure matching frontend SystemHealth interface
    return {
        "status": overall_status if db_status == "ok" else "critical",
        "version": "2.0.0",
        "uptime_seconds": health_summary["uptime_seconds"],
        "services": {
            "database": db_status,
            "thingspeak": thingspeak_status
        },
        "startup_checks": health_summary["startup_checks"]
    }


@app.get("/", tags=["health"])
async def root():
    """Root endpoint with API information."""
    return {
        "message": "EvaraTech IoT Platform API",
        "version": "2.0.0",
        "documentation": "/docs",
        "health": "/health"
    }


@app.get("/metrics", tags=["health"])
async def get_metrics():
    """
    System performance metrics endpoint.
    Returns aggregated metrics from monitoring middleware.
    """
    try:
        from app.middleware.monitoring import metrics
        return metrics.get_summary()
    except ImportError:
        return {
            "status": "metrics_not_configured",
            "message": "Monitoring middleware not initialized"
        }


@app.get("/api/v1/feature-flags", tags=["health"])
async def get_feature_flags():
    """
    Feature flags configuration endpoint.
    Returns current state of all feature toggles.
    """
    from app.core.feature_flags import FeatureFlags
    return {
        "flags": FeatureFlags.get_all_flags()
    }

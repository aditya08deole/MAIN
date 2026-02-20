"""
EvaraTech Backend - Simplified Production-Ready API
===================================================

A clean, maintainable FastAPI backend with:
- Supabase authentication
- Device registry (CRUD)
- ThingSpeak telemetry integration
- Health monitoring

All routes in one file for simplicity and clarity.
"""
from fastapi import FastAPI, Depends, HTTPException, status, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text, func
from typing import List
from datetime import datetime
import uuid

# Local imports
from config import get_settings
from database import get_db, init_db, engine
from models import User, Device
from schemas import (
    UserResponse,
    DeviceCreate,
    DeviceUpdate,
    DeviceResponse,
    TelemetryResponse,
    HealthResponse
)
from supabase_auth import get_current_user, get_user_id, get_user_email
from thingspeak import get_thingspeak_client

# Initialize settings
settings = get_settings()

# Create FastAPI application
app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Simplified EvaraTech IoT Platform Backend",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Create API Router for versioned endpoints
api_router = APIRouter()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add request logging middleware
@app.middleware("http")
async def log_requests(request, call_next):
    """Log all requests with timing information."""
    import time
    
    start_time = time.time()
    
    try:
        response = await call_next(request)
        process_time = round((time.time() - start_time) * 1000, 2)
        
        # Log request
        print(f"[{response.status_code}] {request.method} {request.url.path} - {process_time}ms")
        
        # Add custom headers
        response.headers["X-Process-Time"] = str(process_time)
        return response
        
    except Exception as e:
        process_time = round((time.time() - start_time) * 1000, 2)
        print(f"[ERROR] {request.method} {request.url.path} - {process_time}ms - {str(e)}")
        raise

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Handle unexpected exceptions gracefully."""
    print(f"[UNHANDLED ERROR] {request.method} {request.url.path} - {type(exc).__name__}: {str(exc)}")
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Internal server error",
            "type": type(exc).__name__,
            "path": str(request.url.path)
        }
    )


# ============================================================================
# APPLICATION LIFECYCLE
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Initialize application on startup with comprehensive error handling."""
    print("=" * 80)
    print("🚀 STARTING EVARATECH BACKEND (SIMPLIFIED & OPTIMIZED)")
    print("=" * 80)
    print(f"Environment: {settings.ENVIRONMENT}")
    print(f"Project: {settings.PROJECT_NAME}")
    print(f"CORS Origins: {len(settings.cors_origins_list)} configured")
    print("=" * 80)
    
    startup_errors = []
    
    try:
        # Initialize database tables with retry logic
        await init_db()
        
        # Test database connection
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            print("[OK] Database connection verified")
            
            # Show pool stats (PostgreSQL only)
            try:
                if hasattr(engine.pool, 'size'):
                    print(f"[OK] Connection pool: size={engine.pool.size()}, checked_out={engine.pool.checkedout()}")
                else:
                    print("[OK] Using SQLite (no connection pooling)")
            except:
                pass  # Ignore pool stats errors
                
        except Exception as e:
            startup_errors.append(f"Database connection test failed: {e}")
            print(f"[ERROR] Database connection test failed: {e}")
        
    except Exception as e:
        startup_errors.append(f"Database initialization failed: {e}")
        print(f"[ERROR] Database initialization failed: {e}")
    
    # Verify ThingSpeak connectivity
    try:
        thingspeak = get_thingspeak_client()
        print("[OK] ThingSpeak client initialized")
    except Exception as e:
        startup_errors.append(f"ThingSpeak client initialization failed: {e}")
        print(f"[WARN] ThingSpeak client initialization failed: {e}")
    
    print("=" * 80)
    if startup_errors:
        print("⚠️  STARTUP COMPLETED WITH WARNINGS")
        for error in startup_errors:
            print(f"   - {error}")
    else:
        print("✅ STARTUP COMPLETE - ALL SYSTEMS OPERATIONAL")
    print(f"📚 API Documentation: http://localhost:8000/docs")
    print(f"📊 Health Check: http://localhost:8000/health")
    print("=" * 80)


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown with proper resource disposal."""
    print("\n" + "=" * 80)
    print("👋 Shutting down EvaraTech Backend...")
    print("=" * 80)
    
    # Close ThingSpeak client
    try:
        thingspeak = get_thingspeak_client()
        await thingspeak.close()
        print("[OK] ThingSpeak client closed")
    except Exception as e:
        print(f"[WARN] Error closing ThingSpeak client: {e}")
    
    # Dispose database engine
    try:
        await engine.dispose()
        print("[OK] Database connections closed")
    except Exception as e:
        print(f"[WARN] Error disposing database engine: {e}")
    
    print("=" * 80)
    print("✅ Shutdown complete")
    print("=" * 80)


# ============================================================================
# ROOT & HEALTH ENDPOINTS
# ============================================================================

@app.get("/", tags=["root"])
async def root():
    """Root endpoint with API information."""
    return {
        "message": "EvaraTech Backend API",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
        "docs": "/docs",
        "health": "/health",
        "api_prefix": "/api/v1"
    }


@app.get("/config-check", tags=["root"])
async def config_check():
    """
    Check if critical environment variables are configured.
    Does NOT expose sensitive values - only shows if they exist.
    """
    import os
    return {
        "database_url_set": bool(os.getenv("DATABASE_URL")),
        "supabase_url_set": bool(os.getenv("SUPABASE_URL")),
        "supabase_jwt_secret_set": bool(os.getenv("SUPABASE_JWT_SECRET")),
        "supabase_key_set": bool(os.getenv("SUPABASE_KEY")),
        "cors_origins_set": bool(os.getenv("CORS_ORIGINS")),
        "environment": settings.ENVIRONMENT,
        "note": "If any value is false, add it to Render environment variables"
    }


@app.get("/health", response_model=HealthResponse, tags=["health"])
async def health_check():
    """
    Comprehensive system health check endpoint.
    Tests database connectivity and returns detailed system status.
    """
    db_status = "ok"
    thingspeak_status = "ok"
    overall_status = "ok"
    
    # Database health check with timeout
    try:
        import time
        import asyncio
        start_time = time.time()
        
        # Add 5 second timeout for health check
        async with asyncio.timeout(5):
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
        
        response_time = round((time.time() - start_time) * 1000, 2)  # ms
        
        if response_time > 1000:
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
    
    # ThingSpeak health check (lightweight)
    try:
        # Just check if client can be initialized, don't make actual API call
        thingspeak = get_thingspeak_client()
        if thingspeak:
            thingspeak_status = "ok"
        else:
            thingspeak_status = "not_initialized"
    except Exception:
        thingspeak_status = "error"
    
    return HealthResponse(
        status=overall_status,
        database=db_status,
        timestamp=datetime.utcnow(),
        services={
            "database": db_status,
            "thingspeak": thingspeak_status
        }
    )


# ============================================================================
# DASHBOARD ENDPOINTS
# ============================================================================

@api_router.get("/dashboard/stats", tags=["dashboard"])
async def get_dashboard_stats(
    user_payload: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get dashboard overview statistics.
    Returns total nodes, online nodes, and active alerts count.
    """
    user_id = get_user_id(user_payload)
    
    # Count total nodes for this user
    total_result = await db.execute(
        select(func.count(Device.id)).where(Device.user_id == user_id)
    )
    total_nodes = total_result.scalar() or 0
    
    # Count online nodes (status = 'online')
    online_result = await db.execute(
        select(func.count(Device.id)).where(
            Device.user_id == user_id,
            Device.status == 'online'
        )
    )
    online_nodes = online_result.scalar() or 0
    
    # TODO: Implement alerts system
    active_alerts = 0
    
    return {
        "total_nodes": total_nodes,
        "online_nodes": online_nodes,
        "active_alerts": active_alerts
    }


# ============================================================================
# AUTHENTICATION ENDPOINTS
# ============================================================================

@api_router.post("/auth/sync", response_model=UserResponse, tags=["authentication"])
async def sync_user_profile(
    user_payload: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Sync Supabase user to local database.
    
    Called by frontend after Supabase login to ensure backend has user profile.
    Creates user if doesn't exist, updates if changed.
    """
    user_id = get_user_id(user_payload)
    email = get_user_email(user_payload)
    
    # Check if user exists
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        # Create new user
        user = User(
            id=user_id,
            email=email,
            display_name=email.split("@")[0],  # Default display name
            role="customer"
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        print(f"[INFO] Created new user: {email}")
    else:
        # Update email if changed
        if user.email != email:
            user.email = email
            await db.commit()
            await db.refresh(user)
    
    return user


@api_router.get("/auth/me", response_model=UserResponse, tags=["authentication"])
async def get_current_user_profile(
    user_payload: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current authenticated user's profile."""
    user_id = get_user_id(user_payload)
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found. Please sync your profile first."
        )
    
    return user


# ============================================================================
# DEVICE MANAGEMENT ENDPOINTS
# ============================================================================

@api_router.get("/devices", response_model=List[DeviceResponse], tags=["devices"])
async def list_devices(
    user_payload: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all devices owned by the current user.
    """
    user_id = get_user_id(user_payload)
    
    result = await db.execute(
        select(Device).where(Device.user_id == user_id).order_by(Device.created_at.desc())
    )
    devices = result.scalars().all()
    
    return devices


@api_router.post("/devices", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED, tags=["devices"])
async def create_device(
    device_in: DeviceCreate,
    user_payload: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new device.
    
    The node_key must be unique across all devices.
    """
    user_id = get_user_id(user_payload)
    
    # Check if node_key already exists
    result = await db.execute(
        select(Device).where(Device.node_key == device_in.node_key)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Device with node_key '{device_in.node_key}' already exists"
        )
    
    # Create device
    device = Device(
        id=str(uuid.uuid4()),
        user_id=user_id,
        **device_in.dict()
    )
    db.add(device)
    await db.commit()
    await db.refresh(device)
    
    print(f"[INFO] Created device: {device.label} ({device.node_key})")
    return device


@api_router.get("/devices/{device_id}", response_model=DeviceResponse, tags=["devices"])
async def get_device(
    device_id: str,
    user_payload: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific device by ID."""
    user_id = get_user_id(user_payload)
    
    result = await db.execute(
        select(Device).where(Device.id == device_id, Device.user_id == user_id)
    )
    device = result.scalar_one_or_none()
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )
    
    return device


@api_router.put("/devices/{device_id}", response_model=DeviceResponse, tags=["devices"])
async def update_device(
    device_id: str,
    device_in: DeviceUpdate,
    user_payload: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a device's information."""
    user_id = get_user_id(user_payload)
    
    # Get device
    result = await db.execute(
        select(Device).where(Device.id == device_id, Device.user_id == user_id)
    )
    device = result.scalar_one_or_none()
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )
    
    # Update fields
    update_data = device_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(device, field, value)
    
    device.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(device)
    
    print(f"[INFO] Updated device: {device.label} ({device.node_key})")
    return device


@api_router.delete("/devices/{device_id}", status_code=status.HTTP_200_OK, tags=["devices"])
async def delete_device(
    device_id: str,
    user_payload: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a device."""
    user_id = get_user_id(user_payload)
    
    # Get device
    result = await db.execute(
        select(Device).where(Device.id == device_id, Device.user_id == user_id)
    )
    device = result.scalar_one_or_none()
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )
    
    await db.delete(device)
    await db.commit()
    
    print(f"[INFO] Deleted device: {device.label} ({device.node_key})")
    return {"message": "Device deleted successfully", "device_id": device_id}


# ============================================================================
# NODE ENDPOINTS (Aliases for /devices endpoints)
# Frontend uses /nodes/ terminology
# ============================================================================

@api_router.get("/nodes", response_model=List[DeviceResponse], tags=["nodes"])
async def list_nodes(
    user_payload: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all nodes (alias for list_devices).
    Frontend compatibility endpoint.
    """
    return await list_devices(user_payload=user_payload, db=db)


@api_router.get("/nodes/{node_id}", response_model=DeviceResponse, tags=["nodes"])
async def get_node(
    node_id: str,
    user_payload: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a single node by ID (alias for get_device).
    Frontend compatibility endpoint.
    """
    return await get_device(device_id=node_id, user_payload=user_payload, db=db)


@api_router.post("/nodes", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED, tags=["nodes"])
async def create_node(
    device_in: DeviceCreate,
    user_payload: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new node (alias for create_device).
    Frontend compatibility endpoint.
    """
    return await create_device(device_in=device_in, user_payload=user_payload, db=db)


@api_router.patch("/nodes/{node_id}", response_model=DeviceResponse, tags=["nodes"])
async def update_node(
    node_id: str,
    device_in: DeviceUpdate,
    user_payload: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a node (alias for update_device).
    Frontend compatibility endpoint.
    """
    return await update_device(device_id=node_id, device_in=device_in, user_payload=user_payload, db=db)


@api_router.delete("/nodes/{node_id}", status_code=status.HTTP_200_OK, tags=["nodes"])
async def delete_node(
    node_id: str,
    user_payload: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a node (alias for delete_device).
    Frontend compatibility endpoint.
    """
    return await delete_device(device_id=node_id, user_payload=user_payload, db=db)


# ============================================================================
# THINGSPEAK TELEMETRY ENDPOINTS
# ============================================================================

@api_router.get("/devices/{device_id}/telemetry/latest", response_model=TelemetryResponse, tags=["telemetry"])
async def get_latest_telemetry(
    device_id: str,
    user_payload: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get latest telemetry data from ThingSpeak for a device.
    
    Device must have thingspeak_channel_id configured.
    """
    user_id = get_user_id(user_payload)
    
    # Get device
    result = await db.execute(
        select(Device).where(Device.id == device_id, Device.user_id == user_id)
    )
    device = result.scalar_one_or_none()
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )
    
    if not device.thingspeak_channel_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Device has no ThingSpeak channel configured"
        )
    
    # Fetch from ThingSpeak
    thingspeak = get_thingspeak_client()
    data = await thingspeak.get_latest(
        device.thingspeak_channel_id,
        device.thingspeak_read_key
    )
    
    if not data:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to fetch data from ThingSpeak"
        )
    
    # Update last_seen
    device.last_seen = datetime.utcnow()
    await db.commit()
    
    return TelemetryResponse(
        timestamp=data.get("created_at", ""),
        data={
            "entry_id": data.get("entry_id"),
            "field1": data.get("field1"),
            "field2": data.get("field2"),
            "field3": data.get("field3"),
            "field4": data.get("field4"),
            "field5": data.get("field5"),
            "field6": data.get("field6"),
            "field7": data.get("field7"),
            "field8": data.get("field8"),
        }
    )


@api_router.get("/devices/{device_id}/telemetry/history", tags=["telemetry"])
async def get_telemetry_history(
    device_id: str,
    results: int = 100,
    user_payload: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get historical telemetry data from ThingSpeak for a device.
    
    Args:
        results: Number of data points to fetch (default 100, max 8000)
    """
    user_id = get_user_id(user_payload)
    
    # Get device
    result = await db.execute(
        select(Device).where(Device.id == device_id, Device.user_id == user_id)
    )
    device = result.scalar_one_or_none()
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )
    
    if not device.thingspeak_channel_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Device has no ThingSpeak channel configured"
        )
    
    # Fetch from ThingSpeak
    thingspeak = get_thingspeak_client()
    data = await thingspeak.get_history(
        device.thingspeak_channel_id,
        device.thingspeak_read_key,
        results=min(results, 8000)  # Cap at ThingSpeak max
    )
    
    if not data:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to fetch data from ThingSpeak"
        )
    
    return data


# ============================================================================
# INCLUDE API ROUTER WITH VERSION PREFIX
# ============================================================================

# Mount all API routes under /api/v1
app.include_router(api_router, prefix="/api/v1")


# ============================================================================
# DEBUG ENDPOINTS (Only in development)
# ============================================================================

if settings.ENVIRONMENT == "development":
    
    @app.get("/debug/db-status", tags=["debug"])
    async def debug_db_status(db: AsyncSession = Depends(get_db)):
        """Check database connection and table status."""
        try:
            # Test connection
            await db.execute(text("SELECT 1"))
            
            # Count records
            user_count = await db.execute(text("SELECT COUNT(*) FROM users"))
            device_count = await db.execute(text("SELECT COUNT(*) FROM devices"))
            
            return {
                "status": "ok",
                "tables": {
                    "users": user_count.scalar(),
                    "devices": device_count.scalar()
                }
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }


# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )

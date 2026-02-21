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
from models import User, Device, Pipeline, Region, Community
from schemas import (
    UserResponse,
    DeviceCreate,
    DeviceUpdate,
    DeviceResponse,
    DeviceMapResponse,
    PipelineMapResponse,
    TelemetryResponse,
    HealthResponse,
    AuditLogCreate,
    AuditLogResponse,
    FrontendErrorCreate,
    FrontendErrorResponse,
    RegionResponse,
    CommunityCreate,
    CommunityResponse,
    CustomerCreate
)
from supabase_auth import get_current_user, get_user_id, get_user_email
from thingspeak import get_thingspeak_client
from logger import setup_logger, RequestLogger
from performance import metrics, get_performance_report, check_slow_queries, check_slow_endpoints

# Initialize settings and logger
settings = get_settings()
logger = setup_logger(__name__, settings.LOG_LEVEL)

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
    """Log all requests with timing information and structured logging."""
    import time
    import uuid
    
    request_id = str(uuid.uuid4())[:8]
    start_time = time.time()
    
    # Create request-scoped logger
    req_logger = RequestLogger(
        logger,
        request_id=request_id,
        method=request.method,
        path=str(request.url.path)
    )
    
    # Attach logger to request state for use in endpoints
    request.state.logger = req_logger
    
    try:
        response = await call_next(request)
        process_time = round((time.time() - start_time) * 1000, 2)
        
        # Log successful request
        req_logger.info(
            "Request completed",
            status_code=response.status_code,
            duration_ms=process_time
        )
        
        # Record performance metrics
        metrics.record_api_request(
            endpoint=str(request.url.path),
            duration_ms=process_time,
            status_code=response.status_code
        )
        
        # Add custom headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = str(process_time)
        return response
        
    except Exception as e:
        process_time = round((time.time() - start_time) * 1000, 2)
        req_logger.error(
            "Request failed",
            error=str(e),
            error_type=type(e).__name__,
            duration_ms=process_time
        )
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
        
        # Add 5 second timeout for health check (compatible with Python 3.9+)
        async def check_db():
            async with engine.connect() as conn:
                # Force no prepared statements for pooler compatibility
                result = await conn.execute(text("SELECT 1"))
                result.fetchone()  # Don't await - fetchone() is synchronous
        
        await asyncio.wait_for(check_db(), timeout=5.0)
        
        response_time = round((time.time() - start_time) * 1000, 2)  # ms
        
        # Adjusted threshold for cloud database (Supabase pooler connection)
        # 3 seconds is reasonable for cross-region database connections
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
# REGION & COMMUNITY ENDPOINTS
# ============================================================================

@api_router.get("/regions", response_model=List[RegionResponse], tags=["regions"])
async def list_regions(db: AsyncSession = Depends(get_db)):
    """
    List all available regions (cities).
    No authentication required - public data.
    Returns regions sorted alphabetically by name.
    """
    result = await db.execute(
        select(Region).order_by(Region.name.asc())
    )
    regions = result.scalars().all()
    return regions


@api_router.post("/communities", response_model=CommunityResponse, status_code=status.HTTP_201_CREATED, tags=["communities"])
async def create_community(
    community: CommunityCreate,
    user_payload: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new community within a region.
    Requires authentication. Only superadmin can create communities.
    """
    user_id = get_user_id(user_payload)
    
    # Get user role
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user or user.role != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superadmin users can create communities"
        )
    
    # Validate region exists
    result = await db.execute(select(Region).where(Region.id == community.region_id))
    region = result.scalar_one_or_none()
    
    if not region:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Region with ID {community.region_id} not found"
        )
    
    # Create community
    new_community = Community(
        id=str(uuid.uuid4()),
        name=community.name,
        region_id=community.region_id,
        address=community.address,
        contact_email=community.contact_email,
        contact_phone=community.contact_phone
    )
    
    db.add(new_community)
    await db.commit()
    await db.refresh(new_community)
    
    return new_community


@api_router.get("/communities", response_model=List[CommunityResponse], tags=["communities"])
async def list_communities(
    region_id: str = None,
    db: AsyncSession = Depends(get_db)
):
    """
    List all communities, optionally filtered by region.
    No authentication required - public data.
    """
    query = select(Community)
    
    if region_id:
        query = query.where(Community.region_id == region_id)
    
    query = query.order_by(Community.name.asc())
    result = await db.execute(query)
    communities = result.scalars().all()
    
    return communities


@api_router.get("/communities/{community_id}", response_model=CommunityResponse, tags=["communities"])
async def get_community(
    community_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a single community by ID.
    No authentication required - public data.
    """
    result = await db.execute(select(Community).where(Community.id == community_id))
    community = result.scalar_one_or_none()
    
    if not community:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Community with ID {community_id} not found"
        )
    
    return community


@api_router.post("/customers", response_model=UserResponse, status_code=status.HTTP_201_CREATED, tags=["customers"])
async def create_customer(
    customer: CustomerCreate,
    user_payload: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new customer with Supabase authentication.
    Requires authentication. Only superadmin can create customers.
    
    This endpoint:
    1. Creates user in Supabase Auth
    2. Creates user record in local database with community link
    """
    from supabase import create_client, Client
    
    user_id = get_user_id(user_payload)
    
    # Get user role - only superadmin can create customers
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user or user.role != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superadmin users can create customers"
        )
    
    # Validate community exists
    result = await db.execute(select(Community).where(Community.id == customer.community_id))
    community = result.scalar_one_or_none()
    
    if not community:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Community with ID {customer.community_id} not found"
        )
    
    # Create user in Supabase (admin API)
    try:
        supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
        
        # Create user in Supabase Auth
        auth_response = supabase.auth.admin.create_user({
            "email": customer.email,
            "password": customer.password,
            "email_confirm": True  # Auto-confirm email
        })
        
        if not auth_response.user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user in Supabase Auth"
            )
        
        supabase_user_id = auth_response.user.id
        
    except Exception as e:
        logger.error(f"Failed to create Supabase user: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user in Supabase: {str(e)}"
        )
    
    # Create user in local database with community link
    new_user = User(
        id=supabase_user_id,
        email=customer.email,
        display_name=customer.display_name,
        role=customer.role,
        community_id=customer.community_id
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    return new_user


# ============================================================================
# AUDIT LOG ENDPOINTS
# ============================================================================

@api_router.post("/audit-logs", response_model=AuditLogResponse, status_code=status.HTTP_201_CREATED, tags=["audit"])
async def create_audit_log(
    audit_data: AuditLogCreate,
    user_payload: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create audit log entry.
    
    Frontend should call this for all mutations:
    - Device create/update/delete
    - User create/update
    - Pipeline create/update/delete
    - Login/logout events
    """
    from models import AuditLog
    
    user_id = get_user_id(user_payload)
    
    audit_log = AuditLog(
        user_id=user_id,
        action=audit_data.action,
        resource_type=audit_data.resource_type,
        resource_id=audit_data.resource_id,
        details=audit_data.details
    )
    
    db.add(audit_log)
    await db.commit()
    await db.refresh(audit_log)
    
    return audit_log


# ============================================================================
# FRONTEND ERROR LOGGING ENDPOINT
# ============================================================================

@api_router.post("/frontend-errors", response_model=FrontendErrorResponse, status_code=status.HTTP_201_CREATED, tags=["monitoring"])
async def log_frontend_error(
    error_data: FrontendErrorCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Log frontend error for monitoring.
    
    This endpoint does NOT require authentication (to capture errors even when auth fails).
    Frontend ErrorBoundary calls this to track React errors.
    """
    from models import FrontendError
    
    # Try to extract user_id from Authorization header if present (but don't require it)
    user_id = None
    # You could optionally parse the token here if needed, but we keep it simple
    
    frontend_error = FrontendError(
        error_message=error_data.error_message,
        stack_trace=error_data.stack_trace,
        url=error_data.url,
        user_agent=error_data.user_agent,
        user_id=user_id
    )
    
    db.add(frontend_error)
    await db.commit()
    await db.refresh(frontend_error)
    
    print(f"[FRONTEND ERROR] {error_data.error_message} at {error_data.url}")
    
    return frontend_error


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


@api_router.get("/devices/map/all", response_model=List[DeviceMapResponse], tags=["devices", "map"])
async def get_map_devices(
    db: AsyncSession = Depends(get_db)
):
    """
    Optimized endpoint for map rendering.
    Returns all active devices with minimal fields for fast map loading.
    No authentication required for public map display.
    Performance target: <200ms P95
    """
    import time
    start_time = time.time()
    
    # Optimized query: only select required fields
    result = await db.execute(
        select(
            Device.id,
            Device.name,
            Device.asset_type,
            Device.asset_category,
            Device.latitude,
            Device.longitude,
            Device.capacity,
            Device.specifications,
            Device.status
        )
        .where(Device.is_active == 'true')
        .where(Device.latitude.isnot(None))
        .where(Device.longitude.isnot(None))
        .order_by(Device.asset_type, Device.name)
    )
    
    # Build response objects
    devices = []
    for row in result.all():
        devices.append(DeviceMapResponse(
            id=row[0],
            name=row[1],
            asset_type=row[2],
            asset_category=row[3],
            latitude=row[4],
            longitude=row[5],
            capacity=row[6],
            specifications=row[7],
            status=row[8]
        ))
    
    query_time = (time.time() - start_time) * 1000
    print(f"[MAP] Loaded {len(devices)} devices in {query_time:.2f}ms")
    
    return devices


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
# PIPELINE ENDPOINTS
# ============================================================================

@api_router.get("/pipelines", response_model=List[PipelineMapResponse], tags=["pipelines", "map"])
async def list_pipelines(
    db: AsyncSession = Depends(get_db)
):
    """
    List all active pipelines for map rendering.
    Returns minimal fields optimized for Leaflet polylines.
    No authentication required for public map display.
    Performance target: <200ms P95
    """
    import time
    start_time = time.time()
    
    # Optimized query: only select required fields
    result = await db.execute(
        select(
            Pipeline.id,
            Pipeline.name,
            Pipeline.coordinates,
            Pipeline.color
        )
        .where(Pipeline.is_active == True)  # Boolean comparison (pipelines table uses BOOLEAN)
        .order_by(Pipeline.pipeline_type, Pipeline.name)
    )
    
    # Build response objects
    pipelines = []
    for row in result.all():
        # Convert GeoJSON coordinates [[lng, lat], [lng, lat]] to React-Leaflet format [[lat, lng], [lat, lng]]
        geojson_coords = row[2]  # [[lng, lat], ...]
        positions = [[coord[1], coord[0]] for coord in geojson_coords]  # [[lat, lng], ...]
        
        pipelines.append(PipelineMapResponse(
            id=row[0],
            name=row[1],
            positions=positions,
            color=row[3]
        ))
    
    query_time = (time.time() - start_time) * 1000  # Convert to milliseconds
    print(f"[PIPELINES] Loaded {len(pipelines)} pipelines in {query_time:.2f}ms")
    
    return pipelines


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
    
    @app.get("/debug/performance", tags=["debug"])
    async def debug_performance():
        """Get performance metrics and identify slow queries/endpoints."""
        report = get_performance_report()
        
        # Add slow query/endpoint analysis
        slow_queries = await check_slow_queries(threshold_ms=500)
        slow_endpoints = await check_slow_endpoints(threshold_ms=1000)
        
        report["analysis"] = {
            "slow_queries": slow_queries[:10],  # Top 10 slowest
            "slow_endpoints": slow_endpoints[:10]
        }
        
        return report


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

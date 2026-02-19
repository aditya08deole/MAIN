from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models import all_models as models
from app.schemas import schemas
from app.db.repository import DistributorRepository, CommunityRepository, CustomerRepository, NodeRepository, PlanRepository
import uuid
import re
from datetime import datetime
from typing import List

from app.core import security, security_supabase
from app.core.permissions import Permission
from app.core.security_supabase import RequirePermission
from app.services.supabase_auth_service import SupabaseAuthService
from app.services.telemetry_service import TelemetryService
from app.services.node_config_service import NodeConfigService
from app.services.audit_service import AuditService
from app.services.websockets import manager
from app.services.security import EncryptionService
from app.services.notification import NotificationService
import json

router = APIRouter()

def get_effective_distributor_id(user: dict) -> Optional[str]:
    """Returns distributor_id from custom claims if present, else checks user_metadata."""
    # Priority 1: Custom JWT Claim (Phase 16)
    if user.get("distributor_id"):
        return user["distributor_id"]
        
    # Priority 2: user_metadata fallback
    metadata = user.get("user_metadata", {})
    if metadata.get("role") == "distributor":
        return user.get("sub")
    return None

# ─── DISTRIBUTORS ───
@router.get("/distributors", response_model=List[schemas.DistributorResponse])
async def read_distributors(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(RequirePermission(Permission.USER_MANAGE))
):
    repo = DistributorRepository(db)
    dist_id = get_effective_distributor_id(user)
    if dist_id:
        result = await db.execute(select(models.Distributor).filter(models.Distributor.id == dist_id))
        obj = result.scalars().first()
        return [obj] if obj else []
    
    return await repo.get_all()

# ─── COMMUNITIES ───
@router.get("/communities", response_model=List[schemas.CommunityResponse])
async def read_communities(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(RequirePermission(Permission.COMMUNITY_VIEW))
):
    repo = CommunityRepository(db)
    dist_id = get_effective_distributor_id(user)
    return await repo.get_with_counts(distributor_id=dist_id)

def generate_slug(name: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')

@router.post("/communities", response_model=schemas.CommunityResponse)
async def create_community(
    community_in: schemas.CommunityCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(RequirePermission(Permission.COMMUNITY_CREATE)) 
):
    repo = CommunityRepository(db)
    
    # Enforce distributor_id if the user is a distributor
    dist_id = get_effective_distributor_id(user)
    if dist_id:
        community_in.distributor_id = dist_id

    # Fuzzy/Case-insensitive name check
    existing = await repo.get_by_name(community_in.name)
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"Community with name '{community_in.name}' already exists (Matches: {existing.name})"
        )
    
    slug = generate_slug(community_in.name)
    # Check slug uniqueness
    existing_slug = await repo.get_by_slug(slug)
    if existing_slug:
        # Append random suffix if slug exists (unlikely given name check but safe)
        slug = f"{slug}-{uuid.uuid4().hex[:4]}"

    db_obj = models.Community(
        id=str(uuid.uuid4()),
        name=community_in.name,
        region=community_in.region,
        city=community_in.city,
        distributor_id=community_in.distributor_id,
        slug=slug,
        created_by=user.get("sub")
    )
    db.add(db_obj)
    
    # Audit Log
    await AuditService.log_action(
        db, "CREATE_COMMUNITY", user.get("sub"), "community", db_obj.id, {"name": db_obj.name}
    )

    try:
        await db.commit()
        await db.refresh(db_obj)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    return db_obj

# ─── CUSTOMERS ───
@router.get("/customers", response_model=List[schemas.CustomerResponse])
async def read_customers(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(RequirePermission(Permission.USER_MANAGE))
):
    repo = CustomerRepository(db)
    dist_id = get_effective_distributor_id(user)
    return await repo.get_all(distributor_id=dist_id)

@router.post("/customers", response_model=schemas.CustomerResponse)
async def create_customer(
    customer_in: schemas.CustomerCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(RequirePermission(Permission.USER_MANAGE))
):
    # Enforce distributor_id if the user is a distributor
    dist_id = get_effective_distributor_id(user)
    if dist_id:
        customer_in.distributor_id = dist_id

    # Check duplicate email
    result = await db.execute(select(models.Customer).filter(models.Customer.email == customer_in.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    
    # Optional: Automate Supabase Auth Creation
    auth_service = SupabaseAuthService()
    supabase_user = await auth_service.create_user(
        email=customer_in.email,
        user_metadata={"full_name": customer_in.full_name}
    )
    
    supabase_uid = supabase_user["id"] if supabase_user else None
        
    db_obj = models.Customer(
        id=str(uuid.uuid4()),
        full_name=customer_in.full_name,
        email=customer_in.email,
        supabase_user_id=supabase_uid,
        community_id=customer_in.community_id,
        distributor_id=customer_in.distributor_id,
        plan_id=customer_in.plan_id,
        contact_number=customer_in.contact_number
    )
    db.add(db_obj)
    
    # Audit Log
    await AuditService.log_action(
        db, "CREATE_CUSTOMER", user.get("sub"), "customer", db_obj.id, {"email": db_obj.email}
    )

    try:
        await db.commit()
        await db.refresh(db_obj)
        
        # Phase 18: Onboarding Email
        await NotificationService.send_welcome_email(
            email=db_obj.email,
            full_name=db_obj.full_name
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    return db_obj

@router.post("/customers/onboard", response_model=schemas.CustomerResponse)
async def onboard_customer(
    customer_in: schemas.CustomerOnboard,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(RequirePermission(Permission.USER_MANAGE))
):
    """
    Full Onboarding: Create Supabase Auth User + DB Customer Profile
    """
    # Enforce distributor_id if the user is a distributor
    dist_id = get_effective_distributor_id(user)
    if dist_id:
        customer_in.distributor_id = dist_id

    # Check duplicate email in DB
    result = await db.execute(select(models.Customer).filter(models.Customer.email == customer_in.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered in Database")
    
    # Create Supabase Auth User
    auth_service = SupabaseAuthService()
    metadata = {
        "full_name": customer_in.full_name,
        "role": "customer",
        "community_id": customer_in.community_id
    }
    
    try:
        auth_response = await auth_service.create_user(
            email=customer_in.email,
            password=customer_in.password, 
            user_metadata=metadata
        )
    except Exception as e:
         raise HTTPException(status_code=500, detail=f"Auth Service Error: {str(e)}")

    if not auth_response or 'id' not in auth_response:
        raise HTTPException(status_code=400, detail="Failed to create Auth User. Email might be registered in Supabase but not in DB.")
        
    supabase_uid = auth_response['id']
    
    # Create DB Customer
    db_obj = models.Customer(
        id=str(uuid.uuid4()),
        full_name=customer_in.full_name,
        email=customer_in.email,
        supabase_user_id=supabase_uid,
        community_id=customer_in.community_id,
        distributor_id=customer_in.distributor_id,
        plan_id=customer_in.plan_id,
        contact_number=customer_in.contact_number
    )
    db.add(db_obj)
    
    try:
        await AuditService.log_action(
            db, "ONBOARD_CUSTOMER", user.get("sub"), "customer", db_obj.id, {"email": db_obj.email}
        )
        await db.commit()
        await db.refresh(db_obj)
        
        await NotificationService.send_welcome_email(
            email=db_obj.email,
            full_name=db_obj.full_name
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Database commit failed: {str(e)}")
        
    return db_obj

@router.get("/customers/{customer_id}", response_model=schemas.CustomerDetail)
async def read_customer_detail(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(RequirePermission(Permission.USER_MANAGE))
):
    repo = CustomerRepository(db)
    customer = await repo.get_with_devices(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    # Security: Distributor can only see their own customers
    dist_id = get_effective_distributor_id(user)
    if dist_id and customer.distributor_id != dist_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this customer")
        
    return customer

# ─── PLANS ───
@router.get("/plans", response_model=List[schemas.PlanResponse])
async def read_plans(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(RequirePermission(Permission.USER_MANAGE))
):
    repo = PlanRepository(db)
    return await repo.get_all()

# ─── DEVICES ───
@router.post("/nodes", response_model=schemas.NodeResponse)
async def create_node(
    node_in: schemas.NodeCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(RequirePermission(Permission.DEVICE_PROVISION))
):
    repo = NodeRepository(db)
    existing = await repo.get_by_key(node_in.node_key)
    if existing:
        raise HTTPException(status_code=400, detail="Device ID already provisioned")
    
    # Enforce distributor scoping
    dist_id = get_effective_distributor_id(user)
    if dist_id:
        node_in.distributor_id = dist_id
        
    # Validation: Hardware Config
    if node_in.analytics_type == "EvaraTank":
        NodeConfigService.validate_config("EvaraTank", node_in.config_tank)
    elif node_in.analytics_type == "EvaraDeep":
        NodeConfigService.validate_config("EvaraDeep", node_in.config_deep)
    elif node_in.analytics_type == "EvaraFlow":
        NodeConfigService.validate_config("EvaraFlow", node_in.config_flow)

    # Validation: Community-Customer-Distributor Hierarchy
    if node_in.community_id:
        comm = await CommunityRepository(db).get(node_in.community_id)
        if not comm:
            raise HTTPException(status_code=404, detail="Community not found")
        if node_in.distributor_id and comm.distributor_id != node_in.distributor_id:
            raise HTTPException(status_code=403, detail="Community does not belong to this distributor")
            
    if node_in.customer_id:
        cust = await CustomerRepository(db).get(node_in.customer_id)
        if not cust:
            raise HTTPException(status_code=404, detail="Customer not found")
        if node_in.distributor_id and cust.distributor_id != node_in.distributor_id:
            raise HTTPException(status_code=403, detail="Customer does not belong to this distributor")
        if node_in.community_id and cust.community_id != node_in.community_id:
            raise HTTPException(status_code=400, detail="Customer does not belong to the selected community")

        # Plan Quota Enforcement
        if cust.plan_id:
            plan = await PlanRepository(db).get(cust.plan_id)
            if plan:
                current_count = await repo.get_count_by_customer(node_in.customer_id)
                if current_count >= plan.max_devices:
                    raise HTTPException(
                        status_code=403, 
                        detail=f"Device limit reached. Plan '{plan.name}' allows max {plan.max_devices} nodes."
                    )

    # Validation: Coordinates
    if node_in.lat is not None and node_in.lng is not None:
        if not TelemetryService.validate_coordinates(node_in.lat, node_in.lng):
            raise HTTPException(status_code=400, detail="Invalid coordinates (Latitude: -90 to 90, Longitude: -180 to 180)")

    # Validation: ThingSpeak Handshake
    if node_in.thingspeak_mapping:
        chan_id = node_in.thingspeak_mapping.get("channel_id")
        read_key = node_in.thingspeak_mapping.get("read_api_key")
        if chan_id:
            is_valid = await TelemetryService.verify_thingspeak_channel(chan_id, read_key)
            if not is_valid:
                raise HTTPException(status_code=400, detail=f"ThingSpeak Handshake Failed for Channel ID: {chan_id}. Please check the ID and Read Key.")

    node_id = str(uuid.uuid4())
    db_obj = models.Node(
        id=node_id,
        node_key=node_in.node_key,
        label=node_in.label,
        category=node_in.category,
        analytics_type=node_in.analytics_type,
        lat=node_in.lat,
        lng=node_in.lng, # Use lng attribute
        customer_id=node_in.customer_id,
        community_id=node_in.community_id,
        distributor_id=node_in.distributor_id
    )
    db.add(db_obj)

    # Handle Specialized Configs
    if node_in.analytics_type == "EvaraTank" and node_in.config_tank:
        config = models.DeviceConfigTank(device_id=node_id, **node_in.config_tank)
        db.add(config)
    elif node_in.analytics_type == "EvaraDeep" and node_in.config_deep:
        config = models.DeviceConfigDeep(device_id=node_id, **node_in.config_deep)
        db.add(config)
    elif node_in.analytics_type == "EvaraFlow" and node_in.config_flow:
        config = models.DeviceConfigFlow(device_id=node_id, **node_in.config_flow)
        db.add(config)
    
    # Handle Telemetry Mapping
    if node_in.thingspeak_mapping:
        mapping_data = node_in.thingspeak_mapping.copy()
        raw_key = mapping_data.get("read_api_key")
        if raw_key:
            mapping_data["read_api_key"] = EncryptionService.encrypt(raw_key)
            
        ts_map = models.DeviceThingSpeakMapping(device_id=node_id, **mapping_data)
        db.add(ts_map)
    
    # Add Audit Log Entry
    await AuditService.log_action(
        db=db,
        action="PROVISION_NODE",
        user_id=user.get("sub"),
        resource_type="node",
        resource_id=node_id,
        metadata={
            "hardware_id": node_in.node_key,
            "analytics_type": node_in.analytics_type
        }
    )

    try:
        await db.commit()
        await db.refresh(db_obj)
    except Exception as e:
        await db.rollback()
        # Phase 18.2: Provisioning Failure Alert
        await NotificationService.send_system_alert(
            alert_type="PROVISIONING_FAILED",
            details={
                "hardware_id": node_in.node_key,
                "error": str(e)
            },
            severity="high"
        )
        raise HTTPException(status_code=500, detail=f"Atomic Provisioning Failed: {str(e)}")
    
    # WebSocket Broadcast
    await manager.broadcast(json.dumps({
        "event": "NODE_PROVISIONED",
        "node_id": db_obj.id,
        "hardware_id": db_obj.node_key,
        "category": db_obj.category
    }))

    # Re-fetch to include relations in response
    return await repo.get(db_obj.id)

# ─── SYSTEM CONFIG ───
@router.put("/system/config", response_model=schemas.SystemConfigResponse)
async def update_system_config(
    config_in: schemas.SystemConfigUpdate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(RequirePermission(Permission.SYSTEM_CONFIG_WRITE))
):
    result = await db.execute(select(models.SystemConfig).filter(models.SystemConfig.key == "global_config"))
    db_obj = result.scalars().first()
    if not db_obj:
        db_obj = models.SystemConfig(key="global_config")
        db.add(db_obj)
    
    db_obj.data_rate = config_in.rate
    db_obj.firmware_version = config_in.firmware
    db_obj.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(db_obj)
    
    # AUDIT LOG
    await AuditService.log_action(
        db=db,
        action="UPDATE_SYSTEM_CONFIG",
        user_id=user.get("sub"),
        resource_type="system",
        resource_id="global_config",
        metadata={
            "data_rate": db_obj.data_rate,
            "firmware_version": db_obj.firmware_version
        }
    )
    
    return db_obj

# ─── AUDIT LOGS ───
@router.get("/audit", response_model=List[schemas.AuditLogResponse])
async def read_audit_logs(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(RequirePermission(Permission.AUDIT_VIEW))
):
    repo = AuditLogRepository(db)
    dist_id = get_effective_distributor_id(user)
    return await repo.get_all(skip=skip, limit=limit, distributor_id=dist_id)

# ─── SYSTEM STATS ───
@router.get("/stats")
async def read_system_stats(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(RequirePermission(Permission.COMMUNITY_VIEW))
):
    dist_id = get_effective_distributor_id(user)
    
    node_repo = NodeRepository(db)
    cust_repo = CustomerRepository(db)
    comm_repo = CommunityRepository(db)
    
    nodes = await node_repo.get_all(limit=1000, distributor_id=dist_id)
    customers = await cust_repo.get_all(limit=1000, distributor_id=dist_id)
    communities = await comm_repo.get_all(limit=1000, distributor_id=dist_id)
    
    total_nodes = len(nodes)
    online_nodes = len([n for n in nodes if n.status == "online"])
    active_alerts = len([n for n in nodes if n.status == "alert"])
    
    health = (online_nodes / total_nodes * 100) if total_nodes > 0 else 100
    
    return {
        "total_nodes": total_nodes,
        "online_nodes": online_nodes,
        "active_alerts": active_alerts,
        "total_customers": len(customers),
        "total_communities": len(communities),
        "system_health": round(health, 1)
    }


# P33: API Key Rotation
@router.post("/admin/rotate-keys")
async def rotate_encryption_keys(
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(RequirePermission(Permission.ADMIN_FULL))
):
    """
    P33: Rotate encryption key and re-encrypt all ThingSpeak API keys.
    Admin-only. Audit logged.
    """
    from sqlalchemy.orm import selectinload
    
    result = await db.execute(
        select(models.Node).options(selectinload(models.Node.thingspeak_mapping))
    )
    nodes = result.scalars().all()
    
    re_encrypted = 0
    for node in nodes:
        if node.thingspeak_mapping and node.thingspeak_mapping.read_api_key:
            # Decrypt with current key, re-encrypt
            try:
                decrypted = EncryptionService.decrypt(node.thingspeak_mapping.read_api_key)
                node.thingspeak_mapping.read_api_key = EncryptionService.encrypt(decrypted)
                re_encrypted += 1
            except Exception as e:
                print(f"Re-encryption failed for node {node.id}: {e}")
    
    await db.commit()
    
    user_id = user_payload.get("sub")
    await AuditService.log_action(db, "admin.rotate_keys", user_id, "system", "encryption_keys", {"re_encrypted": re_encrypted})
    
    return {"status": "success", "re_encrypted_count": re_encrypted}


# P45: System Status (Admin)
@router.get("/admin/system-status")
async def get_system_status(
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(RequirePermission(Permission.ADMIN_FULL))
):
    """
    P45: Comprehensive operational status for admins.
    """
    from sqlalchemy import text, func
    import time
    
    # DB latency
    start = time.time()
    await db.execute(text("SELECT 1"))
    db_latency = round((time.time() - start) * 1000, 1)
    
    # Table counts
    node_count = (await db.execute(select(func.count(models.Node.id)))).scalar()
    alert_count = (await db.execute(
        select(func.count(models.AlertHistory.id)).where(models.AlertHistory.resolved_at.is_(None))
    )).scalar()
    reading_count = (await db.execute(select(func.count(models.NodeReading.id)))).scalar()
    
    # Device states
    state_count = (await db.execute(select(func.count(models.DeviceState.device_id)))).scalar()
    
    return {
        "database": {"status": "ok", "latency_ms": db_latency},
        "nodes": {"total": node_count},
        "alerts": {"active": alert_count},
        "readings": {"total_stored": reading_count},
        "device_states": {"tracked": state_count},
        "version": "2.0.0",
    }


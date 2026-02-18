from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models import all_models as models
from app.schemas import schemas
import uuid
from datetime import datetime

from app.core import security, security_supabase
from app.core.permissions import Permission
from app.core.security_supabase import RequirePermission

router = APIRouter()

# ─── COMMUNITIES & REGIONS ───
@router.post("/communities", response_model=schemas.CommunityResponse)
async def create_community(
    community_in: schemas.CommunityCreate,
    db: AsyncSession = Depends(get_db),
    # Only Super Admin or Region Admin can create communities
    user: dict = Depends(RequirePermission(Permission.COMMUNITY_CREATE)) 
):
    # Check if exists
    existing = await db.execute(select(models.Community).filter(models.Community.name == community_in.name))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Community with this name already exists")
    
    # We need to fetch/determine Organization/Region ID from user context or input
    # For now, hardcoding defaults or relying on schemas update (which we haven't fully done for input)
    # Using placeholders to unblock
    
    db_obj = models.Community(
        id=str(uuid.uuid4()),
        name=community_in.name,
        region=community_in.region, # Existing schema field
        region_id="reg_hyd_north", # Placeholder
        organization_id="org_evara_hq" # Placeholder
    )
    db.add(db_obj)
    
    # Audit
    audit = AuditService(db)
    await audit.log_action(
        user_id=user.get("sub"),
        action="CREATE",
        resource_type="Community",
        resource_id=db_obj.id,
        details={"name": community_in.name}
    )
    
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

@router.post("/customers", response_model=schemas.UserResponse)
async def create_customer(
    customer_in: schemas.CustomerCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(RequirePermission(Permission.USER_MANAGE))
):
    result = await db.execute(select(models.User).filter(models.User.email == customer_in.email))
    existing = result.scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    db_obj = models.User(
        id=str(uuid.uuid4()),
        email=customer_in.email,
        display_name=customer_in.name,
        role="customer",
        community_id=customer_in.community_id
    )
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

@router.post("/devices", response_model=schemas.NodeResponse)
async def create_device(
    device_in: schemas.DeviceCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(RequirePermission(Permission.DEVICE_PROVISION))
):
    result = await db.execute(select(models.Node).filter(models.Node.node_key == device_in.hardware_id))
    existing = result.scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="Device ID already provisioned")
        
    db_obj = models.Node(
        id=str(uuid.uuid4()),
        node_key=device_in.hardware_id,
        label=f"New {device_in.type}",
        category="Hardware",
        analytics_type=device_in.type,
        status="Provisioned"
    )
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

@router.put("/system/config", response_model=schemas.SystemConfigResponse)
async def update_system_config(
    config_in: schemas.SystemConfigUpdate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(RequirePermission(Permission.SYSTEM_CONFIG_WRITE))
):
    # Upsert global config
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
    return db_obj

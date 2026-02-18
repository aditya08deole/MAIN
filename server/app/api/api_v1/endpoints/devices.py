from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.schemas import schemas
from app.models import all_models as models
from app.db.session import get_db
from app.core import security_supabase
from app.core.permissions import Permission
from datetime import datetime
import uuid
from sqlalchemy import select
from app.core.security_supabase import RequirePermission
from app.core.ratelimit import RateLimiter

router = APIRouter()

@router.get("/registry", response_model=List[schemas.NodeResponse])
async def list_device_registry(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(RequirePermission(Permission.DEVICE_READ))
) -> Any:
    """
    Admin View of Device Registry.
    Shows all devices with firmware/calibration metadata.
    """
    # Verify Super Admin or Region Admin for full registry access
    # Logic similar to nodes.py RLS but aimed at inventory management
    # For now, returning all accessible nodes
    result = await db.execute(select(models.Node))
    nodes = result.scalars().all()
    # In real app, filter by organization permissions
    return nodes

@router.put("/{node_id}/metadata", response_model=schemas.NodeResponse)
async def update_device_metadata(
    node_id: str,
    metadata_in: schemas.NodeCreate, # Using Create schema as partial for now
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(RequirePermission(Permission.DEVICE_CONTROL))
) -> Any:
    """
    Update Device Metadata (Firmware, Calibration).
    """
    node = await db.get(models.Node, node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Device not found")
        
    # Update allowed fields
    if metadata_in.firmware_version:
        node.firmware_version = metadata_in.firmware_version
    if metadata_in.calibration_factor:
        node.calibration_factor = metadata_in.calibration_factor
        
    await db.commit()
    await db.refresh(node)
    return node

@router.post("/provision-token", response_model=dict)
async def generate_provisioning_token(
    community_id: str,
    expiration_minutes: int = 60,
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(RequirePermission(Permission.DEVICE_PROVISION))
) -> Any:
    """
    Generate a one-time provisioning token for a specific community.
    """
    import secrets
    from datetime import datetime, timedelta
    
    # Verify user has access to this community (if not superadmin)
    # Simple check for now: relies on Permission Dependency
    
    token_str = secrets.token_urlsafe(16)
    expires = datetime.utcnow() + timedelta(minutes=expiration_minutes)
    
    token_obj = models.ProvisioningToken(
        token=token_str,
        created_by_user_id=user_payload.get("sub"), # Supabase ID
        community_id=community_id,
        expires_at=expires
    )
    
    db.add(token_obj)
    await db.commit()
    return {"token": token_str, "expires_at": expires}

@router.post("/claim")
async def claim_device(
    payload: dict, # { "token": "...", "hardware_id": "...", "type": "..." }
    db: AsyncSession = Depends(get_db),
    limiter: bool = Depends(RateLimiter(requests_per_minute=5)) 
) -> Any:
    """
    Public Endpoint for Devices/Installers to claim ownership.
    No Auth Required (Token acts as Auth).
    Rate Limit: 5 per minute per IP.
    """
    token_str = payload.get("token")
    hardware_id = payload.get("hardware_id")
    device_type = payload.get("type", "EvaraTank")
    
    if not token_str or not hardware_id:
        raise HTTPException(status_code=400, detail="Missing token or hardware_id")
        
    # Verify Token
    result = await db.execute(select(models.ProvisioningToken).where(models.ProvisioningToken.token == token_str))
    token_obj = result.scalars().first()
    
    if not token_obj:
        raise HTTPException(status_code=403, detail="Invalid token")
    if token_obj.is_used:
         raise HTTPException(status_code=403, detail="Token already used")
    if token_obj.expires_at < datetime.utcnow():
         raise HTTPException(status_code=403, detail="Token expired")
         
    # Check if device exists (re-provisioning) or create new
    result_node = await db.execute(select(models.Node).where(models.Node.node_key == hardware_id))
    existing_node = result_node.scalars().first()
    
    if existing_node:
        # Re-assign
        existing_node.community_id = token_obj.community_id
        existing_node.status = "Provisioned"
        node = existing_node
    else:
        # Create New
        node = models.Node(
            id=str(uuid.uuid4()),
            node_key=hardware_id,
            label=f"New {device_type}",
            category="Hardware",
            analytics_type=device_type,
            status="Provisioned",
            community_id=token_obj.community_id,
            # Inherit Org from Community (needs extra query or logic)
            # For simplicity, fetching Community to get Org ID
        )
        # Fetch Community to get Org ID
        comm_result = await db.execute(select(models.Community).where(models.Community.id == token_obj.community_id))
        community = comm_result.scalars().first()
        if community:
            node.organization_id = community.organization_id
            
        db.add(node)
        
    # Mark token used
    token_obj.is_used = True
    
    await db.commit()
    return {"status": "success", "device_id": node.id, "community_id": node.community_id}

@router.patch("/{node_id}/shadow", response_model=dict)
async def update_device_shadow(
    node_id: str,
    shadow_update: dict, # { "desired": { "pump_status": "ON" } }
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(RequirePermission(Permission.DEVICE_CONTROL))
) -> Any:
    """
    Update Device Shadow (Desired State).
    App uses this to control device.
    """
    node = await db.get(models.Node, node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Device not found")
        
    current_shadow = node.shadow_state or {}
    
    # Merge Desired State
    if "desired" in shadow_update:
        current_desired = current_shadow.get("desired", {})
        new_desired = shadow_update["desired"]
        current_desired.update(new_desired)
        current_shadow["desired"] = current_desired
        
        # Calculate Delta (Desired - Reported)
        # Simplified: Just setting delta flag or full diff?
        # For MVP, we presume device asks for 'desired' state.
        
    node.shadow_state = current_shadow
    # Force SQLAlchemy to detect change in JSON mutable
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(node, "shadow_state")
    
    await db.commit()
    return node.shadow_state

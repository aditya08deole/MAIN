import asyncio
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from pydantic import BaseModel
import uuid
from typing import Optional, Dict, Any, List

from database import get_db
from models import FrontendError, Zone, Community, Distributor, Customer, Device
from config import get_settings
from auth_helper import get_current_user, requires_superadmin
from schemas import UserResponse, CustomerCreate

settings = get_settings()
router = APIRouter()

@router.post("/customers", response_model=UserResponse, status_code=status.HTTP_201_CREATED, tags=["customers"])
async def create_customer(
    customer: CustomerCreate,
    current_admin: dict = Depends(requires_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new customer with Supabase Auth.
    """
    # Verify community exists
    try:
        community_uuid = uuid.UUID(customer.community_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid community ID format")

    result = await db.execute(select(Community).where(Community.id == community_uuid))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Community {customer.community_id} not found")

    try:
        from supabase import create_client, Client
        supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
        auth_response = supabase.auth.admin.create_user({
            "email": customer.email,
            "password": customer.password,
            "email_confirm": True,
            "user_metadata": {
                "role": customer.role,
                "display_name": customer.display_name
            }
        })
        if not auth_response.user:
            raise HTTPException(status_code=500, detail="Failed to create user in Supabase Auth")
        supabase_user_id = auth_response.user.id
    except Exception as e:
        print(f"[ERROR] Supabase user creation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Supabase user creation failed: {str(e)}")

    # Polling for the user to appear in the public table (Max 5 seconds)
    customer_profile = None
    for attempt in range(10):
        result = await db.execute(select(Customer).where(Customer.id == uuid.UUID(supabase_user_id)))
        customer_profile = result.scalar_one_or_none()
        if customer_profile:
            break
        await asyncio.sleep(0.5)

    if not customer_profile:
        raise HTTPException(
            status_code=status.HTTP_202_ACCEPTED,
            detail="User created in Auth but not yet synchronized to public table. Please refresh in a moment."
        )

    # Update user profile to link to community and set role
    customer_profile.community_id = community_uuid
    customer_profile.role = customer.role
    customer_profile.display_name = customer.display_name
    customer_profile.full_name = customer.full_name
    customer_profile.phone_number = customer.phone_number
    
    await db.commit()
    await db.refresh(customer_profile)
    
    return customer_profile

# ── FRONTEND ERROR LOGGING ───────────────────────────────────────────────

class FrontendErrorCreate(BaseModel):
    error_message: str
    stack_trace: Optional[str] = None
    url: str
    user_agent: Optional[str] = None

@router.post("/frontend-errors", status_code=status.HTTP_201_CREATED, tags=["monitoring"])
async def log_frontend_error(error_data: FrontendErrorCreate, db: AsyncSession = Depends(get_db)):
    """Log frontend error for monitoring. No auth required."""
    frontend_error = FrontendError(
        error_message=error_data.error_message,
        stack_trace=error_data.stack_trace,
        url=error_data.url,
        user_agent=error_data.user_agent,
    )
    db.add(frontend_error)
    await db.commit()
    return {"status": "ok"}

@router.get("/zones", tags=["metadata"])
async def get_zones(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Zone).order_by(Zone.name))
    zones = result.scalars().all()
    return {"status": "ok", "data": [
        {
            "id": str(z.id),
            "name": z.name,
            "state": z.state,
            "country": z.country,
            "zone_code": z.zone_code,
            "description": z.description,
            "is_active": z.is_active,
            "distributor_id": str(z.distributor_id) if z.distributor_id else None,
        } for z in zones
    ]}

@router.post("/zones", tags=["metadata"], status_code=status.HTTP_201_CREATED)
async def create_zone(
    zone_data: dict, 
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(requires_superadmin)
):
    """Create a new zone."""
    new_zone = Zone(
        name=zone_data.get("name"),
        state=zone_data.get("state"),
        country=zone_data.get("country", "India"),
        zone_code=zone_data.get("zone_code"),
        description=zone_data.get("description"),
        distributor_id=zone_data.get("distributor_id"),
        is_active=zone_data.get("is_active", True)
    )
    db.add(new_zone)
    await db.commit()
    await db.refresh(new_zone)
    return {"status": "ok", "data": new_zone}

@router.get("/hierarchy")
async def get_hierarchy(db: AsyncSession = Depends(get_db)):
    try:
        # Get all zones
        z_stmt = text("SELECT id, name FROM zones ORDER BY name")
        z_result = await db.execute(z_stmt)
        zones = z_result.fetchall()
        
        # Get all communities
        c_stmt = text("SELECT id, name, zone_id FROM communities ORDER BY name")
        c_result = await db.execute(c_stmt)
        communities = c_result.fetchall()
        
        hierarchy = []
        for z in zones:
            zone_id = str(z.id)
            zone_data = {
                "id": zone_id,
                "name": z.name,
                "communities": [
                    {"id": str(c.id), "name": c.name} for c in communities if str(c.zone_id) == zone_id
                ]
            }
            hierarchy.append(zone_data)
            
        return {"status": "ok", "data": hierarchy}
    except Exception as e:
        print(f"[ERROR] get_hierarchy: {e}")
        return {"status": "ok", "data": []}

@router.get("/zones/{zone_id}", tags=["metadata"])
async def get_zone(zone_id: str, db: AsyncSession = Depends(get_db)):
    """Get a single zone's details."""
    try:
        stmt = text("SELECT id, name, state, country, zone_code, description, is_active, distributor_id FROM zones WHERE id = :zid")
        result = await db.execute(stmt, {"zid": zone_id})
        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Zone not found")
            
        return {"status": "ok", "data": {
            "id": str(row.id),
            "name": row.name,
            "state": row.state,
            "country": row.country,
            "zone_code": row.zone_code,
            "description": row.description,
            "is_active": row.is_active,
            "distributor_id": str(row.distributor_id) if row.distributor_id else None
        }}
    except Exception as e:
        print(f"[ERROR] get_zone: {e}")
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/customers", tags=["customers"])
async def get_customers_list(community_id: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    try:
        if community_id:
            stmt = text("SELECT id, email, display_name, full_name, phone_number, role, status, community_id, distributor_id, created_at FROM customers WHERE community_id = :cid AND role::text ILIKE 'customer' ORDER BY created_at DESC")
            result = await db.execute(stmt, {"cid": community_id})
        else:
            stmt = text("SELECT id, email, display_name, full_name, phone_number, role, status, community_id, distributor_id, created_at FROM customers WHERE role::text ILIKE 'customer' ORDER BY created_at DESC")
            result = await db.execute(stmt)
            
        rows = result.fetchall()
        customers = []
        for r in rows:
            try:
                # Robust attribute access for Row objects
                cid = None
                if hasattr(r, 'community_id') and r.community_id: cid = str(r.community_id)
                
                did = None
                if hasattr(r, 'distributor_id') and r.distributor_id: did = str(r.distributor_id)
                
                created = None
                if hasattr(r, 'created_at') and r.created_at: 
                    try:
                        created = r.created_at.isoformat()
                    except:
                        created = str(r.created_at)

                customers.append({
                    "id": str(r.id),
                    "email": r.email,
                    "display_name": getattr(r, 'display_name', None),
                    "full_name": getattr(r, 'full_name', None),
                    "phone_number": getattr(r, 'phone_number', None),
                    "role": str(r.role),
                    "status": getattr(r, 'status', 'active'),
                    "community_id": cid,
                    "distributor_id": did,
                    "created_at": created
                })
            except Exception as row_err:
                print(f"[ERROR] Mapping customer row {getattr(r, 'id', 'unknown')}: {row_err}")
                continue

        print(f"[DEBUG] get_customers_list: returning {len(customers)} customers")
        return {"status": "ok", "data": customers}
    except Exception as e:
        print(f"[ERROR] get_customers_list: {e}")
        return {"status": "ok", "data": []}

@router.get("/communities", tags=["metadata"])
async def get_communities(zone_id: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    try:
        if zone_id:
            stmt = text("SELECT id, name, zone_id, address, pincode, contact_person, contact_email, contact_phone, operational_status, contact_info FROM communities WHERE zone_id = :zid ORDER BY name")
            result = await db.execute(stmt, {"zid": zone_id})
        else:
            stmt = text("SELECT id, name, zone_id, address, pincode, contact_person, contact_email, contact_phone, operational_status, contact_info FROM communities ORDER BY name")
            result = await db.execute(stmt)
            
        rows = result.fetchall()
        return {"status": "ok", "data": [
            {
                "id": str(r.id),
                "name": r.name,
                "zone_id": str(r.zone_id),
                "address": r.address,
                "pincode": r.pincode,
                "contact_person": r.contact_person,
                "contact_email": r.contact_email,
                "contact_phone": r.contact_phone,
                "operational_status": r.operational_status,
                "notes": r.contact_info, # Map contact_info to notes for frontend
            } for r in rows
        ]}
    except Exception as e:
        print(f"[ERROR] get_communities: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/communities", tags=["metadata"], status_code=status.HTTP_201_CREATED)
async def create_community(
    community_data: dict, 
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(requires_superadmin)
):
    """Create a new community."""
    try:
        new_community = Community(
            name=community_data.get("name"),
            zone_id=uuid.UUID(community_data.get("zone_id")),
            address=community_data.get("address"),
            pincode=community_data.get("pincode"),
            contact_person=community_data.get("contact_person"),
            contact_email=community_data.get("contact_email"),
            contact_phone=community_data.get("contact_phone"),
            operational_status=community_data.get("operational_status", "active"),
            contact_info=community_data.get("notes") # Map notes to contact_info
        )
        db.add(new_community)
        await db.commit()
        await db.refresh(new_community)
        return {"status": "ok", "data": new_community}
    except Exception as e:
        print(f"[ERROR] create_community: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/devices", tags=["metadata"])
async def get_devices(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("SELECT id, node_key, label, asset_type, status, latitude, longitude, is_active, community_id, user_id FROM devices ORDER BY label")
    )
    rows = result.fetchall()
    devices = [
        {
            "id": str(r.id),
            "node_key": r.node_key,
            "label": r.label,
            "name": r.label,
            "asset_type": r.asset_type,
            "status": r.status,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "is_active": r.is_active,
            "community_id": str(r.community_id) if r.community_id else None,
            "user_id": str(r.user_id),
        }
        for r in rows
    ]
    return {"status": "ok", "data": devices}

@router.post("/devices", tags=["metadata"])
async def create_device(device_data: Dict[str, Any], db: AsyncSession = Depends(get_db)):
    from models import Device, DeviceConfigTank, DeviceConfigFlow, DeviceConfigDeep
    
    node_key = device_data.get("node_key") or str(uuid.uuid4())
    new_device = Device(
        node_key=node_key,
        label=device_data.get("name"),
        name=device_data.get("name"),
        asset_type=device_data.get("device_type", "tank"),
        device_type=device_data.get("device_type", "tank"),
        latitude=float(device_data.get("latitude", 0)),
        longitude=float(device_data.get("longitude", 0)),
        capacity=device_data.get("capacity"),
        thingspeak_channel_id=device_data.get("thingspeak_channel_id"),
        thingspeak_read_key=device_data.get("thingspeak_read_key"),
        community_id=device_data.get("community_id"),
        user_id=device_data.get("customer_id") or device_data.get("user_id"),
        status=device_data.get("status", "Online"),
        is_active=device_data.get("is_active", True)
    )

    db.add(new_device)
    await db.flush()

    dev_type = (device_data.get("device_type") or "").lower()
    
    if dev_type == "tank":
        config = DeviceConfigTank(
            device_id=new_device.id,
            tank_shape=device_data.get("tank_shape", "cylinder"),
            radius=float(device_data.get("radius") or 0) if device_data.get("radius") else None,
            height=float(device_data.get("height") or 0) if device_data.get("height") else None,
            thingspeak_channel_id=new_device.thingspeak_channel_id,
            thingspeak_read_key=new_device.thingspeak_read_key
        )
        db.add(config)
    elif dev_type == "flow":
        config = DeviceConfigFlow(
            device_id=new_device.id,
            max_flow_rate=float(device_data.get("max_flow_rate") or 0) if device_data.get("max_flow_rate") else None,
            thingspeak_channel_id=new_device.thingspeak_channel_id,
            thingspeak_read_key=new_device.thingspeak_read_key
        )
        db.add(config)
    elif dev_type == "deep":
        config = DeviceConfigDeep(
            device_id=new_device.id,
            static_depth=float(device_data.get("static_depth") or 0) if device_data.get("static_depth") else None,
            thingspeak_channel_id=new_device.thingspeak_channel_id,
            thingspeak_read_key=new_device.thingspeak_read_key
        )
        db.add(config)

    await db.commit()
    await db.refresh(new_device)
    return new_device

@router.get("/admin/stats", tags=["monitoring"])
async def get_admin_stats(distributor_id: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    from models import Device, Customer, Zone, Community
    
    device_q = select(func.count(Device.id))
    online_q = select(func.count(Device.id)).where(Device.status == "Online")
    customer_q = select(func.count(Customer.id)).where(Customer.role == "customer")
    zone_q = select(func.count(Zone.id))
    comm_q = select(func.count(Community.id))

    if distributor_id:
        try:
            d_uuid = uuid.UUID(distributor_id)
            zone_ids_subq = select(Zone.id).where(Zone.distributor_id == d_uuid)
            zone_q = zone_q.where(Zone.distributor_id == d_uuid)
            comm_ids_subq = select(Community.id).where(Community.zone_id.in_(zone_ids_subq))
            comm_q = comm_q.where(Community.zone_id.in_(zone_ids_subq))
            device_q = device_q.where(Device.community_id.in_(comm_ids_subq))
            online_q = online_q.where(Device.community_id.in_(comm_ids_subq), Device.status == "Online")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid distributor ID")

    total_nodes = (await db.execute(device_q)).scalar() or 0
    online_nodes = (await db.execute(online_q)).scalar() or 0
    total_customers = (await db.execute(customer_q)).scalar() or 0
    total_regions = (await db.execute(zone_q)).scalar() or 0
    total_communities = (await db.execute(comm_q)).scalar() or 0

    return {
        "status": "ok",
        "data": {
            "total_nodes": total_nodes,
            "online_nodes": online_nodes,
            "active_alerts": 0,
            "total_customers": total_customers,
            "total_regions": total_regions,
            "total_communities": total_communities,
            "system_health": 100 if total_nodes == 0 else int((online_nodes / total_nodes) * 100)
        }
    }

@router.get("/audit-logs", tags=["monitoring"])
async def get_audit_logs(distributor_id: Optional[str] = None, limit: int = 15, db: AsyncSession = Depends(get_db)):
    from models import AuditLog
    from sqlalchemy.orm import selectinload

    query = select(AuditLog).options(selectinload(AuditLog.user)).order_by(AuditLog.created_at.desc()).limit(limit)
    
    if distributor_id:
        try:
            query = query.where(AuditLog.distributor_id == uuid.UUID(distributor_id))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid distributor ID")
            
    result = await db.execute(query)
    return {"status": "ok", "data": result.scalars().all()}

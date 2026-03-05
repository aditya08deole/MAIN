import asyncio
import logging
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from pydantic import BaseModel
import uuid
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone

from database import get_db
from models import Zone, Community, Distributor, Customer, EvaraTank, EvaraFlow, EvaraDeep, AuditLog
from config import get_settings
from auth_helper import get_current_user, requires_superadmin, _get_supabase, get_blocking_executor
from background_jobs import enqueue_job, get_job_status, start_background_jobs
from schemas import UserResponse, CustomerCreate
from database import SessionLocal
from ingestion_service import ingest_device_now
from thingspeak import get_thingspeak_client, TelemetryMapper
import math

settings = get_settings()
router = APIRouter()
logger = logging.getLogger(__name__)


def _create_supabase_user_sync(email: str, password: str, role: str, display_name: str):
    """
    Synchronous wrapper for supabase.auth.admin.create_user().
    Must be called via run_in_executor — supabase-py 2.x is sync-only.
    """
    sb = _get_supabase()
    if sb is None:
        raise RuntimeError("Supabase client not available")
    return sb.auth.admin.create_user({
        "email": email,
        "password": password,
        "email_confirm": True,
        "user_metadata": {
            "role": role,
            "display_name": display_name,
        },
    })


def _list_supabase_users_by_email_sync(email: str):
    """Look up an existing auth user by email (used when create fails with 'already registered')."""
    sb = _get_supabase()
    if sb is None:
        raise RuntimeError("Supabase client not available")
    # list_users returns paginated results; search for the email
    resp = sb.auth.admin.list_users()
    if resp:
        users = resp if isinstance(resp, list) else getattr(resp, 'users', [])
        for u in users:
            if getattr(u, 'email', '').lower() == email.lower():
                return u
    return None


# ============================================================
# CUSTOMERS
# ============================================================

@router.post("/customers", response_model=UserResponse, status_code=status.HTTP_201_CREATED, tags=["customers"])
async def create_customer(
    customer: CustomerCreate,
    current_admin: dict = Depends(requires_superadmin),
    db: AsyncSession = Depends(get_db),
    background: bool = True,
):
    """Create a new customer with Supabase Auth."""
    try:
        community_uuid = uuid.UUID(customer.community_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid community ID format")

    result = await db.execute(select(Community).where(Community.id == str(community_uuid)))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Community {customer.community_id} not found")

    # If requested, enqueue provisioning work and return 202 Accepted with job id.
    if background:
        payload = {
            "email": customer.email,
            "password": customer.password,
            "display_name": customer.display_name,
            "role": customer.role,
            "community_id": str(community_uuid),
            "phone_number": customer.phone_number,
            "full_name": customer.full_name,
        }
        job_id = await enqueue_job("create_customer", payload)
        return {"status": "accepted", "job_id": job_id}

    # ── Create the Supabase Auth user (synchronous path) ───────────────────
    # Run in executor because supabase-py 2.x is synchronous — calling it
    # directly would block asyncio's event loop.
    supabase_user_id: str | None = None
    # Fast pre-check: avoid creating an Auth user if a profile already exists
    try:
        email_check = await db.execute(text("SELECT 1 FROM customers WHERE lower(email) = lower(:e) LIMIT 1"), {"e": customer.email})
        if email_check.fetchone():
            raise HTTPException(status_code=409, detail=f"Email '{customer.email}' already registered as profile")
    except HTTPException:
        raise
    except Exception:
        # If the pre-check fails, continue — the downstream create will catch duplicates
        pass

    # ── Create the Supabase Auth user ───────────────────────────────────────
    supabase_user_id: str | None = None
    try:
        loop = asyncio.get_event_loop()
        executor = get_blocking_executor()
        auth_task = loop.run_in_executor(
            executor,
            _create_supabase_user_sync,
            customer.email,
            customer.password,
            customer.role or "customer",
            customer.display_name,
        )
        # Bound the blocking call so slow 3rd-party SDK does not hang requests.
        auth_response = await asyncio.wait_for(auth_task, timeout=12.0)
        if not auth_response or not auth_response.user:
            raise HTTPException(status_code=500, detail="Supabase Auth returned no user — unknown error")
        supabase_user_id = str(auth_response.user.id)
        logger.info("[ADMIN] Supabase Auth user created: %s (%s)", supabase_user_id, customer.email)
    except HTTPException:
        raise
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Timed out while creating Auth user")
    except Exception as e:
        err_msg = str(e)
        logger.error("[ADMIN] Supabase user creation failed: %s — %s", type(e).__name__, err_msg)

        # ── "Already registered" recovery path ──────────────────────────────
        # If an auth user already exists (e.g. from a previous failed attempt),
        # look them up and reuse their ID to create/update the DB profile.
        if "already registered" in err_msg or "already been registered" in err_msg or "already exists" in err_msg:
            logger.info("[ADMIN] Email already in Auth — looking up existing auth user for %s", customer.email)
            try:
                loop2 = asyncio.get_event_loop()
                existing_auth_user = await loop2.run_in_executor(
                    None, _list_supabase_users_by_email_sync, customer.email
                )
                if existing_auth_user:
                    supabase_user_id = str(existing_auth_user.id)
                    logger.info("[ADMIN] Reusing existing auth user %s", supabase_user_id)
                else:
                    raise HTTPException(status_code=409, detail=f"Email '{customer.email}' is already registered but could not look up the existing account.")
            except HTTPException:
                raise
            except Exception as lookup_err:
                raise HTTPException(status_code=409, detail=f"Email '{customer.email}' is already registered.")
        elif "Password should be" in err_msg or ("password" in err_msg.lower() and "weak" in err_msg.lower()):
            raise HTTPException(status_code=400, detail=f"Password does not meet requirements: {err_msg}")
        else:
            raise HTTPException(status_code=500, detail=f"Failed to create Auth user: {err_msg}")

    # Trigger is a no-op — create the profile row directly with the auth UUID
    customer_profile = Customer(
        id           = supabase_user_id,
        email        = customer.email,
        display_name = customer.display_name,
        full_name    = customer.full_name,
        phone_number = customer.phone_number,
        role         = customer.role or "customer",
        community_id = str(community_uuid),
        status       = "active",
    )
    db.add(customer_profile)
    try:
        await db.commit()
        await db.refresh(customer_profile)
    except Exception as e:
        await db.rollback()
        logger.error("[ADMIN] Failed to insert customer profile: %s", e)
        # Compensating action: try to remove the Supabase Auth user we just created
        try:
            sb = _get_supabase()
            if sb and supabase_user_id and hasattr(sb.auth.admin, "delete_user"):
                try:
                    # Best-effort delete to avoid orphaned auth users
                    sb.auth.admin.delete_user(supabase_user_id)
                    logger.info("[ADMIN] Deleted Supabase user %s after DB failure", supabase_user_id)
                except Exception as del_err:
                    logger.warning("[ADMIN] Failed to delete Supabase user %s: %s", supabase_user_id, del_err)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"User created in Auth but profile insert failed: {e}")
    return customer_profile


@router.get("/customers", tags=["customers"])
async def get_customers_list(
    community_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    try:
        if community_id:
            stmt = text(
                "SELECT id, email, display_name, full_name, phone_number, role, status, community_id, distributor_id, created_at "
                "FROM customers WHERE community_id = :cid AND role::text ILIKE 'customer' ORDER BY created_at DESC"
            )
            result = await db.execute(stmt, {"cid": community_id})
        else:
            stmt = text(
                "SELECT id, email, display_name, full_name, phone_number, role, status, community_id, distributor_id, created_at "
                "FROM customers WHERE role::text ILIKE 'customer' ORDER BY created_at DESC"
            )
            result = await db.execute(stmt)

        rows = result.fetchall()
        customers = []
        for r in rows:
            try:
                cid = str(r.community_id) if getattr(r, "community_id", None) else None
                did = str(r.distributor_id) if getattr(r, "distributor_id", None) else None
                created = r.created_at.isoformat() if getattr(r, "created_at", None) else None
                customers.append({
                    "id": str(r.id),
                    "email": r.email,
                    "display_name": getattr(r, "display_name", None),
                    "full_name": getattr(r, "full_name", None),
                    "phone_number": getattr(r, "phone_number", None),
                    "role": str(r.role),
                    "status": getattr(r, "status", "active"),
                    "community_id": cid,
                    "distributor_id": did,
                    "created_at": created,
                })
            except Exception as row_err:
                logger.warning("[ADMIN] Mapping customer row %s: %s", getattr(r, "id", "?"), row_err)
        return {"status": "ok", "data": customers}
    except Exception as e:
        logger.error("[ADMIN] get_customers_list error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to load customers")


@router.get('/provision/{job_id}', tags=["customers", "jobs"])
async def provision_job_status(job_id: str):
    st = await get_job_status(job_id)
    if not st:
        raise HTTPException(status_code=404, detail='Job not found')
    return {"status": st.get('status'), "result": st.get('result'), "error": st.get('error')}


@router.post('/devtools/enqueue-create-customer', tags=["devtools"])
async def devtools_enqueue_create_customer(payload: dict):
    """Development-only: enqueue a create_customer job (no auth)."""
    from config import get_settings
    cfg = get_settings()
    if cfg.ENVIRONMENT != 'development':
        raise HTTPException(status_code=403, detail='Devtools disabled')
    required = ['email', 'password', 'display_name', 'community_id']
    for r in required:
        if r not in payload:
            raise HTTPException(status_code=400, detail=f'Missing {r}')
    job_id = await enqueue_job('create_customer', payload)
    return {"status": "accepted", "job_id": job_id}


# ============================================================
# ZONES
# ============================================================

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


@router.get("/health/supabase", tags=["health"])
async def supabase_health():
    """Quick health check for Supabase admin API (sync SDK called in threadpool)."""
    try:
        sb = _get_supabase()
        if sb is None:
            return {"ok": False, "error": "Supabase client not configured"}
        loop = asyncio.get_event_loop()
        executor = get_blocking_executor()
        task = loop.run_in_executor(executor, lambda: getattr(sb.auth.admin, "list_users")())
        users = await asyncio.wait_for(task, timeout=6.0)
        return {"ok": True, "users_sample_count": len(users) if users is not None else 0}
    except asyncio.TimeoutError:
        return {"ok": False, "error": "timeout"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@router.post("/zones", tags=["metadata"], status_code=status.HTTP_201_CREATED)
async def create_zone(
    zone_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(requires_superadmin)
):
    new_zone = Zone(
        name=zone_data.get("name"),
        state=zone_data.get("state"),
        country=zone_data.get("country", "India"),
        zone_code=zone_data.get("zone_code"),
        description=zone_data.get("description"),
        distributor_id=zone_data.get("distributor_id"),
        is_active=zone_data.get("is_active", True),
    )
    db.add(new_zone)
    await db.commit()
    await db.refresh(new_zone)
    return {"status": "ok", "data": {"id": str(new_zone.id), "name": new_zone.name}}


@router.get("/zones/{zone_id}", tags=["metadata"])
async def get_zone(zone_id: str, db: AsyncSession = Depends(get_db)):
    try:
        stmt = text("SELECT id, name, state, country, zone_code, description, is_active, distributor_id FROM zones WHERE id = :zid")
        result = await db.execute(stmt, {"zid": zone_id})
        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Zone not found")
        return {"status": "ok", "data": {
            "id": str(row.id), "name": row.name, "state": row.state, "country": row.country,
            "zone_code": row.zone_code, "description": row.description, "is_active": row.is_active,
            "distributor_id": str(row.distributor_id) if row.distributor_id else None,
        }}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        logger.error("[ADMIN] get_zone error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# COMMUNITIES
# ============================================================

@router.get("/communities", tags=["metadata"])
async def get_communities(zone_id: Optional[str] = None, db: AsyncSession = Depends(get_db), limit: int = 200, offset: int = 0):
    try:
        if zone_id:
            stmt = text(
                "SELECT id, name, zone_id, address, pincode, contact_person, contact_email, contact_phone, "
                "operational_status, contact_info FROM communities WHERE zone_id = :zid ORDER BY name LIMIT :lim OFFSET :off"
            )
            result = await db.execute(stmt, {"zid": zone_id, "lim": limit, "off": offset})
        else:
            stmt = text(
                "SELECT id, name, zone_id, address, pincode, contact_person, contact_email, contact_phone, "
                "operational_status, contact_info FROM communities ORDER BY name LIMIT :lim OFFSET :off"
            )
            result = await db.execute(stmt, {"lim": limit, "off": offset})

        rows = result.fetchall()
        return {"status": "ok", "data": [
            {
                "id": str(r.id), "name": r.name, "zone_id": str(r.zone_id),
                "address": r.address, "pincode": r.pincode, "contact_person": r.contact_person,
                "contact_email": r.contact_email, "contact_phone": r.contact_phone,
                "operational_status": r.operational_status,
                "notes": r.contact_info,
            } for r in rows
        ]}
    except Exception as e:
        logger.error("[ADMIN] get_communities error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/communities", tags=["metadata"], status_code=status.HTTP_201_CREATED)
async def create_community(
    community_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(requires_superadmin)
):
    try:
        new_community = Community(
            name=community_data.get("name"),
            zone_id=str(uuid.UUID(community_data.get("zone_id"))),
            address=community_data.get("address"),
            pincode=community_data.get("pincode"),
            contact_person=community_data.get("contact_person"),
            contact_email=community_data.get("contact_email"),
            contact_phone=community_data.get("contact_phone"),
            operational_status=community_data.get("operational_status", "active"),
            contact_info=community_data.get("notes"),
        )
        db.add(new_community)
        await db.commit()
        await db.refresh(new_community)
        return {"status": "ok", "data": {"id": str(new_community.id), "name": new_community.name}}
    except Exception as e:
        logger.error("[ADMIN] create_community error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/hierarchy")
async def get_hierarchy(db: AsyncSession = Depends(get_db)):
    try:
        z_result = await db.execute(text("SELECT id, name FROM zones ORDER BY name"))
        zones = z_result.fetchall()
        c_result = await db.execute(text("SELECT id, name, zone_id FROM communities ORDER BY name"))
        communities = c_result.fetchall()
        # Build zone→communities map in O(C) using defaultdict
        zone_map: dict = defaultdict(list)
        for c in communities:
            zone_map[str(c.zone_id)].append({"id": str(c.id), "name": c.name})
        hierarchy = [
            {"id": str(z.id), "name": z.name, "communities": zone_map[str(z.id)]}
            for z in zones
        ]
        return {"status": "ok", "data": hierarchy}
    except Exception as e:
        logger.error("[ADMIN] get_hierarchy error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to load hierarchy")


# ============================================================
# DEVICES  (unified: evaratank + evaraflow + evaradeep)
# ============================================================

_DEVICE_UNION_SQL = text("""
    SELECT id, node_key, label, 'EvaraTank' AS device_type, is_active, latitude, longitude,
           community_id, client_id, thingspeak_channel_id, last_seen
    FROM evaratank WHERE deleted_at IS NULL
    UNION ALL
    SELECT id, node_key, label, 'EvaraFlow' AS device_type, is_active, latitude, longitude,
           community_id, client_id, thingspeak_channel_id, last_seen
    FROM evaraflow WHERE deleted_at IS NULL
    UNION ALL
    SELECT id, node_key, label, 'EvaraDeep' AS device_type, is_active, latitude, longitude,
           community_id, client_id, thingspeak_channel_id, last_seen
    FROM evaradeep WHERE deleted_at IS NULL
    ORDER BY label
""")


@router.get("/devices", tags=["devices"])
async def get_devices(
    community_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    limit: int = 500,
    offset: int = 0
):
    """Return all devices across all three device tables as a flat list."""
    try:
        # Apply pagination to the union. Wrap union in subquery and apply ORDER/LIMIT/OFFSET
        if community_id:
            sql = text(f"SELECT * FROM (" +
                       "SELECT id, node_key, label, 'EvaraTank' AS device_type, is_active, "
                       "latitude, longitude, community_id, client_id, thingspeak_channel_id, last_seen "
                       "FROM evaratank WHERE deleted_at IS NULL AND community_id = :cid "
                       "UNION ALL "
                       "SELECT id, node_key, label, 'EvaraFlow' AS device_type, is_active, "
                       "latitude, longitude, community_id, client_id, thingspeak_channel_id, last_seen "
                       "FROM evaraflow WHERE deleted_at IS NULL AND community_id = :cid "
                       "UNION ALL "
                       "SELECT id, node_key, label, 'EvaraDeep' AS device_type, is_active, "
                       "latitude, longitude, community_id, client_id, thingspeak_channel_id, last_seen "
                       "FROM evaradeep WHERE deleted_at IS NULL AND community_id = :cid) t ORDER BY label LIMIT :lim OFFSET :off")
            result = await db.execute(sql, {"cid": community_id, "lim": limit, "off": offset})
        else:
            sql = text("SELECT * FROM (" +
                       _DEVICE_UNION_SQL.text + ") t ORDER BY label LIMIT :lim OFFSET :off")
            result = await db.execute(sql, {"lim": limit, "off": offset})

        rows = result.fetchall()
        devices = []
        for r in rows:
            devices.append({
                "id": str(r.id),
                "node_key": r.node_key,
                "label": r.label,
                "name": r.label,
                "device_type": r.device_type,
                "is_active": r.is_active,
                "latitude": r.latitude,
                "longitude": r.longitude,
                "community_id": str(r.community_id) if r.community_id else None,
                "client_id": str(r.client_id) if r.client_id else None,
                "thingspeak_channel_id": r.thingspeak_channel_id,
                "last_seen": r.last_seen.isoformat() if r.last_seen else None,
            })
        return {"status": "ok", "data": devices}
    except Exception as e:
        logger.error("[ADMIN] get_devices error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to load devices")


@router.get('/devices/{device_id}/telemetry', tags=['devices'])
async def get_device_telemetry(device_id: str, results: int = 1, db: AsyncSession = Depends(get_db)):
    """Fetch latest telemetry from ThingSpeak for a device and return normalized values.
    Returns level percentage, estimated volume (liters), temperature, last_entry timestamp and online status.
    """
    try:
        # Try to find device in tank/flow/deep tables
        stmt = text("SELECT 'tank' as dtype, id, label, thingspeak_channel_id, thingspeak_read_key, height_m, length_m, breadth_m, radius_m, capacity_liters, water_level_field, temperature_field, last_seen FROM evaratank WHERE id = :id LIMIT 1")
        res = await db.execute(stmt, {"id": device_id})
        row = res.fetchone()
        dtype = None
        if not row:
            stmt = text("SELECT 'flow' as dtype, id, label, thingspeak_channel_id, thingspeak_read_key, NULL as height_m, NULL as length_m, NULL as breadth_m, NULL as radius_m, NULL as capacity_liters, meter_reading_field as water_level_field, flow_rate_field as temperature_field, last_seen FROM evaraflow WHERE id = :id LIMIT 1")
            res = await db.execute(stmt, {"id": device_id})
            row = res.fetchone()
        if not row:
            stmt = text("SELECT 'deep' as dtype, id, label, thingspeak_channel_id, thingspeak_read_key, total_bore_depth as height_m, NULL as length_m, NULL as breadth_m, NULL as radius_m, NULL as capacity_liters, depth_field as water_level_field, temperature_field, last_seen FROM evaradeep WHERE id = :id LIMIT 1")
            res = await db.execute(stmt, {"id": device_id})
            row = res.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail='Device not found')

        channel_id = getattr(row, 'thingspeak_channel_id', None)
        read_key = getattr(row, 'thingspeak_read_key', None)
        if not channel_id:
            return {"status": "ok", "data": None}

        # Fetch from ThingSpeak
        ts = get_thingspeak_client()
        data = await ts.get_history(channel_id, read_key=read_key, results=results)
        feeds = data.get('feeds', []) if data else []

        last_feed = feeds[-1] if feeds else None

        # Build config for mapper from device row
        cfg = {
            'tank_height_cm': (getattr(row, 'height_m', None) * 100) if getattr(row, 'height_m', None) else None,
            'field_mapping': {
                'depth_field': getattr(row, 'water_level_field', 'field1'),
                'temperature': getattr(row, 'temperature_field', 'field2')
            }
        }

        mapped = {}
        if last_feed:
            # Normalize feed: ThingSpeak uses keys 'field1'..'field8'
            feed_map = {k: v for k, v in last_feed.items() if k.startswith('field')}
            if getattr(row, 'dtype', None) == 'flow' or row._mapping and row._mapping.get('dtype') == 'flow':
                mapped = TelemetryMapper.map_flow(feed_map, cfg)
            elif getattr(row, 'dtype', None) == 'deep' or row._mapping and row._mapping.get('dtype') == 'deep':
                mapped = TelemetryMapper.map_deep(feed_map, cfg)
            else:
                mapped = TelemetryMapper.map_tank(feed_map, cfg)

        # Compute volume for tank if possible
        volume_liters = None
        if mapped.get('level_percentage') is not None:
            # Prefer explicit capacity if set
            cap = getattr(row, 'capacity_liters', None)
            if cap:
                volume_liters = round(cap * (mapped['level_percentage'] / 100.0), 3)
            else:
                # Try geometric calc ­— supports rectangular and cylindrical
                h_m = getattr(row, 'height_m', None)
                if h_m:
                    water_h_m = h_m * (mapped['level_percentage'] / 100.0)
                    if getattr(row, 'length_m', None) and getattr(row, 'breadth_m', None):
                        vol_m3 = float(row.length_m) * float(row.breadth_m) * float(water_h_m)
                        volume_liters = round(vol_m3 * 1000.0, 3)
                    elif getattr(row, 'radius_m', None):
                        vol_m3 = math.pi * (float(row.radius_m) ** 2) * float(water_h_m)
                        volume_liters = round(vol_m3 * 1000.0, 3)

        # Online detection using last feed timestamp or DB last_seen
        last_ts = None
        if last_feed and last_feed.get('created_at'):
            try:
                last_ts = datetime.fromisoformat(last_feed.get('created_at').replace('Z', '+00:00'))
            except Exception:
                last_ts = None
        if not last_ts:
            last_ts = getattr(row, 'last_seen', None)

        online = False
        if last_ts:
            # Normalize to timezone-aware UTC datetimes for safe subtraction
            if getattr(last_ts, 'tzinfo', None) is None:
                last_ts = last_ts.replace(tzinfo=timezone.utc)
            now = datetime.now(timezone.utc)
            age_seconds = (now - last_ts).total_seconds()
            online = age_seconds <= 30 * 60  # 30 minutes freshness

        return {
            "status": "ok",
            "data": {
                "device_id": str(row.id),
                "label": row.label,
                "last_entry": last_ts.isoformat() if last_ts else None,
                "online": online,
                "level_percentage": mapped.get('level_percentage'),
                "volume_liters": volume_liters,
                "temperature": mapped.get('temperature_value') or mapped.get('temperature'),
                "raw_feed": last_feed,
                "history_count": len(feeds),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("[ADMIN] get_device_telemetry error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/telemetry/devices/{device_id}/telemetry/latest', tags=['telemetry'])
async def telemetry_latest(device_id: str, db: AsyncSession = Depends(get_db)):
    """Return latest normalized telemetry for device (wrapper for frontend)."""
    try:
        resp = await get_device_telemetry(device_id, 1, db)
        return {"status": "ok", "data": resp['data']}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("[Telemetry] latest error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/telemetry/devices/{device_id}/telemetry/history', tags=['telemetry'])
async def telemetry_history(device_id: str, results: int = Query(100, ge=1, le=8000), db: AsyncSession = Depends(get_db)):
    """Return historical feeds normalized for frontend charts."""
    try:
        # Find device row
        stmt = text("SELECT id, label, thingspeak_channel_id, thingspeak_read_key, height_m, length_m, breadth_m, radius_m, capacity_liters, water_level_field, temperature_field FROM evaratank WHERE id = :id LIMIT 1")
        res = await db.execute(stmt, {"id": device_id})
        row = res.fetchone()
        if not row:
            stmt = text("SELECT id, label, thingspeak_channel_id, thingspeak_read_key, NULL as height_m, NULL as length_m, NULL as breadth_m, NULL as radius_m, NULL as capacity_liters, meter_reading_field as water_level_field, flow_rate_field as temperature_field FROM evaraflow WHERE id = :id LIMIT 1")
            res = await db.execute(stmt, {"id": device_id})
            row = res.fetchone()
        if not row:
            stmt = text("SELECT id, label, thingspeak_channel_id, thingspeak_read_key, total_bore_depth as height_m, NULL as length_m, NULL as breadth_m, NULL as radius_m, NULL as capacity_liters, depth_field as water_level_field, temperature_field FROM evaradeep WHERE id = :id LIMIT 1")
            res = await db.execute(stmt, {"id": device_id})
            row = res.fetchone()

        if not row or not getattr(row, 'thingspeak_channel_id', None):
            return {"status": "ok", "feeds": []}

        ts = get_thingspeak_client()
        data = await ts.get_history(getattr(row, 'thingspeak_channel_id'), read_key=getattr(row, 'thingspeak_read_key'), results=results)
        feeds = data.get('feeds', []) if data else []

        mapped_feeds = []
        for f in feeds:
            feed_map = {k: v for k, v in f.items() if k.startswith('field')}
            cfg = {
                'tank_height_cm': (getattr(row, 'height_m', None) * 100) if getattr(row, 'height_m', None) else None,
                'field_mapping': {
                    'depth_field': getattr(row, 'water_level_field', 'field1'),
                    'temperature': getattr(row, 'temperature_field', 'field2')
                }
            }
            # choose mapper by available fields
            if getattr(row, 'meter_reading_field', None) or getattr(row, 'flow_rate_field', None):
                mapped = TelemetryMapper.map_flow(feed_map, cfg)
            elif getattr(row, 'depth_field', None):
                mapped = TelemetryMapper.map_deep(feed_map, cfg)
            else:
                mapped = TelemetryMapper.map_tank(feed_map, cfg)

            # augment feed with mapped values
            f['level_percentage'] = mapped.get('level_percentage')
            f['temperature_value'] = mapped.get('temperature_value')
            f['volume_liters'] = None
            if f.get('level_percentage') is not None:
                cap = getattr(row, 'capacity_liters', None)
                if cap:
                    f['volume_liters'] = round(cap * (f['level_percentage'] / 100.0), 3)
            mapped_feeds.append(f)

        return {"status": "ok", "feeds": mapped_feeds}
    except Exception as e:
        logger.exception("[Telemetry] history error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/telemetry/devices/{device_id}/config', tags=['telemetry'])
async def telemetry_config(device_id: str, db: AsyncSession = Depends(get_db)):
    """Return device telemetry configuration (ThingSpeak IDs, field names, dimensions)."""
    try:
        stmt = text("SELECT id, label, thingspeak_channel_id, thingspeak_read_key, water_level_field, temperature_field, height_m, length_m, breadth_m, radius_m, capacity_liters FROM evaratank WHERE id = :id LIMIT 1")
        res = await db.execute(stmt, {"id": device_id})
        row = res.fetchone()
        dtype = 'evaratank'
        if not row:
            stmt = text("SELECT id, label, thingspeak_channel_id, thingspeak_read_key, meter_reading_field as water_level_field, flow_rate_field as temperature_field, NULL as height_m, NULL as length_m, NULL as breadth_m, NULL as radius_m, NULL as capacity_liters FROM evaraflow WHERE id = :id LIMIT 1")
            res = await db.execute(stmt, {"id": device_id})
            row = res.fetchone(); dtype = 'evaraflow'
        if not row:
            stmt = text("SELECT id, label, thingspeak_channel_id, thingspeak_read_key, depth_field as water_level_field, temperature_field, total_bore_depth as height_m, NULL as length_m, NULL as breadth_m, NULL as radius_m, NULL as capacity_liters FROM evaradeep WHERE id = :id LIMIT 1")
            res = await db.execute(stmt, {"id": device_id})
            row = res.fetchone(); dtype = 'evaradeep'

        if not row:
            raise HTTPException(status_code=404, detail='Device not found')

        return {"status": "ok", "data": {
            "device_id": str(row.id),
            "label": row.label,
            "thingspeak_channel_id": getattr(row, 'thingspeak_channel_id', None),
            "thingspeak_read_key": getattr(row, 'thingspeak_read_key', None),
            "water_level_field": getattr(row, 'water_level_field', None),
            "temperature_field": getattr(row, 'temperature_field', None),
            "height_m": getattr(row, 'height_m', None),
            "length_m": getattr(row, 'length_m', None),
            "breadth_m": getattr(row, 'breadth_m', None),
            "radius_m": getattr(row, 'radius_m', None),
            "capacity_liters": getattr(row, 'capacity_liters', None),
            "device_type": dtype,
        }}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("[Telemetry] config error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/devices", tags=["devices"], status_code=status.HTTP_201_CREATED)
async def create_device(
    device_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new device in the appropriate unified table."""
    node_key = device_data.get("node_key") or str(uuid.uuid4())
    # Accept both 'device_type' (e.g. 'tank') and 'analytics_template' (e.g. 'EvaraTank')
    dev_type = (device_data.get("device_type") or device_data.get("analytics_template") or "").lower()
    community_id = device_data.get("community_id") or None
    client_id = device_data.get("customer_id") or device_data.get("client_id") or None

    common = dict(
        node_key=node_key,
        label=device_data.get("name") or device_data.get("label", node_key),
        latitude=float(device_data["latitude"]) if device_data.get("latitude") else None,
        longitude=float(device_data["longitude"]) if device_data.get("longitude") else None,
        community_id=community_id,
        client_id=client_id,
        thingspeak_channel_id=device_data.get("thingspeak_channel_id"),
        thingspeak_read_key=device_data.get("thingspeak_read_key"),
        thingspeak_write_key=device_data.get("thingspeak_write_key"),
        is_active=device_data.get("is_active", True),
    )

    if dev_type in ("tank", "evaratank"):
        device = EvaraTank(
            **common,
            water_level_field=device_data.get("water_level_field", "field1"),
            temperature_field=device_data.get("temperature_field", "field2"),
            tank_shape=device_data.get("tank_shape", "rectangular"),
            height_m=float(device_data["height_m"]) if device_data.get("height_m") else None,
            length_m=float(device_data["length_m"]) if device_data.get("length_m") else None,
            breadth_m=float(device_data["breadth_m"]) if device_data.get("breadth_m") else None,
            radius_m=float(device_data["radius_m"]) if device_data.get("radius_m") else None,
            capacity_liters=float(device_data["capacity_liters"]) if device_data.get("capacity_liters") else None,
        )
    elif dev_type in ("flow", "evaraflow"):
        device = EvaraFlow(
            **common,
            meter_reading_field=device_data.get("meter_reading_field", "field1"),
            flow_rate_field=device_data.get("flow_rate_field", "field2"),
            pipe_diameter=float(device_data["pipe_diameter"]) if device_data.get("pipe_diameter") else None,
            max_flow_rate=float(device_data["max_flow_rate"]) if device_data.get("max_flow_rate") else None,
        )
    elif dev_type in ("deep", "evaradeep"):
        device = EvaraDeep(
            **common,
            depth_field=device_data.get("depth_field", "field2"),
            temperature_field=device_data.get("temperature_field", "field1"),
            total_bore_depth=float(device_data["total_bore_depth"]) if device_data.get("total_bore_depth") else None,
            static_water_level=float(device_data["static_water_level"]) if device_data.get("static_water_level") else None,
            dynamic_water_level=float(device_data["dynamic_water_level"]) if device_data.get("dynamic_water_level") else None,
            recharge_threshold=float(device_data.get("recharge_threshold", 0)),
        )
    else:
        raise HTTPException(status_code=400, detail=f"Unknown device_type '{dev_type}'. Must be 'tank', 'flow', or 'deep'.")

    db.add(device)
    await db.commit()
    await db.refresh(device)

    # Kick off an immediate ThingSpeak fetch so the dashboard shows data without
    # waiting for the next 2-15 minute background polling cycle.
    _type_map = {"tank": "EvaraTank", "evaratank": "EvaraTank",
                 "flow": "EvaraFlow",  "evaraflow": "EvaraFlow",
                 "deep": "EvaraDeep", "evaradeep": "EvaraDeep"}
    canonical_type = _type_map.get(dev_type)
    if canonical_type:
        asyncio.create_task(ingest_device_now(SessionLocal, str(device.id), canonical_type))

    return {"status": "ok", "data": {"id": str(device.id), "node_key": device.node_key, "label": device.label, "device_type": dev_type}}


# ============================================================
# STATS
# ============================================================

@router.get("/stats", tags=["monitoring"])
async def get_admin_stats(
    distributor_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    try:
        if distributor_id:
            try:
                d_uuid = str(uuid.UUID(distributor_id))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid distributor ID")

            sql = text("""
                WITH zone_ids AS (SELECT id FROM zones WHERE distributor_id = :did),
                     comm_ids AS (SELECT id FROM communities WHERE zone_id IN (SELECT id FROM zone_ids))
                SELECT
                    (SELECT COUNT(*) FROM evaratank WHERE community_id IN (SELECT id FROM comm_ids) AND deleted_at IS NULL) +
                    (SELECT COUNT(*) FROM evaraflow WHERE community_id IN (SELECT id FROM comm_ids) AND deleted_at IS NULL) +
                    (SELECT COUNT(*) FROM evaradeep WHERE community_id IN (SELECT id FROM comm_ids) AND deleted_at IS NULL) AS total_devices,
                    (SELECT COUNT(*) FROM customers WHERE role = 'customer') AS total_customers,
                    (SELECT COUNT(*) FROM zones WHERE distributor_id = :did) AS total_regions,
                    (SELECT COUNT(*) FROM communities WHERE zone_id IN (SELECT id FROM zone_ids)) AS total_communities
            """)
            row = (await db.execute(sql, {"did": d_uuid})).fetchone()
        else:
            sql = text("""
                SELECT
                    (SELECT COUNT(*) FROM evaratank WHERE deleted_at IS NULL) +
                    (SELECT COUNT(*) FROM evaraflow WHERE deleted_at IS NULL) +
                    (SELECT COUNT(*) FROM evaradeep WHERE deleted_at IS NULL) AS total_devices,
                    (SELECT COUNT(*) FROM customers WHERE role = 'customer') AS total_customers,
                    (SELECT COUNT(*) FROM zones) AS total_regions,
                    (SELECT COUNT(*) FROM communities) AS total_communities
            """)
            row = (await db.execute(sql)).fetchone()

        total = int(row.total_devices or 0)
        return {"status": "ok", "data": {
            "total_nodes": total,
            "online_nodes": total,  # snapshot-based online count can be layered later
            "active_alerts": 0,
            "total_customers": int(row.total_customers or 0),
            "total_regions": int(row.total_regions or 0),
            "total_communities": int(row.total_communities or 0),
            "system_health": 100,
        }}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        logger.error("[ADMIN] get_admin_stats error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# AUDIT LOGS
# ============================================================

@router.get("/audit-logs", tags=["monitoring"])
async def get_audit_logs(
    distributor_id: Optional[str] = None,
    limit: int = 15,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    query = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    if distributor_id:
        try:
            query = query.where(AuditLog.distributor_id == str(uuid.UUID(distributor_id)))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid distributor ID")

    result = await db.execute(query)
    logs = result.scalars().all()
    return {"status": "ok", "data": [
        {
            "id": str(log.id),
            "user_id": str(log.user_id) if log.user_id else None,
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "details": log.details,
            "created_at": log.created_at.isoformat(),
        } for log in logs
    ]}

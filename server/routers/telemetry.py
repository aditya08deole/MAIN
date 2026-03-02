"""
ThingSpeak telemetry proxy routes.
Now operates as a formal Ingestion Pipeline (Phase 2).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Dict, Any, Optional

from database import get_db
from models import Device, DeviceTelemetrySnapshot
from thingspeak import get_thingspeak_client
from auth_helper import get_current_user, get_optional_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["telemetry"])

@router.get("/nodes")
async def get_all_nodes(db: AsyncSession = Depends(get_db)):
    """Backend support for map rendering - optimized with telemetry join."""
    from sqlalchemy import text
    # Optimized query joining devices with their latest telemetry snapshots
    query = text("""
        SELECT 
            d.id, d.node_key, d.label, d.asset_type, d.status as device_status, 
            d.latitude, d.longitude, d.is_active, d.community_id, d.user_id,
            d.analytics_template,
            s.last_timestamp, s.level_percentage, s.depth_value, s.flow_rate, s.total_liters
        FROM devices d
        LEFT JOIN telemetry_snapshots s ON d.id = s.device_id
        WHERE d.deleted_at IS NULL
        ORDER BY d.created_at DESC
    """)
    
    result = await db.execute(query)
    rows = result.fetchall()
    
    devices = []
    for r in rows:
        # Determine status based on freshness if timestamp exists
        # This logic matches computeDeviceStatus in frontend
        from datetime import datetime, timedelta
        last_ts = r.last_timestamp
        status = "Offline"
        if last_ts:
            if isinstance(last_ts, str):
                try:
                    last_ts = datetime.fromisoformat(last_ts.replace('Z', '+00:00'))
                except:
                    last_ts = None
            
            if last_ts:
                threshold = timedelta(hours=2) if r.analytics_template == 'EvaraDeep' else timedelta(minutes=30)
                if datetime.utcnow() - last_ts.replace(tzinfo=None) < threshold:
                    status = "Online"

        devices.append({
            "id": str(r.id),
            "node_key": r.node_key,
            "label": r.label,
            "name": r.label or r.node_key or "Unnamed Node",
            "asset_type": r.asset_type or ("tank" if r.analytics_template == 'EvaraTank' else "flow_meter" if r.analytics_template == 'EvaraFlow' else "borewell"),
            "status": status,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "is_active": r.is_active,
            "analytics_template": r.analytics_template,
            "last_seen": str(r.last_timestamp) if r.last_timestamp else None,
            "telemetry_snapshot": {
                "last_timestamp": str(r.last_timestamp) if r.last_timestamp else None,
                "level_percentage": r.level_percentage,
                "depth_value": r.depth_value,
                "flow_rate": r.flow_rate,
                "total_liters": r.total_liters
            } if r.last_timestamp else None
        })
    
    print(f"[OPTIMIZED] /nodes fetched {len(devices)} devices with telemetry")
    return {"status": "ok", "data": devices}

class TelemetryResponse(BaseModel):
    timestamp: str
    data: Dict[str, Any]

@router.get("/devices/{device_id}/telemetry/latest", response_model=TelemetryResponse)
async def trigger_ingestion_and_get_latest(
    device_id: str,
    current_user: Optional[dict] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Trigger ingestion pipeline for a device. 
    Fetches chunks, normalizes via typed mappers, and updates snapshots.
    """
    # 1. Fetch device and typed config
    from models import DeviceConfigTank, DeviceConfigFlow, DeviceConfigDeep
    
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()

    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
        
    # Get Credentials from specialized config tables (Isolated)
    channel_id = None
    read_key = None
    device_category = device.device_type # EvaraTank, EvaraDeep, EvaraFlow

    if device_category == 'EvaraTank':
        cfg_res = await db.execute(select(DeviceConfigTank).where(DeviceConfigTank.device_id == device.id))
        cfg = cfg_res.scalar_one_or_none()
        if cfg:
            channel_id, read_key = cfg.thingspeak_channel_id, cfg.thingspeak_read_key
    elif device_category == 'EvaraFlow':
        cfg_res = await db.execute(select(DeviceConfigFlow).where(DeviceConfigFlow.device_id == device.id))
        cfg = cfg_res.scalar_one_or_none()
        if cfg:
            channel_id, read_key = cfg.thingspeak_channel_id, cfg.thingspeak_read_key
    elif device_category == 'EvaraDeep':
        cfg_res = await db.execute(select(DeviceConfigDeep).where(DeviceConfigDeep.device_id == device.id))
        cfg = cfg_res.scalar_one_or_none()
        if cfg:
            channel_id, read_key = cfg.thingspeak_channel_id, cfg.thingspeak_read_key

    # Fallback to legacy config if not found in specialized tables (Transition period)
    if not channel_id:
        legacy_config = device.device_telemetry_config or {}
        channel_id = legacy_config.get("channel_id")
        read_key = legacy_config.get("read_key")
    
    if not channel_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No ThingSpeak channel configured")

    # 2. Trigger Coalesced Fetch from ThingSpeak
    thingspeak = get_thingspeak_client()
    data = await thingspeak.fetch_incremental_telemetry(
        device_id=str(device.id),
        channel_id=str(channel_id),
        read_key=read_key,
        last_fetched_at=device.last_fetched_at
    )

    # 3. Handle payload
    latest_feed = None
    if data and "feeds" in data and len(data["feeds"]) > 0:
        latest_feed = data["feeds"][-1]
    elif data and "created_at" in data:
        latest_feed = data

    # 4. Write Snapshot using Typed Mappers
    if latest_feed:
        from thingspeak import TelemetryMapper
        
        telemetry_time_str = latest_feed.get("created_at")
        entry_id = latest_feed.get("entry_id")
        
        try:
            telemetry_dt = datetime.strptime(telemetry_time_str, "%Y-%m-%dT%H:%M:%SZ")
        except Exception:
            telemetry_dt = datetime.utcnow()

        # Apply Typed Mapping
        config = device.device_telemetry_config or {} # Mapping still lives here for now
        typed_metrics = {}
        if device_category == 'EvaraTank':
            typed_metrics = TelemetryMapper.map_tank(latest_feed, config)
        elif device_category == 'EvaraFlow':
            typed_metrics = TelemetryMapper.map_flow(latest_feed, config)
        elif device_category == 'EvaraDeep':
            typed_metrics = TelemetryMapper.map_deep(latest_feed, config)

        # UPSERT into telemetry_snapshots
        stmt = insert(DeviceTelemetrySnapshot).values(
            device_id=device.id,
            payload=latest_feed,
            mapped_values=latest_feed, # Keep raw as fallback
            thingspeak_entry_id=entry_id,
            last_timestamp=telemetry_dt,
            updated_at=datetime.utcnow(),
            **typed_metrics # Splat typed columns
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=['device_id'],
            set_={
                'payload': stmt.excluded.payload,
                'thingspeak_entry_id': stmt.excluded.thingspeak_entry_id,
                'last_timestamp': stmt.excluded.last_timestamp,
                'updated_at': datetime.utcnow(),
                **{k: getattr(stmt.excluded, k) for k in typed_metrics.keys()}
            }
        )
        await db.execute(stmt)

        # Update Device
        device.last_fetched_at = datetime.utcnow()
        device.last_seen = telemetry_dt
        await db.commit()

        return TelemetryResponse(
            timestamp=telemetry_dt.isoformat(),
            data=latest_feed,
            **typed_metrics
        )
    
    else:
        # Fallback to existing snapshot
        snap_res = await db.execute(select(DeviceTelemetrySnapshot).where(DeviceTelemetrySnapshot.device_id == device_id))
        snapshot = snap_res.scalar_one_or_none()
        
        if snapshot:
            return TelemetryResponse(
                timestamp=snapshot.last_timestamp.isoformat() + "Z",
                data=snapshot.payload or {},
                level_percentage=snapshot.level_percentage,
                depth_value=snapshot.depth_value,
                temperature_value=snapshot.temperature_value,
                flow_rate=snapshot.flow_rate,
                total_liters=snapshot.total_liters
            )
        
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="No telemetry available")

@router.get("/devices/{device_id}/telemetry/history")
async def get_telemetry_history(
    device_id: str,
    results: int = 100,
    current_user: Optional[dict] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Bypass route for deep historical requests."""
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()

    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
        
    config = device.device_telemetry_config or {}
    channel_id = config.get("channel_id")
    read_key = config.get("read_key")
    
    if not channel_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No ThingSpeak channel configured")

    thingspeak = get_thingspeak_client()
    data = await thingspeak.get_history(str(channel_id), read_key, results=results)

    if not data:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Failed to fetch from ThingSpeak")

    return data

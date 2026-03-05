"""
ThingSpeak telemetry proxy routes — unified device schema (EvaraTank / EvaraFlow / EvaraDeep).
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from typing import Dict, Any, Optional
import hashlib
import hmac
import time

from database import get_db
from models import (
    EvaraTank, EvaraFlow, EvaraDeep,
    EvaraTankSnapshot, EvaraFlowSnapshot, EvaraDeepSnapshot,
)
from schemas import TelemetryResponse
from thingspeak import get_thingspeak_client
from auth_helper import get_current_user, get_optional_user
import logging

logger = logging.getLogger(__name__)
router = APIRouter(tags=["telemetry"])

# Module-level constant — avoids per-call dict re-creation
_ASSET_MAP = {"EvaraTank": "tank", "EvaraFlow": "flow_meter", "EvaraDeep": "borewell"}


# ============================================================
# HELPERS
# ============================================================

async def _find_device(db: AsyncSession, device_id: str):
    """
    Look up device_id across all three device tables.
    Returns (device_obj, device_type_str) or (None, None).
    """
    for Model, dtype in (
        (EvaraTank, "EvaraTank"),
        (EvaraFlow, "EvaraFlow"),
        (EvaraDeep, "EvaraDeep"),
    ):
        res = await db.execute(select(Model).where(Model.id == device_id))
        dev = res.scalar_one_or_none()
        if dev:
            return dev, dtype
    return None, None


def _online_status(last_ts, device_type: str) -> str:
    if not last_ts:
        return "Offline"
    if isinstance(last_ts, str):
        try:
            last_ts = datetime.fromisoformat(last_ts.replace("Z", "+00:00"))
        except Exception:
            return "Offline"
    if last_ts.tzinfo is None:
        last_ts = last_ts.replace(tzinfo=timezone.utc)
    threshold = timedelta(hours=2) if device_type == "EvaraDeep" else timedelta(minutes=30)
    return "Online" if datetime.now(timezone.utc) - last_ts < threshold else "Offline"


# ============================================================
# CIRCUIT BREAKER STATUS
# ============================================================

@router.get("/telemetry/circuit-breaker/status")
async def get_circuit_breaker_status(
    current_user: Optional[dict] = Depends(get_optional_user),
):
    client = get_thingspeak_client()
    now = time.time()
    channels = set(list(client._cb_state.keys()) + list(client._cb_failures.keys()))
    result = []
    for ch in sorted(channels):
        state = client._cb_state.get(ch, "closed")
        failures = client._cb_failures.get(ch, 0)
        opened_at = client._cb_opened_at.get(ch)
        retry_in: Optional[float] = None
        if state == "open" and opened_at:
            retry_in = max(0.0, client.CB_HALF_OPEN_TIMEOUT - (now - opened_at))
        result.append({
            "channel_id": ch,
            "state": state,
            "consecutive_failures": failures,
            "retry_in_seconds": round(retry_in, 1) if retry_in is not None else None,
        })
    return {"circuit_breakers": result, "count": len(result)}


# ============================================================
# NODES  (map + list)
# ============================================================

_NODES_SQL = text("""
    SELECT
        t.id, t.node_key, t.label, 'EvaraTank' AS device_type,
        t.is_active, t.latitude, t.longitude, t.community_id,
        t.thingspeak_channel_id,
        s.last_timestamp, s.level_percentage, NULL::float AS depth_value,
        NULL::float AS flow_rate, NULL::bigint AS total_liters
    FROM evaratank t
    LEFT JOIN evaratank_snapshots s ON t.id = s.device_id
    WHERE t.deleted_at IS NULL
    UNION ALL
    SELECT
        f.id, f.node_key, f.label, 'EvaraFlow',
        f.is_active, f.latitude, f.longitude, f.community_id,
        f.thingspeak_channel_id,
        s.last_timestamp, NULL, NULL,
        s.flow_rate, s.total_liters
    FROM evaraflow f
    LEFT JOIN evaraflow_snapshots s ON f.id = s.device_id
    WHERE f.deleted_at IS NULL
    UNION ALL
    SELECT
        d.id, d.node_key, d.label, 'EvaraDeep',
        d.is_active, d.latitude, d.longitude, d.community_id,
        d.thingspeak_channel_id,
        s.last_timestamp, NULL, s.depth_value,
        NULL, NULL
    FROM evaradeep d
    LEFT JOIN evaradeep_snapshots s ON d.id = s.device_id
    WHERE d.deleted_at IS NULL
    ORDER BY label
""")


@router.get("/nodes")
async def get_all_nodes(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(get_optional_user),
):
    """All devices with latest snapshot — for map rendering."""
    result = await db.execute(_NODES_SQL)
    rows = result.fetchall()
    devices = []
    for r in rows:
        dtype = r.device_type
        devices.append({
            "id": str(r.id),
            "node_key": r.node_key,
            "label": r.label,
            "name": r.label or r.node_key or "Unnamed",
            "asset_type": _ASSET_MAP.get(dtype, "tank"),
            "analytics_template": dtype,
            "status": _online_status(r.last_timestamp, dtype),
            "latitude": r.latitude,
            "longitude": r.longitude,
            "is_active": r.is_active,
            "community_id": str(r.community_id) if r.community_id else None,
            "last_seen": r.last_timestamp.isoformat() if r.last_timestamp else None,
            "telemetry_snapshot": {
                "last_timestamp": r.last_timestamp.isoformat() if r.last_timestamp else None,
                "level_percentage": r.level_percentage,
                "depth_value": r.depth_value,
                "flow_rate": r.flow_rate,
                "total_liters": r.total_liters,
            } if r.last_timestamp else None,
        })
    logger.info("[NODES] /nodes returned %d devices", len(devices))
    return {"status": "ok", "data": devices}


@router.get("/nodes/{node_id}")
async def get_single_node(
    node_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(get_optional_user),
):
    """Single device lookup with snapshot."""
    sql = text("""
        SELECT t.id, t.node_key, t.label, 'EvaraTank' AS device_type,
               t.is_active, t.latitude, t.longitude, t.community_id, t.last_seen, s.last_timestamp
        FROM evaratank t LEFT JOIN evaratank_snapshots s ON t.id = s.device_id
        WHERE t.id = :nid AND t.deleted_at IS NULL
        UNION ALL
        SELECT f.id, f.node_key, f.label, 'EvaraFlow',
               f.is_active, f.latitude, f.longitude, f.community_id, f.last_seen, s.last_timestamp
        FROM evaraflow f LEFT JOIN evaraflow_snapshots s ON f.id = s.device_id
        WHERE f.id = :nid AND f.deleted_at IS NULL
        UNION ALL
        SELECT d.id, d.node_key, d.label, 'EvaraDeep',
               d.is_active, d.latitude, d.longitude, d.community_id, d.last_seen, s.last_timestamp
        FROM evaradeep d LEFT JOIN evaradeep_snapshots s ON d.id = s.device_id
        WHERE d.id = :nid AND d.deleted_at IS NULL
        LIMIT 1
    """)
    result = await db.execute(sql, {"nid": node_id})
    r = result.fetchone()
    if not r:
        raise HTTPException(status_code=404, detail="Node not found")

    # Determine freshest timestamp between device.last_seen and snapshot.last_timestamp
    best_ts = r.last_timestamp
    if r.last_seen:
        if not best_ts or r.last_seen > best_ts:
            best_ts = r.last_seen

    asset_map = _ASSET_MAP
    return {
        "status": "ok",
        "data": {
            "id": str(r.id),
            "node_key": r.node_key,
            "label": r.label,
            "name": r.label or r.node_key or "Unnamed",
            "asset_type": asset_map.get(r.device_type, "tank"),
            "analytics_template": r.device_type,
            "status": _online_status(best_ts, r.device_type),
            "latitude": r.latitude,
            "longitude": r.longitude,
            "is_active": r.is_active,
            "community_id": str(r.community_id) if r.community_id else None,
            "last_seen": r.last_seen.isoformat() if r.last_seen else None,
            "snapshot_timestamp": r.last_timestamp.isoformat() if r.last_timestamp else None,
        },
    }


# ============================================================
# DEVICE CONFIG  (GET / PUT / PATCH)
# ============================================================

class PutDeviceConfigPayload(BaseModel):
    # ThingSpeak connection (updatable from the analytics page)
    thingspeak_channel_id: Optional[str] = None
    thingspeak_read_key: Optional[str] = None
    # Tank-specific
    tank_shape: Optional[str] = None
    height_m: Optional[float] = None
    radius_m: Optional[float] = None
    length_m: Optional[float] = None
    breadth_m: Optional[float] = None
    capacity_liters: Optional[float] = None
    water_level_field: Optional[str] = None
    temperature_field: Optional[str] = None
    # Flow-specific
    meter_reading_field: Optional[str] = None
    flow_rate_field: Optional[str] = None
    pipe_diameter: Optional[float] = None
    max_flow_rate: Optional[float] = None
    # Deep-specific
    depth_field: Optional[str] = None
    total_bore_depth: Optional[float] = None
    static_water_level: Optional[float] = None
    dynamic_water_level: Optional[float] = None
    recharge_threshold: Optional[float] = None


@router.get("/devices/{device_id}/config")
@router.get("/telemetry/devices/{device_id}/config")
async def get_device_config(
    device_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Return the hardware/physical config for a device (all fields from the unified table)."""
    device, dtype = await _find_device(db, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    if dtype == "EvaraTank":
        return {
            "device_type": dtype,
            "config": {
                "thingspeak_channel_id": device.thingspeak_channel_id,
                "tank_shape": device.tank_shape,
                "height_m": device.height_m,
                "radius_m": device.radius_m,
                "length_m": device.length_m,
                "breadth_m": device.breadth_m,
                "capacity_liters": device.capacity_liters,
                "water_level_field": device.water_level_field,
                "temperature_field": device.temperature_field,
            },
        }
    if dtype == "EvaraFlow":
        return {
            "device_type": dtype,
            "config": {
                "thingspeak_channel_id": device.thingspeak_channel_id,
                "meter_reading_field": device.meter_reading_field,
                "flow_rate_field": device.flow_rate_field,
                "pipe_diameter": device.pipe_diameter,
                "max_flow_rate": device.max_flow_rate,
            },
        }
    if dtype == "EvaraDeep":
        return {
            "device_type": dtype,
            "config": {
                "thingspeak_channel_id": device.thingspeak_channel_id,
                "depth_field": device.depth_field,
                "temperature_field": device.temperature_field,
                "total_bore_depth": device.total_bore_depth,
                "static_water_level": device.static_water_level,
                "dynamic_water_level": device.dynamic_water_level,
                "recharge_threshold": device.recharge_threshold,
            },
        }
    return {"device_type": dtype, "config": {}}


@router.put("/devices/{device_id}/config")
@router.patch("/devices/{device_id}/config")
@router.put("/telemetry/devices/{device_id}/config")
@router.patch("/telemetry/devices/{device_id}/config")
async def put_device_config(
    device_id: str,
    payload: PutDeviceConfigPayload,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Upsert config fields on the unified device row (PUT / PATCH semantics)."""
    device, dtype = await _find_device(db, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    updates = payload.model_dump(exclude_unset=True, exclude_none=True)
    for field, value in updates.items():
        if hasattr(device, field):
            setattr(device, field, value)
    device.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(device)

    return await get_device_config(device_id, db)


# ============================================================
# WEBHOOK INGEST (push mode)
# ============================================================

@router.post("/devices/{device_id}/telemetry/webhook")
async def webhook_ingest(
    device_id: str,
    request: Request,
    x_hub_signature_256: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Accept pushed ThingSpeak payload and upsert into appropriate snapshot table."""
    device, dtype = await _find_device(db, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    if not device.webhook_secret:
        raise HTTPException(status_code=403, detail="Webhook not enabled for this device")

    raw_body = await request.body()
    expected_sig = "sha256=" + hmac.new(
        device.webhook_secret.encode(), raw_body, hashlib.sha256
    ).hexdigest()
    if not x_hub_signature_256 or not hmac.compare_digest(expected_sig, x_hub_signature_256):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    if "feeds" in payload and payload["feeds"]:
        latest_feed = payload["feeds"][-1]
    elif "created_at" in payload:
        latest_feed = payload
    else:
        raise HTTPException(status_code=422, detail="Unrecognised payload shape")

    telemetry_dt = _parse_ts(latest_feed.get("created_at"))
    entry_id = latest_feed.get("entry_id")

    snapshot_table, snapshot_model, typed = _build_snapshot(dtype, device, latest_feed, entry_id, telemetry_dt)

    # Dedup check
    snap_res = await db.execute(select(snapshot_model).where(snapshot_model.device_id == device_id))
    existing = snap_res.scalar_one_or_none()
    if existing and existing.thingspeak_entry_id and str(existing.thingspeak_entry_id) == str(entry_id):
        return {"status": "skipped", "reason": "entry_id unchanged"}

    stmt = insert(snapshot_model).values(**typed)
    stmt = stmt.on_conflict_do_update(
        index_elements=["device_id"],
        set_={k: getattr(stmt.excluded, k) for k in typed if k != "device_id"},
    )
    await db.execute(stmt)
    device.last_seen = telemetry_dt
    device.last_fetched_at = datetime.now(timezone.utc)
    await db.commit()
    logger.info("[Webhook] ✓ %s (%s) entry_id=%s", device_id, dtype, entry_id)
    return {"status": "ok", "entry_id": entry_id, "timestamp": telemetry_dt.isoformat()}


# ============================================================
# TELEMETRY LATEST (on-demand poll + ingest)
# ============================================================
# TELEMETRY LATEST / HISTORY
# ============================================================


@router.get("/devices/{device_id}/telemetry/latest", response_model=TelemetryResponse)
@router.get("/telemetry/devices/{device_id}/telemetry/latest", response_model=TelemetryResponse)
async def trigger_ingestion_and_get_latest(
    device_id: str,
    current_user: Optional[dict] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Poll ThingSpeak, upsert snapshot, return latest telemetry."""
    try:
        device, dtype = await _find_device(db, device_id)
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")

        snapshot_model = {"EvaraTank": EvaraTankSnapshot, "EvaraFlow": EvaraFlowSnapshot, "EvaraDeep": EvaraDeepSnapshot}[dtype]

        channel_id = device.thingspeak_channel_id
        read_key = device.thingspeak_read_key
        
        # If no ThingSpeak channel configured, skip polling and fall back to cached snapshot
        latest_feed = None
        if channel_id:
            try:
                thingspeak = get_thingspeak_client()
                data = await thingspeak.fetch_incremental_telemetry(
                    device_id=str(device.id),
                    channel_id=str(channel_id),
                    read_key=read_key,
                    last_fetched_at=device.last_fetched_at,
                )
                if data and "feeds" in data and data["feeds"]:
                    latest_feed = data["feeds"][-1]
                elif data and "created_at" in data:
                    latest_feed = data
            except Exception as ts_err:
                import logging as _log
                _log.getLogger(__name__).warning(
                    "ThingSpeak fetch failed for %s (%s), falling back to cache: %s",
                    device_id, channel_id, ts_err,
                )

        if latest_feed:
            telemetry_dt = _parse_ts(latest_feed.get("created_at"))
            entry_id = latest_feed.get("entry_id")

            # Dedup
            snap_res = await db.execute(select(snapshot_model).where(snapshot_model.device_id == device_id))
            existing = snap_res.scalar_one_or_none()
            if existing and existing.thingspeak_entry_id and str(existing.thingspeak_entry_id) == str(entry_id):
                return _snap_to_response(existing, latest_feed)

            _, _, typed = _build_snapshot(dtype, device, latest_feed, entry_id, telemetry_dt)
            stmt = insert(snapshot_model).values(**typed)
            stmt = stmt.on_conflict_do_update(
                index_elements=["device_id"],
                set_={k: getattr(stmt.excluded, k) for k in typed if k != "device_id"},
            )
            await db.execute(stmt)
            device.last_fetched_at = _to_naive_utc(datetime.now(timezone.utc))
            device.last_seen = _to_naive_utc(telemetry_dt)
            await db.commit()

            return TelemetryResponse(
                timestamp=telemetry_dt.isoformat(),
                data=latest_feed,
                **_typed_metrics_for_response(dtype, typed),
            )

        # Fallback to cached snapshot
        snap_res = await db.execute(select(snapshot_model).where(snapshot_model.device_id == device_id))
        snap = snap_res.scalar_one_or_none()
        if snap:
            return _snap_to_response(snap, {})
        raise HTTPException(status_code=503, detail="No telemetry available")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error in telemetry/latest for %s: %s", device_id, e)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# TELEMETRY HISTORY
# ============================================================

@router.get("/devices/{device_id}/telemetry/history")
@router.get("/telemetry/devices/{device_id}/telemetry/history")
async def get_telemetry_history(
    device_id: str,
    results: int = 100,
    current_user: Optional[dict] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Return historical telemetry — local DB first, ThingSpeak fallback."""
    device, dtype = await _find_device(db, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    local_res = await db.execute(
        text("""
            SELECT thingspeak_entry_id, timestamp,
                   field1, field2, field3, field4,
                   field5, field6, field7, field8,
                   level_percentage, depth_value, temperature_value,
                   flow_rate, total_liters
            FROM telemetry_history
            WHERE device_id = :did
            ORDER BY timestamp DESC
            LIMIT :lim
        """),
        {"did": device_id, "lim": results},
    )
    local_rows = local_res.fetchall()

    if len(local_rows) >= 5:
        feeds = []
        for r in reversed(local_rows):
            feeds.append({
                "created_at": r.timestamp.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
                "entry_id": r.thingspeak_entry_id,
                **{f"field{i}": str(getattr(r, f"field{i}")) if getattr(r, f"field{i}") is not None else None for i in range(1, 9)},
                "level_percentage": r.level_percentage,
                "depth_value": r.depth_value,
                "temperature_value": r.temperature_value,
                "flow_rate": r.flow_rate,
                "total_liters": r.total_liters,
            })
        logger.info("[History] %s → %d rows from local DB", device_id, len(feeds))
        return {"source": "local_db", "feeds": feeds}

    # ThingSpeak fallback
    channel_id = device.thingspeak_channel_id
    read_key = device.thingspeak_read_key
    if not channel_id:
        raise HTTPException(status_code=400, detail="No ThingSpeak channel configured")

    thingspeak = get_thingspeak_client()
    data = await thingspeak.get_history(str(channel_id), read_key, results=results)
    if not data:
        raise HTTPException(status_code=503, detail="Failed to fetch from ThingSpeak")

    from thingspeak import TelemetryMapper
    normalized = []
    cfg = {}  # field mapping now comes from device columns — TelemetryMapper compat
    if dtype == "EvaraTank":
        cfg = {
            "field_mapping": {
                "depth_field":  device.water_level_field or "field1",
                "temperature":  device.temperature_field or "field2",
            },
            "tank_height_cm": (device.height_m or 0) * 100,
        }
    elif dtype == "EvaraDeep":
        # Key must match what TelemetryMapper.map_deep reads: "depth" (not "depth_field")
        cfg = {
            "field_mapping": {
                "depth":       device.depth_field       or "field2",
                "temperature": device.temperature_field or "field1",
            }
        }
    elif dtype == "EvaraFlow":
        cfg = {
            "field_mapping": {
                "total_liters": device.meter_reading_field or "field1",
                "flow_rate":    device.flow_rate_field    or "field2",
            }
        }
    for feed in data.get("feeds", []):
        typed = {}
        if dtype == "EvaraTank":   typed = TelemetryMapper.map_tank(feed, cfg)
        elif dtype == "EvaraFlow": typed = TelemetryMapper.map_flow(feed, cfg)
        elif dtype == "EvaraDeep": typed = TelemetryMapper.map_deep(feed, cfg)
        normalized.append({**feed, **typed})

    logger.info("[History] %s → %d rows from ThingSpeak", device_id, len(normalized))
    return {**data, "source": "thingspeak", "feeds": normalized}


# ============================================================
# TEST CONNECTION / CHANNEL INFO
# ============================================================

async def _fetch_thingspeak_channel(channel_id: str, read_key: Optional[str]) -> dict:
    """Shared helper: fetch channel metadata + last entry from ThingSpeak."""
    import httpx as _httpx
    params: Dict[str, Any] = {"results": 1}
    if read_key:
        params["api_key"] = read_key.strip()
    url = f"https://api.thingspeak.com/channels/{channel_id.strip()}/feeds.json"
    try:
        async with _httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.get(url, params=params)
        if resp.status_code in (401, 403):
            raise HTTPException(status_code=401, detail="Invalid ThingSpeak read key")
        if resp.status_code == 404:
            raise HTTPException(status_code=404, detail="ThingSpeak channel not found")
        resp.raise_for_status()
        body = resp.json()
    except _httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"ThingSpeak unreachable: {exc}")

    ch = body.get("channel", {})
    feeds = body.get("feeds", [])
    last_feed = feeds[-1] if feeds else {}
    field_labels, last_values = {}, {}
    for i in range(1, 9):
        key = f"field{i}"
        label = ch.get(key)
        if label:
            field_labels[key] = label
            last_values[key] = last_feed.get(key)
    return {
        "channel_id": str(ch.get("id", channel_id)),
        "name": ch.get("name", ""),
        "fields": field_labels,
        "last_entry_id": ch.get("last_entry_id"),
        "last_values": last_values,
        "updated_at": ch.get("updated_at"),
    }


class TestConnectionPayload(BaseModel):
    channel_id: str
    read_key: Optional[str] = None


@router.post("/telemetry/test-connection")
async def test_thingspeak_connection(payload: TestConnectionPayload):
    """Validate a ThingSpeak channel + read key."""
    info = await _fetch_thingspeak_channel(payload.channel_id, payload.read_key)
    return {"ok": True, **info}


@router.get("/telemetry/channel-info")
async def get_thingspeak_channel_info(
    channel_id: str,
    read_key: Optional[str] = None,
):
    """Return ThingSpeak channel metadata for UI field-mapping dropdowns."""
    return await _fetch_thingspeak_channel(channel_id, read_key)


# ============================================================
# INTERNAL HELPERS
# ============================================================

def _to_naive_utc(dt: datetime) -> datetime:
    """Convert tz-aware datetime to naive UTC for the project's DateTime (no TZ) columns."""
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _parse_ts(ts_str: Optional[str]) -> datetime:
    if ts_str:
        try:
            return datetime.strptime(ts_str, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        except Exception:
            pass
    return datetime.now(timezone.utc)


def _build_snapshot(dtype: str, device, latest_feed: dict, entry_id, telemetry_dt: datetime):
    """Return (table_name, SnapshotModel, values_dict) for the right device type."""
    from thingspeak import TelemetryMapper

    now = _to_naive_utc(datetime.now(timezone.utc))
    base = dict(
        device_id=str(device.id),
        thingspeak_entry_id=entry_id,
        last_timestamp=_to_naive_utc(telemetry_dt),
        raw_payload=latest_feed,
        updated_at=now,
    )
    if dtype == "EvaraTank":
        cfg = {
            "field_mapping": {
                "depth_field":  device.water_level_field or "field1",
                "temperature":  device.temperature_field or "field2",
            },
            "tank_height_cm": (device.height_m or 0) * 100,
        }
        typed = TelemetryMapper.map_tank(latest_feed, cfg)
        return "evaratank_snapshots", EvaraTankSnapshot, {**base, **typed}
    if dtype == "EvaraFlow":
        # Use device field mapping so meter_reading_field / flow_rate_field are respected
        flow_cfg = {"field_mapping": {
            "total_liters": device.meter_reading_field or "field1",
            "flow_rate":    device.flow_rate_field     or "field2",
        }}
        typed = TelemetryMapper.map_flow(latest_feed, flow_cfg)
        return "evaraflow_snapshots", EvaraFlowSnapshot, {**base, **typed}
    if dtype == "EvaraDeep":
        # Key must match what TelemetryMapper.map_deep reads: "depth" (not "depth_field")
        cfg = {
            "field_mapping": {
                "depth":       device.depth_field       or "field2",
                "temperature": device.temperature_field or "field1",
            }
        }
        typed = TelemetryMapper.map_deep(latest_feed, cfg)
        return "evaradeep_snapshots", EvaraDeepSnapshot, {**base, **typed}
    return "", None, base


def _typed_metrics_for_response(dtype: str, typed: dict) -> dict:
    keys = {
        "EvaraTank": ["level_percentage", "temperature_value"],
        "EvaraFlow": ["flow_rate", "total_liters"],
        "EvaraDeep": ["depth_value", "temperature_value"],
    }.get(dtype, [])
    return {k: typed.get(k) for k in keys}


def _snap_to_response(snap, feed: dict) -> TelemetryResponse:
    if snap.last_timestamp is not None:
        # Handle both naive and aware datetimes
        ts_val = snap.last_timestamp
        if ts_val.tzinfo is None:
            ts_val = ts_val.replace(tzinfo=timezone.utc)
        ts = ts_val.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    else:
        ts = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    return TelemetryResponse(
        timestamp=ts,
        data=feed or getattr(snap, 'raw_payload', None) or {},
        level_percentage=getattr(snap, "level_percentage", None),
        depth_value=getattr(snap, "depth_value", None),
        temperature_value=getattr(snap, "temperature_value", None),
        flow_rate=getattr(snap, "flow_rate", None),
        total_liters=getattr(snap, "total_liters", None),
    )

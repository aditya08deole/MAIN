"""
Background Ingestion Service — Unified Device Schema
=====================================================
Continuously polls ThingSpeak for all active devices.
- Parallel fan-out limited by semaphore (20 concurrent requests)
- Per-template polling budget: EvaraTank 15min, EvaraFlow 2min, EvaraDeep 2h
- Updates last_seen on every successful ingest
- Webhook-aware: skips polling for devices with webhook_secret set
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as pg_insert

from thingspeak import get_thingspeak_client, TelemetryMapper
from models import (
    EvaraTankSnapshot, EvaraFlowSnapshot, EvaraDeepSnapshot,
    TelemetryHistory, AlertEvent,
)

logger = logging.getLogger(__name__)


# ─── Helpers ────────────────────────────────────────────────────────────────

def _safe_float(v) -> Optional[float]:
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


# Snapshot model mapping
_SNAPSHOT_MODELS = {
    "EvaraTank": EvaraTankSnapshot,
    "EvaraFlow":  EvaraFlowSnapshot,
    "EvaraDeep":  EvaraDeepSnapshot,
}

# Table names for raw UPDATE of last_seen
_DEVICE_TABLES = {
    "EvaraTank": "evaratank",
    "EvaraFlow":  "evaraflow",
    "EvaraDeep":  "evaradeep",
}


# ─── Threshold checks ───────────────────────────────────────────────────────

async def _check_thresholds(
    session: AsyncSession,
    device_id: str,
    device_type: str,
    device_row: dict,
    typed_metrics: dict,
    fired_at: datetime,
) -> None:
    """Evaluate typed metrics against device config thresholds; write AlertEvent rows."""
    alerts: list[dict] = []

    if device_type == "EvaraDeep":
        depth = typed_metrics.get("depth_value")
        temp  = typed_metrics.get("temperature_value")
        recharge_thresh = device_row.get("recharge_threshold")
        if depth is not None and recharge_thresh is not None:
            if depth < float(recharge_thresh):
                alerts.append({
                    "alert_type": "low_depth",
                    "field_name": "depth_value",
                    "value": depth,
                    "threshold": float(recharge_thresh),
                    "message": f"Water depth {depth:.1f}m below recharge threshold {recharge_thresh}m",
                })
        if temp is not None and temp > 45.0:
            alerts.append({
                "alert_type": "high_temp",
                "field_name": "temperature_value",
                "value": temp,
                "threshold": 45.0,
                "message": f"Temperature {temp:.1f}°C exceeds safe limit of 45°C",
            })

    elif device_type == "EvaraFlow":
        flow_rate = typed_metrics.get("flow_rate")
        max_flow  = device_row.get("max_flow_rate")
        if flow_rate is not None and max_flow is not None:
            if flow_rate > float(max_flow):
                alerts.append({
                    "alert_type": "high_flow",
                    "field_name": "flow_rate",
                    "value": flow_rate,
                    "threshold": float(max_flow),
                    "message": f"Flow rate {flow_rate:.2f} L/min exceeds max {max_flow}",
                })
        if flow_rate == 0:
            alerts.append({
                "alert_type": "no_flow",
                "field_name": "flow_rate",
                "value": 0.0,
                "threshold": None,
                "message": "No flow detected — pump may be off or pipe blocked",
            })

    for a in alerts:
        existing = await session.execute(
            text(
                "SELECT id FROM alert_events "
                "WHERE device_id = :did AND alert_type = :atype AND resolved = false LIMIT 1"
            ),
            {"did": device_id, "atype": a["alert_type"]},
        )
        if existing.fetchone():
            continue
        session.add(AlertEvent(
            device_id=device_id,
            device_type=device_type,
            fired_at=fired_at,
            **a,
        ))
        logger.warning("[Alert] %s on device %s: %s", a["alert_type"].upper(), device_id, a["message"])


# ─── Concurrency budget ──────────────────────────────────────────────────────
_SEMAPHORE = asyncio.Semaphore(20)

POLL_INTERVALS = {
    "EvaraTank": 15 * 60,
    "EvaraFlow":  2 * 60,
    "EvaraDeep":  2 * 60,
}
DEFAULT_POLL_INTERVAL = 2 * 60
_last_device_poll: dict[str, datetime] = {}


# ─── Core ingest function ────────────────────────────────────────────────────

async def _ingest_device(session: AsyncSession, device_row: dict) -> None:
    """Fetch, normalize, upsert snapshot, update last_seen for a single device."""
    device_id   = str(device_row["id"])
    device_type = device_row.get("device_type", "EvaraTank")
    channel_id  = device_row.get("channel_id")
    read_key    = device_row.get("read_key")
    webhook_secret = device_row.get("webhook_secret")
    last_fetched_at: Optional[datetime] = device_row.get("last_fetched_at")

    if webhook_secret:
        return  # Push mode — webhook handles ingest

    if not channel_id:
        logger.debug("[Ingestion] Skipping %s — no channel_id", device_id)
        return

    interval = POLL_INTERVALS.get(device_type, DEFAULT_POLL_INTERVAL)
    last_poll = _last_device_poll.get(device_id)
    if last_poll and (datetime.utcnow() - last_poll).total_seconds() < interval:
        return  # Not due yet

    async with _SEMAPHORE:
        try:
            ts_client = get_thingspeak_client()
            data = await ts_client.fetch_incremental_telemetry(
                device_id=device_id,
                channel_id=str(channel_id),
                read_key=read_key,
                last_fetched_at=last_fetched_at,
            )
        except Exception as e:
            logger.error("[Ingestion] ThingSpeak fetch failed for %s: %s", device_id, e)
            return

    if not data or not data.get("feeds"):
        return

    latest_feed = data["feeds"][-1]
    entry_id    = latest_feed.get("entry_id")
    # Use naive UTC throughout — DB columns are TIMESTAMP WITHOUT TIME ZONE
    now_utc     = datetime.utcnow()

    ts_str = latest_feed.get("created_at")
    try:
        # Parse as naive UTC — DB columns are TIMESTAMP WITHOUT TIME ZONE
        telemetry_dt = datetime.strptime(ts_str, "%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        telemetry_dt = now_utc

    # Build field-mapping config for TelemetryMapper using unified device columns
    if device_type == "EvaraTank":
        # Key must be 'depth_field' — that's what TelemetryMapper.map_tank reads
        mapper_cfg = {"field_mapping": {
            "depth_field": device_row.get("water_level_field", "field1"),
            "temperature":  device_row.get("temperature_field",  "field2"),
        }, "tank_height_cm": (device_row.get("height_m") or 0) * 100}
        typed_metrics = TelemetryMapper.map_tank(latest_feed, mapper_cfg)
    elif device_type == "EvaraFlow":
        mapper_cfg = {"field_mapping": {
            "total_liters": device_row.get("meter_reading_field", "field1"),
            "flow_rate": device_row.get("flow_rate_field", "field2"),
        }}
        typed_metrics = TelemetryMapper.map_flow(latest_feed, mapper_cfg)
    elif device_type == "EvaraDeep":
        mapper_cfg = {"field_mapping": {
            "depth": device_row.get("depth_field", "field2"),
            "temperature": device_row.get("temperature_field", "field1"),
        }}
        typed_metrics = TelemetryMapper.map_deep(latest_feed, mapper_cfg)
    else:
        typed_metrics = {}

    # Dedup — skip if entry_id unchanged
    snapshot_model = _SNAPSHOT_MODELS.get(device_type)
    if snapshot_model:
        try:
            existing = await session.execute(
                text(f"SELECT thingspeak_entry_id FROM {snapshot_model.__tablename__} WHERE device_id = :did"),
                {"did": device_id},
            )
            existing_eid = existing.scalar_one_or_none()
            if existing_eid is not None and str(existing_eid) == str(entry_id):
                logger.debug("[Ingestion] %s entry_id=%s unchanged — skip", device_id, entry_id)
                return
        except Exception:
            pass

    try:
        # ── Phase 1: UPSERT per-type snapshot + update last_seen ──────────────
        # Commit this phase independently so a history-write failure never
        # rolls back the dashboard data.
        if snapshot_model:
            snap_values = dict(
                device_id=device_id,
                thingspeak_entry_id=entry_id,
                last_timestamp=telemetry_dt,
                raw_payload=latest_feed,
                updated_at=now_utc,
                **typed_metrics,
            )
            stmt = pg_insert(snapshot_model).values(**snap_values)
            stmt = stmt.on_conflict_do_update(
                index_elements=["device_id"],
                set_={k: getattr(stmt.excluded, k) for k in snap_values if k != "device_id"},
            )
            await session.execute(stmt)

        device_table = _DEVICE_TABLES.get(device_type)
        if device_table:
            await session.execute(
                text(f"UPDATE {device_table} SET last_seen = :ts, last_fetched_at = :now WHERE id = :did"),
                {"ts": telemetry_dt, "now": now_utc, "did": device_id},
            )

        await session.commit()  # ← snapshot + last_seen committed; safe from here
        _last_device_poll[device_id] = now_utc
        logger.info("[Ingestion] ✓ %s (%s) → %s", device_id, device_type, telemetry_dt.isoformat())

    except Exception as e:
        await session.rollback()
        logger.error("[Ingestion] DB write failed for %s: %s", device_id, e)
        return  # Don't attempt history/alerts if snapshot failed

    # ── Phase 2: Append to telemetry_history + threshold alerts ───────────────
    # Non-critical: failures here are logged only — they never affect the dashboard.
    try:
        hist = TelemetryHistory(
            device_id=device_id,
            device_type=device_type,
            thingspeak_entry_id=entry_id,
            timestamp=telemetry_dt,
            field1=_safe_float(latest_feed.get("field1")),
            field2=_safe_float(latest_feed.get("field2")),
            field3=_safe_float(latest_feed.get("field3")),
            field4=_safe_float(latest_feed.get("field4")),
            field5=_safe_float(latest_feed.get("field5")),
            field6=_safe_float(latest_feed.get("field6")),
            field7=_safe_float(latest_feed.get("field7")),
            field8=_safe_float(latest_feed.get("field8")),
            **typed_metrics,
        )
        session.add(hist)
        await _check_thresholds(session, device_id, device_type, device_row, typed_metrics, telemetry_dt)
        await session.commit()
    except Exception as hist_err:
        await session.rollback()
        logger.warning("[Ingestion] History/alerts write skipped for %s: %s", device_id, hist_err)


# ─── Cycle runner ────────────────────────────────────────────────────────────

_LOAD_DEVICES_SQL = text("""
    SELECT
        id, 'EvaraTank'::text AS device_type,
        thingspeak_channel_id AS channel_id,
        thingspeak_read_key   AS read_key,
        webhook_secret,
        last_fetched_at,
        water_level_field,
        temperature_field,
        height_m,
        length_m,
        breadth_m,
        capacity_liters,
        NULL::text AS meter_reading_field,
        NULL::text AS flow_rate_field,
        NULL::float AS max_flow_rate,
        NULL::text AS depth_field,
        NULL::float AS recharge_threshold
    FROM evaratank
    WHERE deleted_at IS NULL AND is_active = TRUE

    UNION ALL

    SELECT
        id, 'EvaraFlow',
        thingspeak_channel_id,
        thingspeak_read_key,
        webhook_secret,
        last_fetched_at,
        NULL, NULL,
        NULL::float AS height_m,
        NULL::float AS length_m,
        NULL::float AS breadth_m,
        NULL::float AS capacity_liters,
        meter_reading_field,
        flow_rate_field,
        max_flow_rate,
        NULL, NULL
    FROM evaraflow
    WHERE deleted_at IS NULL AND is_active = TRUE

    UNION ALL

    SELECT
        id, 'EvaraDeep',
        thingspeak_channel_id,
        thingspeak_read_key,
        webhook_secret,
        last_fetched_at,
        NULL, temperature_field,
        NULL::float AS height_m,
        NULL::float AS length_m,
        NULL::float AS breadth_m,
        NULL::float AS capacity_liters,
        NULL, NULL, NULL,
        depth_field,
        recharge_threshold
    FROM evaradeep
    WHERE deleted_at IS NULL AND is_active = TRUE
""")


async def run_ingestion_cycle(session_factory: async_sessionmaker) -> None:
    """One full ingestion cycle — loads all active devices, ingests in parallel."""
    try:
        async with session_factory() as session:
            result = await session.execute(_LOAD_DEVICES_SQL)
            devices = [dict(row._mapping) for row in result.fetchall()]
    except Exception as e:
        logger.error("[Ingestion] Failed to load device list: %s", e)
        return

    if not devices:
        return

    # Evict deleted/inactive devices from the poll-time tracker to prevent unbounded growth
    current_ids = {str(d["id"]) for d in devices}
    for stale_key in [k for k in _last_device_poll if k not in current_ids]:
        del _last_device_poll[stale_key]

    logger.info("[Ingestion] Cycle started — %d devices", len(devices))

    async def _with_own_session(device_row: dict) -> None:
        async with session_factory() as own_session:
            await _ingest_device(own_session, device_row)

    await asyncio.gather(*[_with_own_session(d) for d in devices], return_exceptions=True)
    logger.info("[Ingestion] Cycle complete")


# ─── Scheduler ───────────────────────────────────────────────────────────────

_ingestion_task: Optional[asyncio.Task] = None


async def _ingestion_loop(session_factory: async_sessionmaker) -> None:
    BASE_TICK = 120  # 2-minute base tick
    while True:
        try:
            await run_ingestion_cycle(session_factory)
        except Exception as e:
            logger.error("[Ingestion] Unhandled cycle error: %s", e)
        await asyncio.sleep(BASE_TICK)


def start_ingestion_service(session_factory: async_sessionmaker) -> asyncio.Task:
    """Start the background ingestion loop. Call from FastAPI lifespan startup."""
    global _ingestion_task
    _ingestion_task = asyncio.create_task(_ingestion_loop(session_factory))
    logger.info("[Ingestion] Background service started (2-min tick)")
    return _ingestion_task


def stop_ingestion_service() -> None:
    """Gracefully cancel the ingestion loop. Call from FastAPI lifespan shutdown."""
    global _ingestion_task
    if _ingestion_task and not _ingestion_task.done():
        _ingestion_task.cancel()
        logger.info("[Ingestion] Background service stopped")


async def ingest_device_now(session_factory: async_sessionmaker, device_id: str, device_type: str) -> None:
    """
    Immediately ingest a single device — call this right after provisioning
    so the dashboard shows live data without waiting for the next cycle.
    device_type must be one of: 'EvaraTank', 'EvaraFlow', 'EvaraDeep'.
    """
    _SQL = {
        "EvaraTank": """
            SELECT id, 'EvaraTank'::text AS device_type,
                   thingspeak_channel_id AS channel_id, thingspeak_read_key AS read_key,
                   webhook_secret, last_fetched_at,
                   water_level_field, temperature_field,
                   height_m, length_m, breadth_m, capacity_liters,
                   NULL::text AS meter_reading_field, NULL::text AS flow_rate_field,
                   NULL::float AS max_flow_rate, NULL::text AS depth_field,
                   NULL::float AS recharge_threshold
            FROM evaratank WHERE id = :did AND deleted_at IS NULL
        """,
        "EvaraFlow": """
            SELECT id, 'EvaraFlow'::text AS device_type,
                   thingspeak_channel_id AS channel_id, thingspeak_read_key AS read_key,
                   webhook_secret, last_fetched_at,
                   NULL::text AS water_level_field, NULL::text AS temperature_field,
                   NULL::float AS height_m, NULL::float AS length_m,
                   NULL::float AS breadth_m, NULL::float AS capacity_liters,
                   meter_reading_field, flow_rate_field, max_flow_rate,
                   NULL::text AS depth_field, NULL::float AS recharge_threshold
            FROM evaraflow WHERE id = :did AND deleted_at IS NULL
        """,
        "EvaraDeep": """
            SELECT id, 'EvaraDeep'::text AS device_type,
                   thingspeak_channel_id AS channel_id, thingspeak_read_key AS read_key,
                   webhook_secret, last_fetched_at,
                   NULL::text AS water_level_field, temperature_field,
                   NULL::float AS height_m, NULL::float AS length_m,
                   NULL::float AS breadth_m, NULL::float AS capacity_liters,
                   NULL::text AS meter_reading_field, NULL::text AS flow_rate_field,
                   NULL::float AS max_flow_rate, depth_field, recharge_threshold
            FROM evaradeep WHERE id = :did AND deleted_at IS NULL
        """,
    }
    sql = _SQL.get(device_type)
    if not sql:
        logger.warning("[Ingestion] ingest_device_now: unknown device_type %s", device_type)
        return

    try:
        async with session_factory() as session:
            from sqlalchemy import text as _text
            result = await session.execute(_text(sql), {"did": device_id})
            row = result.fetchone()
            if not row:
                logger.warning("[Ingestion] ingest_device_now: device %s not found", device_id)
                return
            device_row = dict(row._mapping)

        # Force immediate poll by clearing the last-poll tracker for this device
        _last_device_poll.pop(device_id, None)

        async with session_factory() as session:
            await _ingest_device(session, device_row)
        logger.info("[Ingestion] Immediate ingest complete for %s (%s)", device_id, device_type)
    except Exception as e:
        logger.error("[Ingestion] ingest_device_now failed for %s: %s", device_id, e)

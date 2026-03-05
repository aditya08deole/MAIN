"""
analytics.py — Unified analytics endpoint.

GET /analytics/device/{device_id}
  Returns: node info, device config, latest telemetry, and 24H history
  in a single parallel sweep (asyncio.gather).

P20: Structured error codes in each sub-response.
P21: Ingestion call wrapped with 8-second timeout; falls back to cached
     snapshot so the page never goes blank just because ThingSpeak is slow.
P27: Every response includes an `online` boolean (authoritative from backend).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import asyncio
import logging
from datetime import datetime, timezone, timedelta

from database import get_db
from auth_helper import get_optional_user

# Import the individual endpoint functions
from routers.telemetry import (
    get_single_node,
    get_device_config,
    trigger_ingestion_and_get_latest,
    get_telemetry_history,
    _online_status,          # P27: reuse backend status helper
    _find_device,            # P21: needed for snapshot fallback
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["analytics"])


def _structured_error(e: Exception, code: str) -> dict:
    """P20: Return a structured error dict instead of raising during gather."""
    if isinstance(e, HTTPException):
        return {"error": e.detail, "code": code, "status_code": e.status_code}
    return {"error": str(e), "code": code}


async def _safe_latest(device_id: str, current_user, db: AsyncSession) -> dict:
    """
    P21: Wrap trigger_ingestion_and_get_latest with an 8-second timeout.
    If ThingSpeak is slow/down, return the last cached snapshot from the DB
    rather than returning null — so the analytics page always shows *something*.
    """
    try:
        result = await asyncio.wait_for(
            trigger_ingestion_and_get_latest(
                device_id=device_id,
                current_user=current_user,
                db=db,
            ),
            timeout=8.0,
        )
        return result
    except asyncio.TimeoutError:
        logger.warning("[Analytics] Ingestion timed out for %s — returning cached snapshot", device_id)
        # Fall back: read snapshot directly from DB
        try:
            from models import EvaraTankSnapshot, EvaraFlowSnapshot, EvaraDeepSnapshot
            from sqlalchemy import select
            for SnapModel, ts_field, extra_fields in [
                (EvaraTankSnapshot, "last_timestamp", {"level_percentage": "level_percentage", "temperature_value": "temperature_value"}),
                (EvaraFlowSnapshot, "last_timestamp", {"flow_rate": "flow_rate", "total_liters": "total_liters"}),
                (EvaraDeepSnapshot, "last_timestamp", {"depth_value": "depth_value"}),
            ]:
                res = await db.execute(select(SnapModel).where(SnapModel.device_id == device_id))
                snap = res.scalar_one_or_none()
                if snap:
                    ts = getattr(snap, ts_field, None)
                    return {
                        "timestamp": ts.isoformat() if ts else None,
                        "data": {"source": "cache"},
                        "source": "cache",
                        **{k: getattr(snap, v, None) for k, v in extra_fields.items()},
                    }
        except Exception:
            logger.exception("[Analytics] Snapshot fallback also failed for %s", device_id)
        return {"error": "Ingestion timed out and no cached snapshot found", "code": "INGESTION_TIMEOUT"}
    except Exception as e:
        logger.warning("[Analytics] Ingestion failed for %s: %s", device_id, e)
        return _structured_error(e, "INGESTION_FAILED")


@router.get("/analytics/device/{device_id}")
async def get_device_analytics_full(
    device_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(get_optional_user),
):
    """
    Unified endpoint — fetches all data for an analytics page in one parallel sweep.
    Includes: node info, device config, latest telemetry (with timeout guard), 24H history.

    P27: Adds `online` boolean computed by the backend's authoritative _online_status helper.
    """
    try:
        # Run 3 queries concurrently; latest has its own timeout wrapper
        node_task       = get_single_node(node_id=device_id, db=db, current_user=current_user)
        config_task     = get_device_config(device_id=device_id, db=db)
        history_task    = get_telemetry_history(device_id=device_id, results=144, current_user=current_user, db=db)
        latest_coro     = _safe_latest(device_id=device_id, current_user=current_user, db=db)

        node_info, config_info, history_info, latest_info = await asyncio.gather(
            node_task,
            config_task,
            history_task,
            latest_coro,
            return_exceptions=True,
        )

        def _handle(res, code: str):
            if isinstance(res, Exception):
                return _structured_error(res, code)
            return res

        node_result    = _handle(node_info,    "NODE_NOT_FOUND")
        config_result  = _handle(config_info,  "CONFIG_MISSING")
        history_result = _handle(history_info, "HISTORY_FAILED")
        latest_result  = latest_info  # already error-safe from _safe_latest

        # P27: Compute authoritative online boolean from the freshest timestamp.
        # We prefer the snapshot timestamp; fall back to device last_seen.
        latest_ts   = None
        device_type = "EvaraTank"

        if isinstance(latest_result, dict) and "timestamp" in latest_result:
            latest_ts = latest_result.get("timestamp")
        if isinstance(node_result, dict) and "data" in node_result:
            node_data = node_result["data"]
            device_type = node_data.get("analytics_template", "EvaraTank")
            if not latest_ts:
                latest_ts = node_data.get("last_seen")

        online_status = _online_status(latest_ts, device_type)
        is_online     = online_status == "Online"

        # Inject `online` into latest_result so frontend useTelemetryLatest
        # can prefer the backend flag (already designed to do so).
        if isinstance(latest_result, dict) and "error" not in latest_result:
            latest_result["online"] = is_online
        # Also inject into node info for the frontend fallback strategy
        if isinstance(node_result, dict) and "data" in node_result:
            node_result["data"]["online"]             = is_online
            node_result["data"]["snapshot_timestamp"] = latest_ts

        return {
            "info":    node_result,
            "config":  config_result,
            "latest":  latest_result,
            "history": history_result,
        }
    except Exception as e:
        logger.exception("[Analytics] Unhandled error for device %s", device_id)
        raise HTTPException(status_code=500, detail=str(e))

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from typing import List
from datetime import datetime, timezone, timedelta

from database import get_db
from models import Zone, Community, Customer, EvaraTank, EvaraFlow, EvaraDeep, EvaraTankSnapshot, AuditLog, AlertEvent
from schemas import RegionStatsResponse, DashboardSummaryResponse
from auth_helper import get_current_user

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/zones", response_model=List[RegionStatsResponse])
async def get_region_stats(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Statistical summary for all zones with device counts from all three device tables."""
    online_threshold = datetime.now(timezone.utc) - timedelta(minutes=30)

    result = await db.execute(text("""
        WITH device_counts AS (
            SELECT community_id,
                   (last_seen >= :threshold)::int AS is_online
            FROM evaratank WHERE deleted_at IS NULL AND community_id IS NOT NULL
            UNION ALL
            SELECT community_id,
                   (last_seen >= :threshold)::int
            FROM evaraflow WHERE deleted_at IS NULL AND community_id IS NOT NULL
            UNION ALL
            SELECT community_id,
                   (last_seen >= :threshold)::int
            FROM evaradeep WHERE deleted_at IS NULL AND community_id IS NOT NULL
        ),
        zone_device_stats AS (
            SELECT c.zone_id,
                   COUNT(*)        AS device_count,
                   SUM(dc.is_online) AS online_count
            FROM device_counts dc
            JOIN communities c ON c.id = dc.community_id
            GROUP BY c.zone_id
        )
        SELECT
            z.id,
            z.name,
            z.state,
            COUNT(DISTINCT c.id)             AS community_count,
            COUNT(DISTINCT cu.id)            AS customer_count,
            COALESCE(zds.device_count,  0)   AS device_count,
            COALESCE(zds.online_count,  0)   AS online_devices
        FROM zones z
        LEFT JOIN communities        c   ON c.zone_id       = z.id
        LEFT JOIN customers          cu  ON cu.community_id  = c.id
        LEFT JOIN zone_device_stats  zds ON zds.zone_id      = z.id
        GROUP BY z.id, z.name, z.state, zds.device_count, zds.online_count
        ORDER BY z.name
    """), {"threshold": online_threshold})

    rows = result.fetchall()
    return [
        RegionStatsResponse(
            zone_id=str(r.id),
            region_name=r.name,
            state=r.state,
            community_count=r.community_count or 0,
            customer_count=r.customer_count or 0,
            device_count=r.device_count or 0,
            online_devices=r.online_devices or 0,
            offline_devices=max(0, (r.device_count or 0) - (r.online_devices or 0)),
        )
        for r in rows
    ]


@router.get("/dashboard/summary", response_model=DashboardSummaryResponse)
async def get_dashboard_summary(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    thirty_min_ago = now - timedelta(minutes=30)  # consistent with telemetry.py and frontend
    one_day_ago  = now - timedelta(days=1)

    row = (await db.execute(text("""
        SELECT
            -- Total devices across all three tables
            (SELECT COUNT(*) FROM evaratank WHERE deleted_at IS NULL) +
            (SELECT COUNT(*) FROM evaraflow WHERE deleted_at IS NULL) +
            (SELECT COUNT(*) FROM evaradeep WHERE deleted_at IS NULL)
                AS total_devices,

            -- Online = last_seen within last 30 minutes (consistent threshold)
            (SELECT COUNT(*) FROM evaratank WHERE deleted_at IS NULL AND last_seen >= :t30) +
            (SELECT COUNT(*) FROM evaraflow WHERE deleted_at IS NULL AND last_seen >= :t30) +
            (SELECT COUNT(*) FROM evaradeep WHERE deleted_at IS NULL AND last_seen >= :t30)
                AS online_devices,

            -- Per-type
            (SELECT COUNT(*) FROM evaratank WHERE deleted_at IS NULL) AS product_tank,
            (SELECT COUNT(*) FROM evaraflow WHERE deleted_at IS NULL) AS product_flow,
            (SELECT COUNT(*) FROM evaradeep WHERE deleted_at IS NULL) AS product_deep,

            -- Alerts in last 24h
            (SELECT COUNT(*) FROM alert_events WHERE fired_at >= :d1 AND resolved = FALSE)
                AS alerts_active,
            (SELECT COUNT(*) FROM alert_events WHERE fired_at >= :d1 AND resolved = FALSE AND alert_type ILIKE '%critical%')
                AS alerts_critical,

            -- Tanks below 20%
            (SELECT COUNT(*) FROM evaratank_snapshots WHERE level_percentage < 20)
                AS tanks_low
    """), {"t30": thirty_min_ago, "d1": one_day_ago})).fetchone()

    total    = int(row.total_devices or 0)
    online   = int(row.online_devices or 0)
    t_tank   = int(row.product_tank or 0)
    t_flow   = int(row.product_flow or 0)
    t_deep   = int(row.product_deep or 0)
    alerts_a = int(row.alerts_active or 0)
    alerts_c = int(row.alerts_critical or 0)
    tanks_lw = int(row.tanks_low or 0)
    health   = int(online / total * 100) if total > 0 else 100

    return DashboardSummaryResponse(
        total_devices=total,
        deployed_active=online,
        deployed_inactive=max(0, total - online),
        health_working=online,
        health_not_working=max(0, total - online),
        product_tank=t_tank,
        product_flow=t_flow,
        product_deep=t_deep,
        online_devices=online,
        alerts_active=alerts_a,
        alerts_critical=alerts_c,
        alerts_warning=max(0, alerts_a - alerts_c),
        tanks_full=max(0, t_tank - tanks_lw),
        tanks_not_full=tanks_lw,
        tanks_low=tanks_lw,
        system_health=health,
        timestamp=now,
    )


@router.get("/ingestion/metrics")
async def get_ingestion_metrics(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Per-device ingestion health metrics (lag, fresh/stale, webhook/poll mode)."""
    now = datetime.now(timezone.utc)
    stale_threshold = timedelta(minutes=30)

    result = await db.execute(text("""
        SELECT id, label, 'EvaraTank' AS device_type, last_seen, last_fetched_at,
               webhook_secret IS NOT NULL AS webhook_mode, is_active
        FROM evaratank WHERE deleted_at IS NULL
        UNION ALL
        SELECT id, label, 'EvaraFlow', last_seen, last_fetched_at,
               webhook_secret IS NOT NULL, is_active
        FROM evaraflow WHERE deleted_at IS NULL
        UNION ALL
        SELECT id, label, 'EvaraDeep', last_seen, last_fetched_at,
               webhook_secret IS NOT NULL, is_active
        FROM evaradeep WHERE deleted_at IS NULL
        ORDER BY label
    """))
    rows = result.fetchall()

    metrics = []
    for r in rows:
        last_seen = r.last_seen
        lag_seconds = None
        is_stale = True
        if last_seen:
            if last_seen.tzinfo is None:
                last_seen = last_seen.replace(tzinfo=timezone.utc)
            lag = now - last_seen
            lag_seconds = int(lag.total_seconds())
            is_stale = lag > stale_threshold

        metrics.append({
            "device_id": str(r.id),
            "label": r.label,
            "device_type": r.device_type,
            "last_seen": last_seen.isoformat() if last_seen else None,
            "last_fetched_at": r.last_fetched_at.isoformat() if r.last_fetched_at else None,
            "lag_seconds": lag_seconds,
            "is_stale": is_stale,
            "webhook_mode": bool(r.webhook_mode),
            "is_active": bool(r.is_active),
        })

    total = len(metrics)
    stale_count = sum(1 for m in metrics if m["is_stale"])
    webhook_count = sum(1 for m in metrics if m["webhook_mode"])
    return {
        "summary": {
            "total_devices": total,
            "stale_devices": stale_count,
            "fresh_devices": total - stale_count,
            "webhook_devices": webhook_count,
            "poll_devices": total - webhook_count,
            "generated_at": now.isoformat(),
        },
        "devices": metrics,
    }

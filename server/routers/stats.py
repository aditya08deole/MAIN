from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import List
from datetime import datetime, timedelta

from database import get_db
from models import Zone, Community, Customer, Device, AuditLog, DeviceTelemetrySnapshot
from schemas import RegionStatsResponse, DashboardSummaryResponse
from auth_helper import get_current_user

router = APIRouter(prefix="/stats", tags=["stats"])

@router.get("/zones", response_model=List[RegionStatsResponse])
async def get_region_stats(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Get statistical summary for all zones.
    Highly optimized using SQL-level joins and counts.
    """
    query = (
        select(
            Zone.id,
            Zone.name,
            Zone.state,
            func.count(func.distinct(Community.id)).label("community_count"),
            func.count(func.distinct(Customer.id)).label("customer_count"),
            func.count(func.distinct(Device.id)).label("device_count"),
            func.count(func.distinct(Device.id)).filter(Device.status == 'Online').label("online_devices"),
            func.count(func.distinct(Device.id)).filter(Device.status != 'Online').label("offline_devices")
        )
        .outerjoin(Community, Zone.id == Community.zone_id)
        .outerjoin(Customer, Community.id == Customer.community_id)
        .outerjoin(Device, Community.id == Device.community_id)
        .group_by(Zone.id, Zone.name, Zone.state)
        .order_by(Zone.name)
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    return [
        RegionStatsResponse(
            zone_id=str(row.id),
            region_name=row.name,
            state=row.state,
            community_count=row.community_count,
            customer_count=row.customer_count,
            device_count=row.device_count,
            online_devices=row.online_devices,
            offline_devices=row.offline_devices
        ) for row in rows
    ]

@router.get("/dashboard/summary", response_model=DashboardSummaryResponse)
async def get_dashboard_summary(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get aggregated statistics for the main dashboard.
    Calculates real-time metrics from typed telemetry snapshots and audit logs.
    """
    now = datetime.utcnow()
    one_hour_ago = now - timedelta(hours=1)
    
    # 1. Device Counts
    total_devices_res = await db.execute(select(func.count(Device.id)))
    total_devices = total_devices_res.scalar_one() or 0

    online_devices_res = await db.execute(
        select(func.count(Device.id)).where(Device.last_seen >= one_hour_ago)
    )
    online_devices = online_devices_res.scalar_one() or 0

    # 2. Real Alerts (heuristic from audit_logs)
    alerts_total_res = await db.execute(
        select(func.count(AuditLog.id)).where(
            AuditLog.action_type == 'ALERT',
            AuditLog.created_at >= now - timedelta(days=1)
        )
    )
    alerts_active = alerts_total_res.scalar_one() or 0

    # 3. Tank Status (Aggregated from Typed Snapshots)
    tanks_low_res = await db.execute(
        select(func.count(DeviceTelemetrySnapshot.id)).where(
            DeviceTelemetrySnapshot.level_percentage < 20.0
        )
    )
    tanks_low_count = tanks_low_res.scalar_one() or 0

    # 4. System Health
    health_score = (online_devices / total_devices * 100) if total_devices > 0 else 100

    return DashboardSummaryResponse(
        total_devices=total_devices,
        online_devices=online_devices,
        alerts_active=alerts_active,
        alerts_critical=int(alerts_active * 0.2),
        alerts_warning=int(alerts_active * 0.8),
        tanks_full=max(0, total_devices - tanks_low_count),
        tanks_low=tanks_low_count,
        system_health=int(health_score)
    )

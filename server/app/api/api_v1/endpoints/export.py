"""
P41: Export API — CSV/JSON export for nodes, readings, alerts.
"""
import csv
import io
from typing import Any, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.db.session import get_db
from app.models import all_models as models
from app.core import security_supabase

router = APIRouter()


@router.get("/nodes")
async def export_nodes(
    format: str = Query("csv", description="csv or json"),
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(security_supabase.RequirePermission(security_supabase.Permission.DEVICE_READ))
) -> Any:
    """Export device inventory as CSV or JSON."""
    result = await db.execute(select(models.Node).order_by(models.Node.label))
    nodes = result.scalars().all()
    
    if format == "json":
        return [
            {
                "id": n.id,
                "hardware_id": n.node_key,
                "label": n.label,
                "type": n.category,
                "analytics_type": n.analytics_type,
                "status": n.status,
                "lat": n.lat,
                "lng": n.lng,
                "location_name": n.location_name,
                "community_id": n.community_id,
                "last_seen": n.last_seen.isoformat() if n.last_seen else None,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in nodes
        ]
    
    # CSV export
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Hardware ID", "Label", "Type", "Status", "Lat", "Lng", "Location", "Community", "Last Seen", "Created"])
    for n in nodes:
        writer.writerow([
            n.id, n.node_key, n.label, n.category, n.status,
            n.lat, n.lng, n.location_name, n.community_id,
            n.last_seen.isoformat() if n.last_seen else "",
            n.created_at.isoformat() if n.created_at else "",
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=nodes_export_{datetime.utcnow().strftime('%Y%m%d')}.csv"}
    )


@router.get("/readings/{node_id}")
async def export_readings(
    node_id: str,
    days: int = Query(7, le=90),
    format: str = Query("csv"),
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(security_supabase.get_current_user_token)
) -> Any:
    """Export sensor readings for a device."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    result = await db.execute(
        select(models.NodeReading)
        .where(models.NodeReading.node_id == node_id, models.NodeReading.timestamp >= cutoff)
        .order_by(desc(models.NodeReading.timestamp))
        .limit(10000)
    )
    readings = result.scalars().all()
    
    if format == "json":
        return [{"timestamp": r.timestamp.isoformat(), "data": r.data} for r in readings]
    
    # CSV: flatten data JSON
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Determine columns from first reading
    sample_keys = list(readings[0].data.keys()) if readings else []
    writer.writerow(["timestamp"] + sample_keys)
    
    for r in readings:
        row = [r.timestamp.isoformat()] + [r.data.get(k, "") for k in sample_keys]
        writer.writerow(row)
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=readings_{node_id}_{days}d.csv"}
    )


@router.get("/alerts")
async def export_alerts(
    format: str = Query("json"),
    days: int = Query(30, le=365),
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(security_supabase.get_current_user_token)
) -> Any:
    """Export alert history."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    result = await db.execute(
        select(models.AlertHistory)
        .where(models.AlertHistory.triggered_at >= cutoff)
        .order_by(desc(models.AlertHistory.triggered_at))
        .limit(5000)
    )
    alerts = result.scalars().all()
    
    return [
        {
            "id": a.id,
            "node_id": a.node_id,
            "severity": a.severity,
            "category": a.category,
            "title": a.title,
            "value": a.value_at_time,
            "triggered_at": a.triggered_at.isoformat() if a.triggered_at else None,
            "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None,
        }
        for a in alerts
    ]

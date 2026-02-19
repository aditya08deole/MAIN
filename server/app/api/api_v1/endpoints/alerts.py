"""
P21: Alert Lifecycle Endpoints
Full CRUD + acknowledge/resolve workflow for alerts.
"""
from typing import Any, List, Dict, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.db.session import get_db
from app.models import all_models as models
from app.core import security_supabase
from app.schemas.response import StandardResponse
from app.services.audit_service import AuditService

router = APIRouter()


@router.get("/", response_model=StandardResponse[List[Dict[str, Any]]])
async def list_alerts(
    status: Optional[str] = Query(None, description="Filter: open, acknowledged, resolved"),
    severity: Optional[str] = Query(None, description="Filter: critical, warning, info"),
    node_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    skip: int = 0,
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(security_supabase.get_current_user_token)
) -> Any:
    """List alerts with filtering."""
    query = select(models.AlertHistory).order_by(desc(models.AlertHistory.triggered_at))
    
    if status == "open":
        query = query.where(models.AlertHistory.resolved_at.is_(None), models.AlertHistory.acknowledged_at.is_(None))
    elif status == "acknowledged":
        query = query.where(models.AlertHistory.acknowledged_at.isnot(None), models.AlertHistory.resolved_at.is_(None))
    elif status == "resolved":
        query = query.where(models.AlertHistory.resolved_at.isnot(None))
    
    if severity:
        query = query.where(models.AlertHistory.severity == severity)
    if node_id:
        query = query.where(models.AlertHistory.node_id == node_id)
    
    result = await db.execute(query.offset(skip).limit(limit))
    alerts = result.scalars().all()
    
    return StandardResponse(data=[
        {
            "id": a.id,
            "node_id": a.node_id,
            "rule_id": a.rule_id,
            "severity": a.severity,
            "category": a.category,
            "title": a.title,
            "message": a.message,
            "value": a.value_at_time,
            "triggered_at": a.triggered_at.isoformat() if a.triggered_at else None,
            "acknowledged_by": a.acknowledged_by,
            "acknowledged_at": a.acknowledged_at.isoformat() if a.acknowledged_at else None,
            "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None,
            "resolve_comment": a.resolve_comment,
        }
        for a in alerts
    ])


@router.get("/summary", response_model=StandardResponse[Dict[str, Any]])
async def alert_summary(
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(security_supabase.get_current_user_token)
) -> Any:
    """Dashboard badge counts by severity."""
    # Active alerts only (unresolved)
    base = select(
        models.AlertHistory.severity,
        func.count(models.AlertHistory.id)
    ).where(
        models.AlertHistory.resolved_at.is_(None)
    ).group_by(models.AlertHistory.severity)
    
    result = await db.execute(base)
    counts = {row[0]: row[1] for row in result.all()}
    
    return StandardResponse(data={
        "critical": counts.get("critical", 0),
        "warning": counts.get("warning", 0),
        "info": counts.get("info", 0),
        "total_active": sum(counts.values()),
    })


@router.get("/{alert_id}", response_model=StandardResponse[Dict[str, Any]])
async def get_alert_detail(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(security_supabase.get_current_user_token)
) -> Any:
    """Get single alert with full detail."""
    alert = await db.get(models.AlertHistory, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    # Get node info
    node = await db.get(models.Node, alert.node_id)
    
    return StandardResponse(data={
        "id": alert.id,
        "node_id": alert.node_id,
        "node_label": node.label if node else None,
        "node_location": node.location_name if node else None,
        "rule_id": alert.rule_id,
        "severity": alert.severity,
        "category": alert.category,
        "title": alert.title,
        "message": alert.message,
        "value": alert.value_at_time,
        "triggered_at": alert.triggered_at.isoformat() if alert.triggered_at else None,
        "acknowledged_by": alert.acknowledged_by,
        "acknowledged_at": alert.acknowledged_at.isoformat() if alert.acknowledged_at else None,
        "resolved_at": alert.resolved_at.isoformat() if alert.resolved_at else None,
        "resolve_comment": alert.resolve_comment,
    })


@router.post("/{alert_id}/acknowledge", response_model=StandardResponse[Dict[str, Any]])
async def acknowledge_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(security_supabase.get_current_user_token)
) -> Any:
    """Mark an alert as acknowledged."""
    alert = await db.get(models.AlertHistory, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    if alert.resolved_at:
        raise HTTPException(status_code=400, detail="Alert already resolved")
    
    user_id = user_payload.get("sub")
    alert.acknowledged_by = user_id
    alert.acknowledged_at = datetime.utcnow()
    
    await AuditService.log_action(db, "alert.acknowledge", user_id, "alert", alert_id)
    await db.commit()
    
    return StandardResponse(data={"id": alert_id, "status": "acknowledged"})


@router.post("/{alert_id}/resolve", response_model=StandardResponse[Dict[str, Any]])
async def resolve_alert(
    alert_id: str,
    comment: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(security_supabase.get_current_user_token)
) -> Any:
    """Manually resolve an alert."""
    alert = await db.get(models.AlertHistory, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    if alert.resolved_at:
        raise HTTPException(status_code=400, detail="Alert already resolved")
    
    user_id = user_payload.get("sub")
    alert.resolved_at = datetime.utcnow()
    alert.resolve_comment = comment
    
    # Auto-acknowledge if not already
    if not alert.acknowledged_at:
        alert.acknowledged_by = user_id
        alert.acknowledged_at = datetime.utcnow()
    
    await AuditService.log_action(db, "alert.resolve", user_id, "alert", alert_id, {"comment": comment})
    await db.commit()
    
    return StandardResponse(data={"id": alert_id, "status": "resolved"})

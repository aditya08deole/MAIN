"""
P37: Device Groups CRUD
P38: Maintenance Windows CRUD
P39: Configurable Alert Thresholds
"""
from typing import Any, List, Dict, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.db.session import get_db
from app.models import all_models as models
from app.core import security_supabase
from app.schemas.response import StandardResponse

router = APIRouter()


# ─── P37: DEVICE GROUPS ───

@router.get("/groups", response_model=StandardResponse[List[Dict[str, Any]]])
async def list_device_groups(
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(security_supabase.get_current_user_token)
) -> Any:
    """List all device groups."""
    result = await db.execute(select(models.DeviceGroup))
    groups = result.scalars().all()
    return StandardResponse(data=[
        {
            "id": g.id, "name": g.name, "description": g.description,
            "community_id": g.community_id, "created_at": g.created_at.isoformat() if g.created_at else None,
        }
        for g in groups
    ])


@router.post("/groups", response_model=StandardResponse[Dict[str, Any]])
async def create_device_group(
    name: str,
    description: Optional[str] = None,
    community_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(security_supabase.get_current_user_token)
) -> Any:
    """Create a device group."""
    import uuid
    group = models.DeviceGroup(
        id=str(uuid.uuid4()), name=name, description=description,
        community_id=community_id, created_by=user_payload.get("sub"),
    )
    db.add(group)
    await db.commit()
    return StandardResponse(data={"id": group.id, "name": group.name})


@router.post("/groups/{group_id}/members/{node_id}", response_model=StandardResponse[Dict[str, Any]])
async def add_device_to_group(
    group_id: str, node_id: str,
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(security_supabase.get_current_user_token)
) -> Any:
    """Add a device to a group."""
    membership = models.DeviceGroupMembership(group_id=group_id, node_id=node_id)
    db.add(membership)
    await db.commit()
    return StandardResponse(data={"group_id": group_id, "node_id": node_id, "status": "added"})


@router.delete("/groups/{group_id}/members/{node_id}", response_model=StandardResponse[Dict[str, Any]])
async def remove_device_from_group(
    group_id: str, node_id: str,
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(security_supabase.get_current_user_token)
) -> Any:
    """Remove a device from a group."""
    await db.execute(
        delete(models.DeviceGroupMembership).where(
            models.DeviceGroupMembership.group_id == group_id,
            models.DeviceGroupMembership.node_id == node_id,
        )
    )
    await db.commit()
    return StandardResponse(data={"group_id": group_id, "node_id": node_id, "status": "removed"})


@router.delete("/groups/{group_id}", response_model=StandardResponse[Dict[str, Any]])
async def delete_device_group(
    group_id: str,
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(security_supabase.get_current_user_token)
) -> Any:
    """Delete a device group."""
    await db.execute(delete(models.DeviceGroupMembership).where(models.DeviceGroupMembership.group_id == group_id))
    await db.execute(delete(models.DeviceGroup).where(models.DeviceGroup.id == group_id))
    await db.commit()
    return StandardResponse(data={"id": group_id, "status": "deleted"})


# ─── P38: MAINTENANCE WINDOWS ───

@router.get("/maintenance", response_model=StandardResponse[List[Dict[str, Any]]])
async def list_maintenance_windows(
    node_id: Optional[str] = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(security_supabase.get_current_user_token)
) -> Any:
    """List maintenance windows."""
    query = select(models.MaintenanceWindow)
    if node_id:
        query = query.where(models.MaintenanceWindow.node_id == node_id)
    if active_only:
        query = query.where(models.MaintenanceWindow.end_time >= datetime.utcnow())
    result = await db.execute(query.order_by(models.MaintenanceWindow.start_time.desc()))
    windows = result.scalars().all()
    return StandardResponse(data=[
        {
            "id": w.id, "node_id": w.node_id,
            "start_time": w.start_time.isoformat(), "end_time": w.end_time.isoformat(),
            "reason": w.reason, "created_at": w.created_at.isoformat() if w.created_at else None,
        }
        for w in windows
    ])


@router.post("/maintenance", response_model=StandardResponse[Dict[str, Any]])
async def create_maintenance_window(
    node_id: str, start_time: str, end_time: str,
    reason: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(security_supabase.get_current_user_token)
) -> Any:
    """Create a maintenance window for a device. Alerts are suppressed during this window."""
    import uuid
    window = models.MaintenanceWindow(
        id=str(uuid.uuid4()), node_id=node_id,
        start_time=datetime.fromisoformat(start_time), end_time=datetime.fromisoformat(end_time),
        reason=reason, created_by=user_payload.get("sub"),
    )
    db.add(window)
    await db.commit()
    return StandardResponse(data={"id": window.id, "node_id": node_id})


@router.delete("/maintenance/{window_id}", response_model=StandardResponse[Dict[str, Any]])
async def delete_maintenance_window(
    window_id: str,
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(security_supabase.get_current_user_token)
) -> Any:
    """Delete a maintenance window."""
    await db.execute(delete(models.MaintenanceWindow).where(models.MaintenanceWindow.id == window_id))
    await db.commit()
    return StandardResponse(data={"id": window_id, "status": "deleted"})


# ─── P39: CONFIGURABLE ALERT THRESHOLDS ───

@router.get("/thresholds/{node_id}", response_model=StandardResponse[List[Dict[str, Any]]])
async def get_node_thresholds(
    node_id: str,
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(security_supabase.get_current_user_token)
) -> Any:
    """Get alert thresholds/rules for a specific device."""
    result = await db.execute(
        select(models.AlertRule).where(models.AlertRule.node_id == node_id)
    )
    rules = result.scalars().all()
    return StandardResponse(data=[
        {
            "id": r.id, "node_id": r.node_id, "metric": r.metric,
            "operator": r.operator, "threshold": r.threshold,
            "severity": r.severity, "enabled": r.enabled,
            "cooldown_minutes": r.cooldown_minutes,
        }
        for r in rules
    ])


@router.post("/thresholds/{node_id}", response_model=StandardResponse[Dict[str, Any]])
async def create_threshold(
    node_id: str, metric: str, operator: str, threshold: float,
    severity: str = "warning", cooldown_minutes: int = 15,
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(security_supabase.get_current_user_token)
) -> Any:
    """Create an alert threshold/rule for a device."""
    import uuid
    rule = models.AlertRule(
        id=str(uuid.uuid4()), node_id=node_id, metric=metric,
        operator=operator, threshold=threshold,
        severity=severity, cooldown_minutes=cooldown_minutes,
    )
    db.add(rule)
    await db.commit()
    return StandardResponse(data={"id": rule.id, "node_id": node_id, "metric": metric})


@router.put("/thresholds/{rule_id}", response_model=StandardResponse[Dict[str, Any]])
async def update_threshold(
    rule_id: str,
    threshold: Optional[float] = None,
    severity: Optional[str] = None,
    enabled: Optional[bool] = None,
    cooldown_minutes: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(security_supabase.get_current_user_token)
) -> Any:
    """Update an existing alert threshold/rule."""
    rule = await db.get(models.AlertRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    if threshold is not None:
        rule.threshold = threshold
    if severity is not None:
        rule.severity = severity
    if enabled is not None:
        rule.enabled = enabled
    if cooldown_minutes is not None:
        rule.cooldown_minutes = cooldown_minutes
    await db.commit()
    return StandardResponse(data={"id": rule_id, "status": "updated"})


@router.delete("/thresholds/{rule_id}", response_model=StandardResponse[Dict[str, Any]])
async def delete_threshold(
    rule_id: str,
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(security_supabase.get_current_user_token)
) -> Any:
    """Delete an alert threshold/rule."""
    await db.execute(delete(models.AlertRule).where(models.AlertRule.id == rule_id))
    await db.commit()
    return StandardResponse(data={"id": rule_id, "status": "deleted"})

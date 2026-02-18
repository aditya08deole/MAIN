from typing import Any, List, Dict
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.api import deps
from app.db.session import get_db
from app.models import all_models as models
from app.core import security_supabase

router = APIRouter()

@router.get("/stats", response_model=Dict[str, Any])
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(security_supabase.get_current_user_token)
) -> Any:
    """
    Get high-level system metrics.
    """
    # Total Nodes
    total_nodes_res = await db.execute(select(func.count(models.Node.id)))
    total_nodes = total_nodes_res.scalar()
    
    # Online Nodes
    online_res = await db.execute(select(func.count(models.Node.id)).where(models.Node.status == "Online"))
    online_nodes = online_res.scalar()
    
    # Active Alerts
    alerts_res = await db.execute(select(func.count(models.AlertHistory.id)).where(models.AlertHistory.resolved_at.is_(None)))
    active_alerts = alerts_res.scalar()
    
    return {
        "total_nodes": total_nodes,
        "online_nodes": online_nodes,
        "active_alerts": active_alerts,
        "system_health": "Good" if active_alerts < 5 else "Needs Attention"
    }

@router.get("/alerts", response_model=List[Dict[str, Any]])
async def get_active_alerts(
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(security_supabase.get_current_user_token)
) -> Any:
    """
    Get latest active alerts.
    """
    result = await db.execute(
        select(models.AlertHistory)
        .where(models.AlertHistory.resolved_at.is_(None))
        .order_by(desc(models.AlertHistory.triggered_at))
        .limit(limit)
    )
    alerts = result.scalars().all()
    
    # Simple manual serialization for now (or create Schema)
    return [
        {
            "id": a.id,
            "node_id": a.node_id,
            "rule_id": a.rule_id,
            "triggered_at": a.triggered_at,
            "value": a.value_at_time
        }
        for a in alerts
    ]

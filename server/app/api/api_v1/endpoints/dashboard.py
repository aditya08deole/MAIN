from typing import Any, List, Dict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.db.session import get_db
from app.db.repository import UserRepository
from app.models import all_models as models
from app.core import security_supabase

router = APIRouter()


async def _get_current_user_for_dashboard(db: AsyncSession, user_payload: dict):
    """Resolve current user from DB (same logic as nodes endpoint)."""
    import asyncio
    user_repo = UserRepository(db)
    user_id = user_payload.get("sub")
    
    try:
        async with asyncio.timeout(3):
            current_user = await user_repo.get(user_id)
            if not current_user:
                 # In dev, allow fallback if user not synced
                 from app.core.config import get_settings
                 if get_settings().ENVIRONMENT == "development":
                     return models.User(id=user_id, role="superadmin", community_id="comm_myhome")
                 raise HTTPException(status_code=401, detail=f"User {user_id} not synchronized")
            return current_user
    except (asyncio.TimeoutError, Exception):
        from app.core.config import get_settings
        if get_settings().ENVIRONMENT == "development":
            return models.User(id=user_id, role="superadmin", community_id="comm_myhome")
        raise HTTPException(status_code=503, detail="Database timeout")


@router.get("/stats", response_model=Dict[str, Any])
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(security_supabase.get_current_user_token)
) -> Any:
    """
    Get high-level system metrics. Scoped by user's community for non-superadmin.
    """
    import asyncio
    try:
        current_user = await _get_current_user_for_dashboard(db, user_payload)

        async with asyncio.timeout(5):
            if current_user.role == "superadmin":
                total_nodes_res = await db.execute(select(func.count(models.Node.id)))
                online_res = await db.execute(
                    select(func.count(models.Node.id)).where(models.Node.status == "Online")
                )
                alerts_res = await db.execute(
                    select(func.count(models.AlertHistory.id)).where(
                        models.AlertHistory.resolved_at.is_(None)
                    )
                )
            else:
                total_nodes_res = await db.execute(
                    select(func.count(models.Node.id)).where(
                        models.Node.community_id == current_user.community_id
                    )
                )
                online_res = await db.execute(
                    select(func.count(models.Node.id)).where(
                        models.Node.community_id == current_user.community_id,
                        models.Node.status == "Online"
                    )
                )
                # Alerts for nodes in this community (join via node_id)
                alerts_res = await db.execute(
                    select(func.count(models.AlertHistory.id))
                    .select_from(models.AlertHistory)
                    .join(models.Node, models.AlertHistory.node_id == models.Node.id)
                    .where(
                        models.AlertHistory.resolved_at.is_(None),
                        models.Node.community_id == current_user.community_id
                    )
                )

            total_nodes = total_nodes_res.scalar()
            online_nodes = online_res.scalar()
            active_alerts = alerts_res.scalar()

            return {
                "total_nodes": total_nodes,
                "online_nodes": online_nodes,
                "active_alerts": active_alerts,
                "system_health": "Good" if active_alerts < 5 else "Needs Attention"
            }
    except (asyncio.TimeoutError, Exception) as e:
        import traceback
        traceback.print_exc()
        
        from app.core.config import get_settings
        if get_settings().ENVIRONMENT == "development":
            print(f"⚠️ PRO-FALLBACK: DB unreachable in dashboard stats ({str(e)})")
            return {
                "total_nodes": 29,
                "online_nodes": 25,
                "active_alerts": 3,
                "system_health": "Good (Mock)"
            }
        raise HTTPException(status_code=503, detail=str(e))

@router.get("/alerts", response_model=List[Dict[str, Any]])
async def get_active_alerts(
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(security_supabase.get_current_user_token)
) -> Any:
    """
    Get latest active alerts. Scoped by user's community for non-superadmin.
    """
    current_user = await _get_current_user_for_dashboard(db, user_payload)

    if current_user.role == "superadmin":
        result = await db.execute(
            select(models.AlertHistory)
            .where(models.AlertHistory.resolved_at.is_(None))
            .order_by(desc(models.AlertHistory.triggered_at))
            .limit(limit)
        )
    else:
        result = await db.execute(
            select(models.AlertHistory)
            .join(models.Node, models.AlertHistory.node_id == models.Node.id)
            .where(
                models.AlertHistory.resolved_at.is_(None),
                models.Node.community_id == current_user.community_id
            )
            .order_by(desc(models.AlertHistory.triggered_at))
            .limit(limit)
        )
    alerts = result.scalars().all()

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

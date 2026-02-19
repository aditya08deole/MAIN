from typing import Any, List, Dict
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.db.session import get_db
from app.db.repository import UserRepository
from app.models import all_models as models
from app.core import security_supabase
from app.schemas.response import StandardResponse
from app.core.cache import memory_cache

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


@router.get("/stats", response_model=StandardResponse[Dict[str, Any]])
async def get_dashboard_stats(
    response: Response,
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(security_supabase.get_current_user_token)
) -> Any:
    """
    Get high-level system metrics. Scoped by user's community for non-superadmin.
    P17: Includes avg_health_score, critical_devices from DeviceState.
    P26: Falls back to materialized view mv_dashboard_stats for O(1) performance.
    """
    import asyncio
    
    # 1. Try Cache
    user_id = user_payload.get("sub")
    cache_key = f"dashboard_stats:{user_id}"
    cached_data = await memory_cache.get(cache_key)
    if cached_data:
        response.headers["X-Cache"] = "HIT"
        return StandardResponse(data=cached_data, meta={"cached": True})

    try:
        current_user = await _get_current_user_for_dashboard(db, user_payload)

        async with asyncio.timeout(5):
            if current_user.role == "superadmin":
                # P26: Try materialized view first (O(1))
                try:
                    from sqlalchemy import text
                    mv_result = await db.execute(text("SELECT * FROM mv_dashboard_stats LIMIT 1"))
                    mv_row = mv_result.first()
                    if mv_row:
                        # Also query health metrics from device_states
                        health_result = await db.execute(
                            select(
                                func.avg(models.DeviceState.health_score),
                                func.count(models.DeviceState.device_id).filter(models.DeviceState.health_score < 0.5)
                            )
                        )
                        health_row = health_result.first()
                        
                        alerts_res = await db.execute(
                            select(func.count(models.AlertHistory.id))
                            .where(models.AlertHistory.resolved_at.is_(None))
                        )
                        active_alerts = alerts_res.scalar() or 0
                        
                        data = {
                            "total_nodes": mv_row[0],
                            "online_nodes": mv_row[1],
                            "offline_nodes": mv_row[2],
                            "alert_nodes": mv_row[3],
                            "active_alerts": active_alerts,
                            "avg_health_score": round(float(health_row[0] or 0), 2),
                            "critical_devices": health_row[1] or 0,
                            "system_health": "Good" if active_alerts < 5 else "Needs Attention",
                            "source": "materialized_view"
                        }
                        
                        response.headers["Cache-Control"] = "public, max-age=60"
                        response.headers["X-Cache"] = "MISS"
                        await memory_cache.set(cache_key, data, ttl=60)
                        return StandardResponse(data=data)
                except Exception:
                    pass  # Fall through to live queries
                
                # Live queries fallback
                total_nodes_task = db.execute(select(func.count(models.Node.id)))
                online_task = db.execute(select(func.count(models.Node.id)).where(models.Node.status == "Online"))
                alerts_task = db.execute(select(func.count(models.AlertHistory.id)).where(models.AlertHistory.resolved_at.is_(None)))
                health_task = db.execute(
                    select(
                        func.avg(models.DeviceState.health_score),
                        func.count(models.DeviceState.device_id).filter(models.DeviceState.health_score < 0.5)
                    )
                )
                
                total_nodes_res, online_res, alerts_res, health_res = await asyncio.gather(
                    total_nodes_task, online_task, alerts_task, health_task
                )
            else:
                total_nodes_task = db.execute(
                    select(func.count(models.Node.id)).where(models.Node.community_id == current_user.community_id)
                )
                online_task = db.execute(
                    select(func.count(models.Node.id)).where(
                        models.Node.community_id == current_user.community_id,
                        models.Node.status == "Online"
                    )
                )
                alerts_task = db.execute(
                    select(func.count(models.AlertHistory.id))
                    .select_from(models.AlertHistory)
                    .join(models.Node, models.AlertHistory.node_id == models.Node.id)
                    .where(
                        models.AlertHistory.resolved_at.is_(None),
                        models.Node.community_id == current_user.community_id
                    )
                )
                health_task = db.execute(
                    select(
                        func.avg(models.DeviceState.health_score),
                        func.count(models.DeviceState.device_id).filter(models.DeviceState.health_score < 0.5)
                    ).select_from(models.DeviceState)
                    .join(models.Node, models.DeviceState.device_id == models.Node.id)
                    .where(models.Node.community_id == current_user.community_id)
                )
                
                total_nodes_res, online_res, alerts_res, health_res = await asyncio.gather(
                    total_nodes_task, online_task, alerts_task, health_task
                )

            total_nodes = total_nodes_res.scalar()
            online_nodes = online_res.scalar()
            active_alerts = alerts_res.scalar()
            health_row = health_res.first()

            response.headers["Cache-Control"] = "public, max-age=60"
            response.headers["X-Cache"] = "MISS"

            data = {
                "total_nodes": total_nodes,
                "online_nodes": online_nodes,
                "active_alerts": active_alerts,
                "avg_health_score": round(float(health_row[0] or 0), 2) if health_row else 0,
                "critical_devices": health_row[1] or 0 if health_row else 0,
                "system_health": "Good" if active_alerts < 5 else "Needs Attention",
                "source": "live_query"
            }
            
            await memory_cache.set(cache_key, data, ttl=60)
            
            return StandardResponse(data=data)
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
                "avg_health_score": 0.85,
                "critical_devices": 2,
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

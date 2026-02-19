"""
P30: Analytics API Endpoints
Provides device trends, fleet summary, and consumption reports.
"""
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text

from app.db.session import get_db
from app.models import all_models as models
from app.core import security_supabase
from app.schemas.response import StandardResponse
from app.core.cache import memory_cache

router = APIRouter()


@router.get("/node/{node_id}", response_model=StandardResponse[Dict[str, Any]])
async def get_node_trends(
    node_id: str,
    days: int = Query(7, le=90),
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(security_supabase.get_current_user_token)
) -> Any:
    """
    P30: Individual device trends — daily avg/min/max/count.
    Uses SQL aggregation function if available, falls back to Python computation.
    """
    cache_key = f"analytics:node:{node_id}:{days}"
    cached = await memory_cache.get(cache_key)
    if cached:
        return StandardResponse(data=cached, meta={"cached": True})
    
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    # Try SQL function first (P29)
    try:
        result = await db.execute(
            text("SELECT * FROM get_node_daily_stats(:node_id, :days)"),
            {"node_id": node_id, "days": days}
        )
        rows = result.all()
        if rows:
            data = {
                "node_id": node_id,
                "period_days": days,
                "daily_stats": [
                    {
                        "date": str(r[0]),
                        "avg_value": float(r[1]) if r[1] else None,
                        "min_value": float(r[2]) if r[2] else None,
                        "max_value": float(r[3]) if r[3] else None,
                        "reading_count": int(r[4]) if r[4] else 0,
                    }
                    for r in rows
                ],
            }
            await memory_cache.set(cache_key, data, ttl=3600)
            return StandardResponse(data=data)
    except Exception:
        pass  # SQL function may not exist yet
    
    # Fallback: Python-level aggregation from NodeReading
    result = await db.execute(
        select(models.NodeReading)
        .where(models.NodeReading.node_id == node_id, models.NodeReading.timestamp >= cutoff)
        .order_by(models.NodeReading.timestamp.desc())
        .limit(5000)
    )
    readings = result.scalars().all()
    
    # Group by date
    from collections import defaultdict
    daily = defaultdict(list)
    for r in readings:
        day = r.timestamp.strftime("%Y-%m-%d")
        val = r.data.get("field1") or r.data.get("water_level")
        if val is not None:
            try:
                daily[day].append(float(val))
            except (ValueError, TypeError):
                pass
    
    daily_stats = []
    for day, vals in sorted(daily.items(), reverse=True):
        daily_stats.append({
            "date": day,
            "avg_value": round(sum(vals) / len(vals), 2) if vals else None,
            "min_value": round(min(vals), 2) if vals else None,
            "max_value": round(max(vals), 2) if vals else None,
            "reading_count": len(vals),
        })
    
    data = {"node_id": node_id, "period_days": days, "daily_stats": daily_stats}
    await memory_cache.set(cache_key, data, ttl=3600)
    return StandardResponse(data=data)


@router.get("/fleet", response_model=StandardResponse[Dict[str, Any]])
async def get_fleet_summary(
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(security_supabase.get_current_user_token)
) -> Any:
    """
    P30: Fleet-wide summary — per device-type stats.
    """
    cache_key = "analytics:fleet"
    cached = await memory_cache.get(cache_key)
    if cached:
        return StandardResponse(data=cached, meta={"cached": True})
    
    # Try SQL function first (P29)
    try:
        result = await db.execute(text("SELECT * FROM get_fleet_summary()"))
        rows = result.all()
        if rows:
            data = {
                "categories": [
                    {
                        "device_type": r[0],
                        "total_count": int(r[1]),
                        "online_count": int(r[2]),
                        "avg_health": round(float(r[3]), 2) if r[3] else 0,
                    }
                    for r in rows
                ]
            }
            await memory_cache.set(cache_key, data, ttl=3600)
            return StandardResponse(data=data)
    except Exception:
        pass
    
    # Fallback: Python-level
    result = await db.execute(
        select(
            models.Node.category,
            func.count(models.Node.id),
            func.count(models.Node.id).filter(models.Node.status == "Online"),
        ).group_by(models.Node.category)
    )
    rows = result.all()
    
    data = {
        "categories": [
            {"device_type": r[0], "total_count": r[1], "online_count": r[2], "avg_health": 0}
            for r in rows
        ]
    }
    await memory_cache.set(cache_key, data, ttl=3600)
    return StandardResponse(data=data)


@router.get("/consumption", response_model=StandardResponse[Dict[str, Any]])
async def get_consumption_report(
    community_id: Optional[str] = None,
    days: int = Query(30, le=365),
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(security_supabase.get_current_user_token)
) -> Any:
    """
    P30: Water consumption report — daily totals for a community.
    """
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    # Get nodes in community
    query = select(models.Node.id)
    if community_id:
        query = query.where(models.Node.community_id == community_id)
    node_result = await db.execute(query)
    node_ids = [r[0] for r in node_result.all()]
    
    if not node_ids:
        return StandardResponse(data={"community_id": community_id, "daily_totals": []})
    
    # Get daily reading counts as proxy for activity
    result = await db.execute(
        select(
            func.date_trunc("day", models.NodeReading.timestamp).label("day"),
            func.count(models.NodeReading.id),
        )
        .where(
            models.NodeReading.node_id.in_(node_ids),
            models.NodeReading.timestamp >= cutoff,
        )
        .group_by("day")
        .order_by(text("day DESC"))
    )
    rows = result.all()
    
    return StandardResponse(data={
        "community_id": community_id,
        "period_days": days,
        "daily_totals": [
            {"date": str(r[0].date()) if r[0] else None, "reading_count": r[1]}
            for r in rows
        ],
    })

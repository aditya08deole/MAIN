"""
Phase 15: Dashboard Aggregation Service
Pre-calculates and caches dashboard statistics for O(1) retrieval.
Replaces expensive per-request COUNT queries with a materialized summary.
"""
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from app.core.cache import memory_cache

class AggregationService:
    """
    Maintains pre-computed dashboard statistics.
    Updated periodically by the background task loop.
    """
    _instance = None
    
    def __init__(self):
        self._summary: Dict[str, Any] = {}
        self._last_updated: Optional[datetime] = None
        self._lock = asyncio.Lock()
    
    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    async def compute_summary(self, db_session) -> Dict[str, Any]:
        """Compute full dashboard summary from DB."""
        from sqlalchemy import select, func
        from app.models.all_models import Node, Customer, Community
        
        async with self._lock:
            try:
                # Parallel queries
                nodes_q = select(func.count(Node.id))
                online_q = select(func.count(Node.id)).where(Node.status == "Online")
                alert_q = select(func.count(Node.id)).where(Node.status.in_(["Alert", "Offline"]))
                customers_q = select(func.count(Customer.id))
                communities_q = select(func.count(Community.id))
                
                results = await asyncio.gather(
                    db_session.execute(nodes_q),
                    db_session.execute(online_q),
                    db_session.execute(alert_q),
                    db_session.execute(customers_q),
                    db_session.execute(communities_q),
                )
                
                total_nodes = results[0].scalar() or 0
                online_nodes = results[1].scalar() or 0
                alert_count = results[2].scalar() or 0
                total_customers = results[3].scalar() or 0
                total_communities = results[4].scalar() or 0
                
                health = (online_nodes / total_nodes * 100) if total_nodes > 0 else 100
                
                self._summary = {
                    "total_nodes": total_nodes,
                    "online_nodes": online_nodes,
                    "active_alerts": alert_count,
                    "total_customers": total_customers,
                    "total_communities": total_communities,
                    "system_health": round(health, 1),
                    "computed_at": datetime.utcnow().isoformat()
                }
                self._last_updated = datetime.utcnow()
                
                # Cache the result
                await memory_cache.set("aggregation:dashboard", self._summary, ttl=120)
                
                return self._summary
                
            except Exception as e:
                print(f"AGGREGATION ERROR: {e}")
                return self._summary  # Return stale data
    
    async def get_summary(self) -> Dict[str, Any]:
        """Return cached summary (O(1))."""
        cached = await memory_cache.get("aggregation:dashboard")
        if cached:
            return cached
        return self._summary or {"status": "computing"}

aggregation_service = AggregationService.get_instance()

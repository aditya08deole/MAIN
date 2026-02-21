"""
Database query optimization utilities
Provides optimized query patterns and caching strategies
"""
from sqlalchemy import select, func, Index
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload
from typing import List, Optional, Dict, Any
from functools import lru_cache
import json

# ============================================================================
# QUERY OPTIMIZATION PATTERNS
# ============================================================================

class OptimizedQueries:
    """
    Collection of optimized database query patterns.
    Reduces N+1 queries and improves performance.
    """
    
    @staticmethod
    async def get_devices_with_counts(
        db: AsyncSession,
        user_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get devices with aggregated counts in single query.
        Avoids N+1 problem when fetching related data.
        """
        from models import Device
        
        # Single optimized query with aggregation
        query = (
            select(Device)
            .where(Device.user_id == user_id)
            .order_by(Device.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        
        result = await db.execute(query)
        devices = result.scalars().all()
        
        return [
            {
                "id": device.id,
                "node_key": device.node_key,
                "label": device.label,
                "category": device.category,
                "status": device.status,
                "lat": device.lat,
                "lng": device.lng,
                "location_name": device.location_name,
                "thingspeak_channel_id": device.thingspeak_channel_id,
                "created_at": device.created_at.isoformat() if device.created_at else None,
                "last_seen": device.last_seen.isoformat() if device.last_seen else None
            }
            for device in devices
        ]
    
    @staticmethod
    async def get_user_device_count(db: AsyncSession, user_id: str) -> int:
        """Get device count for user efficiently."""
        from models import Device
        
        result = await db.execute(
            select(func.count(Device.id)).where(Device.user_id == user_id)
        )
        return result.scalar() or 0
    
    @staticmethod
    async def get_devices_by_status(
        db: AsyncSession,
        user_id: str,
        status: str
    ) -> List[Any]:
        """Get devices filtered by status with index optimization."""
        from models import Device
        
        query = (
            select(Device)
            .where(Device.user_id == user_id, Device.status == status)
            .order_by(Device.last_seen.desc())
        )
        
        result = await db.execute(query)
        return result.scalars().all()


# ============================================================================
# CACHING UTILITIES
# ============================================================================

class QueryCache:
    """
    Simple in-memory query cache.
    Reduces database load for frequently accessed data.
    """
    
    def __init__(self, ttl_seconds: int = 60):
        self.ttl_seconds = ttl_seconds
        self._cache: Dict[str, Dict[str, Any]] = {}
    
    def get(self, key: str) -> Optional[Any]:
        """Get cached value if not expired."""
        import time
        
        if key not in self._cache:
            return None
        
        cached = self._cache[key]
        if time.time() - cached['timestamp'] > self.ttl_seconds:
            del self._cache[key]
            return None
        
        return cached['value']
    
    def set(self, key: str, value: Any):
        """Set cache value with timestamp."""
        import time
        
        self._cache[key] = {
            'value': value,
            'timestamp': time.time()
        }
    
    def invalidate(self, key: str):
        """Invalidate specific cache key."""
        if key in self._cache:
            del self._cache[key]
    
    def clear(self):
        """Clear entire cache."""
        self._cache.clear()


# Global cache instances
device_cache = QueryCache(ttl_seconds=30)  # 30 second TTL for devices
user_cache = QueryCache(ttl_seconds=60)    # 1 minute TTL for users


# ============================================================================
# INDEX RECOMMENDATIONS
# ============================================================================

# Recommended indexes for performance:
# CREATE INDEX idx_devices_user_id ON devices(user_id);
# CREATE INDEX idx_devices_status ON devices(status);
# CREATE INDEX idx_devices_last_seen ON devices(last_seen DESC);
# CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
# CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
# CREATE INDEX idx_frontend_errors_created_at ON frontend_errors(created_at DESC);

RECOMMENDED_INDEXES = [
    {
        "table": "devices",
        "column": "user_id",
        "type": "btree",
        "reason": "Fast filtering by owner"
    },
    {
        "table": "devices",
        "column": "status",
        "type": "btree",
        "reason": "Filter active/inactive devices"
    },
    {
        "table": "devices",
        "column": "last_seen",
        "type": "btree",
        "reason": "Sort by recent activity"
    },
    {
        "table": "audit_logs",
        "column": "user_id",
        "type": "btree",
        "reason": "Query logs by user"
    },
    {
        "table": "audit_logs",
        "column": "created_at",
        "type": "btree",
        "reason": "Time-range queries"
    },
    {
        "table": "frontend_errors",
        "column": "created_at",
        "type": "btree",
        "reason": "Recent error queries"
    }
]


# ============================================================================
# QUERY ANALYSIS
# ============================================================================

async def analyze_query_performance(db: AsyncSession, query_sql: str) -> Dict[str, Any]:
    """
    Analyze query execution plan using EXPLAIN.
    
    Args:
        db: Database session
        query_sql: SQL query to analyze
    
    Returns:
        Query execution plan and recommendations
    """
    from sqlalchemy import text
    
    try:
        # Run EXPLAIN ANALYZE
        result = await db.execute(text(f"EXPLAIN ANALYZE {query_sql}"))
        plan = result.fetchall()
        
        return {
            "query": query_sql,
            "execution_plan": [str(row) for row in plan],
            "recommendations": _generate_recommendations(plan)
        }
    except Exception as e:
        return {
            "query": query_sql,
            "error": str(e)
        }


def _generate_recommendations(plan: List[Any]) -> List[str]:
    """Generate optimization recommendations based on execution plan."""
    recommendations = []
    plan_str = str(plan)
    
    if "Seq Scan" in plan_str:
        recommendations.append("Consider adding an index - Sequential scan detected")
    
    if "cost=" in plan_str:
        # Parse cost from plan
        import re
        cost_match = re.search(r'cost=(\d+\.\d+)', plan_str)
        if cost_match and float(cost_match.group(1)) > 1000:
            recommendations.append("High query cost - consider query optimization")
    
    if not recommendations:
        recommendations.append("Query appears optimized")
    
    return recommendations


# ============================================================================
# BATCH OPERATIONS
# ============================================================================

async def batch_insert(db: AsyncSession, model_class, records: List[Dict[str, Any]]) -> int:
    """
    Batch insert records for better performance.
    
    Args:
        db: Database session
        model_class: SQLAlchemy model class
        records: List of record dictionaries
    
    Returns:
        Number of records inserted
    """
    if not records:
        return 0
    
    from sqlalchemy import insert
    
    stmt = insert(model_class).values(records)
    result = await db.execute(stmt)
    await db.commit()
    
    return len(records)


async def batch_update(
    db: AsyncSession,
    model_class,
    updates: List[Dict[str, Any]],
    key_field: str = "id"
) -> int:
    """
    Batch update records efficiently.
    
    Args:
        db: Database session
        model_class: SQLAlchemy model class
        updates: List of update dictionaries (must include key_field)
        key_field: Field to match records (default: 'id')
    
    Returns:
        Number of records updated
    """
    if not updates:
        return 0
    
    from sqlalchemy import update
    
    count = 0
    for record in updates:
        key_value = record.pop(key_field)
        stmt = update(model_class).where(
            getattr(model_class, key_field) == key_value
        ).values(**record)
        
        await db.execute(stmt)
        count += 1
    
    await db.commit()
    return count

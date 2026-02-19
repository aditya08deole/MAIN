"""
P15: Health Calculator Service
Computes device health_score (0.0–1.0) and confidence_score (0.0–1.0).
"""
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models import all_models as models


class HealthCalculator:
    """
    Computes health and confidence scores for devices.
    
    Health Score (0.0–1.0):
      - 1.0 = perfect: recent data, within range, no alerts
      - 0.0 = critical: stale data, out of range, many alerts
    
    Confidence Score (0.0–1.0):
      - Based on data volume and consistency
      - Higher = more trustworthy health score
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db

    async def compute(self, node_id: str, latest_reading: dict = None) -> dict:
        """
        Compute health and confidence for a single device.
        Returns: {"health_score": float, "confidence_score": float}
        """
        health = 1.0
        confidence = 0.0
        
        # 1. Data Freshness (40% of health)
        node = await self.db.get(models.Node, node_id)
        if node and node.last_seen:
            minutes_since = (datetime.utcnow() - node.last_seen).total_seconds() / 60
            if minutes_since > 30:
                health -= 0.4  # Very stale
            elif minutes_since > 10:
                health -= 0.2  # Moderately stale
            elif minutes_since > 5:
                health -= 0.1  # Slightly stale
        else:
            health -= 0.4  # Never seen
        
        # 2. Active Alerts (30% of health)
        alert_count_result = await self.db.execute(
            select(func.count(models.AlertHistory.id))
            .where(
                models.AlertHistory.node_id == node_id,
                models.AlertHistory.resolved_at.is_(None)
            )
        )
        active_alerts = alert_count_result.scalar() or 0
        if active_alerts >= 3:
            health -= 0.3
        elif active_alerts >= 1:
            health -= 0.15
        
        # 3. Online Status (30% of health)
        if node and node.status == "Offline":
            health -= 0.3
        elif node and node.status == "Alert":
            health -= 0.15
        
        # Clamp health
        health = max(0.0, min(1.0, health))
        
        # 4. Confidence Score — based on data volume in last 24h
        cutoff_24h = datetime.utcnow() - timedelta(hours=24)
        readings_result = await self.db.execute(
            select(func.count(models.NodeReading.id))
            .where(
                models.NodeReading.node_id == node_id,
                models.NodeReading.timestamp >= cutoff_24h
            )
        )
        readings_24h = readings_result.scalar() or 0
        
        # Expected = 1 reading per minute * 60 * 24 = 1440
        # But polling is every 60s, so expected ~ 1440
        expected_readings = 1440
        confidence = min(1.0, readings_24h / max(1, expected_readings))
        
        return {
            "health_score": round(health, 2),
            "confidence_score": round(confidence, 2),
            "readings_24h": readings_24h,
        }

    async def compute_all(self) -> list[dict]:
        """Compute health for all active devices."""
        result = await self.db.execute(
            select(models.Node.id).where(
                models.Node.status.in_(["Online", "Offline", "Alert"])
            )
        )
        node_ids = [r[0] for r in result.all()]
        
        results = []
        for nid in node_ids:
            scores = await self.compute(nid)
            scores["device_id"] = nid
            results.append(scores)
        
        return results

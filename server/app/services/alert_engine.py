from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import all_models as models
import uuid
import logging

logger = logging.getLogger(__name__)

class AlertEngine:
    """
    Evaluates telemetry against active rules and tracks alert history.
    """
    def __init__(self, db: AsyncSession):
        self.db = db

    async def check_rules(self, node_id: str, readings: dict):
        """
        Check incoming readings against all enabled rules for the node.
        """
        # Fetch active rules for this node
        result = await self.db.execute(
            select(models.AlertRule).where(
                models.AlertRule.node_id == node_id,
                models.AlertRule.enabled == True
            )
        )
        rules = result.scalars().all()
        
        for rule in rules:
            try:
                # Map metric (e.g. "flow_rate") to reading key (e.g. "field1")
                # For now using direct mapping or simple convention
                metric_key = rule.metric # "field1"
                
                if metric_key not in readings:
                    continue
                    
                val_str = readings.get(metric_key)
                if val_str is None:
                    continue
                    
                try:
                    val = float(val_str)
                except ValueError:
                    continue
                
                triggered = False
                if rule.operator == ">":
                    triggered = val > rule.threshold
                elif rule.operator == "<":
                    triggered = val < rule.threshold
                elif rule.operator == "==":
                    triggered = val == rule.threshold
                    
                if triggered:
                    await self._create_alert(node_id, rule, val)
                else:
                    await self._resolve_alert(node_id, rule) # Auto-resolve logic
                    
            except Exception as e:
                logger.error(f"Error evaluating rule {rule.id}: {e}")
    
    async def _create_alert(self, node_id: str, rule: models.AlertRule, val: float):
        # Check if already active (unresolved)
        existing = await self.db.execute(
            select(models.AlertHistory).where(
                models.AlertHistory.node_id == node_id,
                models.AlertHistory.rule_id == rule.id,
                models.AlertHistory.resolved_at.is_(None)
            )
        )
        if existing.scalars().first():
            return # Already active
            
        # Create new alert
        alert = models.AlertHistory(
            id=str(uuid.uuid4()),
            node_id=node_id,
            rule_id=rule.id,
            value_at_time=val
        )
        self.db.add(alert)
        await self.db.commit()
        logger.warning(f"⚠️ ALERT TRIGGERED: Node {node_id} - {rule.metric} {rule.operator} {rule.threshold}")
        
        # Send Notification
        from app.services.notifications.console import ConsoleNotificationProvider
        notifier = ConsoleNotificationProvider()
        # In real app, fetch user contact based on Node owner
        await notifier.send("admin@evara.com", f"Alert: Node {node_id}", f"Metric {rule.metric} went {rule.operator} {rule.threshold}. Value: {val}")
        
    async def _resolve_alert(self, node_id: str, rule: models.AlertRule):
        # Find active alert
        existing_result = await self.db.execute(
            select(models.AlertHistory).where(
                models.AlertHistory.node_id == node_id,
                models.AlertHistory.rule_id == rule.id,
                models.AlertHistory.resolved_at.is_(None)
            )
        )
        active_alert = existing_result.scalars().first()
        
        if active_alert:
            from datetime import datetime
            active_alert.resolved_at = datetime.utcnow()
            await self.db.commit()
            logger.info(f"✅ ALERT RESOLVED: Node {node_id} - {rule.id}")

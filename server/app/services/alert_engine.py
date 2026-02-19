from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import all_models as models
from datetime import datetime
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
        # Check if already active (unresolved) — P23 de-duplication
        existing = await self.db.execute(
            select(models.AlertHistory).where(
                models.AlertHistory.node_id == node_id,
                models.AlertHistory.rule_id == rule.id,
                models.AlertHistory.resolved_at.is_(None)
            )
        )
        active = existing.scalars().first()
        if active:
            # Update last_triggered timestamp without creating duplicate
            active.triggered_at = datetime.utcnow()
            await self.db.commit()
            return  # Already active
        
        # P20: Generate rich alert context
        severity = getattr(rule, 'severity', 'warning') or 'warning'
        title = f"[{severity.upper()}] Node {node_id} — {rule.metric} {rule.operator} {rule.threshold}"
        message = f"Metric '{rule.metric}' recorded value {val} which {rule.operator} threshold {rule.threshold}. Triggered at {datetime.utcnow().isoformat()}"
            
        # Create new alert with full context
        alert = models.AlertHistory(
            id=str(uuid.uuid4()),
            node_id=node_id,
            rule_id=rule.id,
            severity=severity,
            category="threshold_exceeded",
            title=title,
            message=message,
            value_at_time=val
        )
        self.db.add(alert)
        await self.db.commit()
        logger.warning(f"⚠️ ALERT TRIGGERED: {title}")
        
        # Send Notification
        from app.services.notifications.console import ConsoleNotificationProvider
        notifier = ConsoleNotificationProvider()
        await notifier.send("admin@evara.com", f"Alert: Node {node_id}", message)
        
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
            active_alert.resolved_at = datetime.utcnow()
            await self.db.commit()
            logger.info(f"✅ ALERT RESOLVED: Node {node_id} - {rule.id}")

    async def create_offline_alert(self, node_id: str):
        """Create a single 'device_offline' alert for a node (de-duped)."""
        existing = await self.db.execute(
            select(models.AlertHistory).where(
                models.AlertHistory.node_id == node_id,
                models.AlertHistory.category == "device_offline",
                models.AlertHistory.resolved_at.is_(None),
            )
        )
        if existing.scalars().first():
            return  # Already has an active offline alert

        alert = models.AlertHistory(
            id=str(uuid.uuid4()),
            node_id=node_id,
            severity="critical",
            category="device_offline",
            title=f"Device Offline",
            message=f"Node {node_id} stopped sending data (3 consecutive poll failures).",
        )
        self.db.add(alert)
        await self.db.commit()
        logger.warning(f"🔴 OFFLINE ALERT: Node {node_id}")

    async def auto_resolve_offline_alert(self, node_id: str):
        """Resolve any open 'device_offline' alert when a node comes back online."""
        result = await self.db.execute(
            select(models.AlertHistory).where(
                models.AlertHistory.node_id == node_id,
                models.AlertHistory.category == "device_offline",
                models.AlertHistory.resolved_at.is_(None),
            )
        )
        alert = result.scalars().first()
        if alert:
            alert.resolved_at = datetime.utcnow()
            alert.resolve_comment = "Auto-resolved: device came back online."
            await self.db.commit()
            logger.info(f"✅ OFFLINE ALERT RESOLVED: Node {node_id}")

    # P22: Offline detection alert
    async def create_offline_alert(self, node_id: str):
        """Create an alert when a device goes offline (3 consecutive failures)."""
        # P38: Check if node is in maintenance window — suppress alerts
        if await self._in_maintenance_window(node_id):
            logger.info(f"⏸️ Alert suppressed: Node {node_id} is in maintenance window")
            return
        
        # Check if offline alert already exists (de-duplication)
        existing = await self.db.execute(
            select(models.AlertHistory).where(
                models.AlertHistory.node_id == node_id,
                models.AlertHistory.category == "offline",
                models.AlertHistory.resolved_at.is_(None)
            )
        )
        if existing.scalars().first():
            return  # Already alerted
        
        alert = models.AlertHistory(
            id=str(uuid.uuid4()),
            node_id=node_id,
            severity="critical",
            category="offline",
            title=f"[CRITICAL] Node {node_id} — Device Offline",
            message=f"Device has not responded after 3 consecutive polling attempts. Last check: {datetime.utcnow().isoformat()}",
        )
        self.db.add(alert)
        await self.db.commit()
        logger.warning(f"⚠️ OFFLINE ALERT: Node {node_id}")
        
        # P24: Dispatch notification
        try:
            from app.services.notification_dispatcher import NotificationDispatcher
            dispatcher = NotificationDispatcher(self.db)
            await dispatcher.dispatch_alert(alert)
        except Exception as e:
            logger.error(f"Notification dispatch failed: {e}")

    async def auto_resolve_offline_alert(self, node_id: str):
        """P22: Auto-resolve offline alert when device comes back online."""
        result = await self.db.execute(
            select(models.AlertHistory).where(
                models.AlertHistory.node_id == node_id,
                models.AlertHistory.category == "offline",
                models.AlertHistory.resolved_at.is_(None)
            )
        )
        active = result.scalars().first()
        if active:
            active.resolved_at = datetime.utcnow()
            active.resolve_comment = "Auto-resolved: device came back online"
            await self.db.commit()
            logger.info(f"✅ OFFLINE ALERT AUTO-RESOLVED: Node {node_id}")

    # P38: Maintenance window check
    async def _in_maintenance_window(self, node_id: str) -> bool:
        """Check if node is currently in a maintenance window."""
        try:
            result = await self.db.execute(
                select(models.MaintenanceWindow).where(
                    models.MaintenanceWindow.node_id == node_id,
                    models.MaintenanceWindow.start_time <= datetime.utcnow(),
                    models.MaintenanceWindow.end_time >= datetime.utcnow(),
                )
            )
            return result.scalars().first() is not None
        except Exception:
            return False


"""
P24/P36/P42: Notification Dispatcher + Webhook Service
Routes alerts to multiple channels with HMAC request signing.
"""
import hashlib
import hmac
import json
import logging
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import all_models as models

logger = logging.getLogger(__name__)


class NotificationDispatcher:
    """
    P24: Routes notifications to configured channels.
    Supports: console, webhook, email (future).
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def dispatch_alert(self, alert: models.AlertHistory, node: models.Node = None):
        """Send alert through all configured channels."""
        # 1. Console (always)
        logger.warning(f"🔔 ALERT [{alert.severity}]: {alert.title}")
        
        # 2. Webhooks (P42)
        await self._dispatch_webhooks("alert.triggered", {
            "alert_id": alert.id,
            "node_id": alert.node_id,
            "severity": alert.severity,
            "title": alert.title,
            "message": alert.message,
            "value": alert.value_at_time,
            "triggered_at": alert.triggered_at.isoformat() if alert.triggered_at else None,
            "node_label": node.label if node else None,
        })
    
    async def dispatch_device_event(self, event_type: str, node_id: str, data: dict):
        """Send device events (online/offline) through webhooks."""
        await self._dispatch_webhooks(event_type, {
            "node_id": node_id,
            "event": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            **data,
        })
    
    async def _dispatch_webhooks(self, event_type: str, payload: dict):
        """P42: Send to all active webhook subscriptions matching event."""
        try:
            result = await self.db.execute(
                select(models.WebhookSubscription).where(
                    models.WebhookSubscription.active == True
                )
            )
            subscriptions = result.scalars().all()
            
            for sub in subscriptions:
                # Check if subscription is interested in this event
                events = sub.events or []
                if event_type not in events and "*" not in events:
                    continue
                
                await self._send_webhook(sub.url, payload, sub.secret)
                
        except Exception as e:
            logger.error(f"Webhook dispatch error: {e}")
    
    async def _send_webhook(self, url: str, payload: dict, secret: Optional[str] = None):
        """P36: Send webhook with HMAC-SHA256 signature."""
        import httpx
        
        body = json.dumps(payload, default=str)
        headers = {"Content-Type": "application/json"}
        
        # P36: Request signing
        if secret:
            signature = hmac.new(
                secret.encode("utf-8"),
                body.encode("utf-8"),
                hashlib.sha256
            ).hexdigest()
            headers["X-Signature"] = f"sha256={signature}"
            headers["X-Timestamp"] = datetime.utcnow().isoformat()
        
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.post(url, content=body, headers=headers)
                logger.info(f"Webhook sent to {url}: HTTP {resp.status_code}")
        except Exception as e:
            logger.error(f"Webhook delivery failed to {url}: {e}")
            # TODO: Retry with exponential backoff (3 attempts)

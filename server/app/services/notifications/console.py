from typing import List
from app.services.notifications.base import BaseNotificationProvider
import logging

logger = logging.getLogger(__name__)

class ConsoleNotificationProvider(BaseNotificationProvider):
    """
    Stub provider that logs notifications to console/logger.
    Useful for dev and debugging.
    """
    async def send(self, recipient: str, subject: str, message: str) -> bool:
        logger.info(f"🔔 NOTIFICATION | To: {recipient} | Subject: {subject} | Body: {message}")
        print(f"🔔 [ConsoleNotify] To: {recipient} | {subject} | {message}")
        return True

    async def send_batch(self, recipients: List[str], subject: str, message: str) -> bool:
        for r in recipients:
            await self.send(r, subject, message)
        return True

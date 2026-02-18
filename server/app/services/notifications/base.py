from abc import ABC, abstractmethod
from typing import List

class BaseNotificationProvider(ABC):
    """
    Abstract Interface for sending notifications.
    Implementations: Email, SMS, Slack, Console.
    """
    @abstractmethod
    async def send(self, recipient: str, subject: str, message: str) -> bool:
        pass
        
    @abstractmethod
    async def send_batch(self, recipients: List[str], subject: str, message: str) -> bool:
        pass

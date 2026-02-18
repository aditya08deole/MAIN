from abc import ABC, abstractmethod
from typing import List, Dict, Any

class BaseTelemetryService(ABC):
    """
    Abstract Base Class for Telemetry Ingestion.
    Supports pluggable sources (ThingSpeak, MQTT, HTTP).
    """
    
    @abstractmethod
    async def fetch_latest(self, device_id: str) -> Dict[str, Any]:
        """Fetch the latest single reading for a device."""
        pass

    @abstractmethod
    async def fetch_history(self, device_id: str, start_ts: int, end_ts: int) -> List[Dict[str, Any]]:
        """Fetch historical data range."""
        pass
    
    @abstractmethod
    async def push_reading(self, device_id: str, data: Dict[str, Any]) -> bool:
        """Push a reading to the downstream storage (DB/TimeScale)."""
        pass

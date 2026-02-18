import httpx
from typing import Dict, Any, List, Optional
from app.services.telemetry.base import BaseTelemetryService
from app.core.config import get_settings

settings = get_settings()

class ThingSpeakTelemetryService(BaseTelemetryService):
    """
    ThingSpeak implementation of Telemetry Service.
    """
    BASE_URL = "https://api.thingspeak.com"

    async def fetch_latest(self, node_id: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Fetch latest reading from ThingSpeak Channel.
        Config must contain 'channel_id' and 'read_key'.
        """
        channel_id = config.get("channel_id")
        read_key = config.get("read_key")
        
        if not channel_id:
            return {}

        url = f"{self.BASE_URL}/channels/{channel_id}/feeds.json"
        params = {
            "api_key": read_key,
            "results": 1
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, params=params, timeout=5.0)
                response.raise_for_status()
                data = response.json()
                
                feeds = data.get("feeds", [])
                if not feeds:
                    return {}
                
                # Normalize Data
                latest = feeds[0]
                return self._normalize_reading(latest)
            except Exception as e:
                # Log error
                print(f"Error fetching ThingSpeak data for {node_id}: {e}")
                return {}

    async def fetch_history(self, node_id: str, config: Dict[str, Any], days: int = 1) -> List[Dict[str, Any]]:
        """
        Fetch historical data.
        """
        channel_id = config.get("channel_id")
        read_key = config.get("read_key")
        
        if not channel_id:
            return []
            
        url = f"{self.BASE_URL}/channels/{channel_id}/feeds.json"
        params = {
            "api_key": read_key,
            "days": days
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, params=params, timeout=10.0)
                response.raise_for_status()
                data = response.json()
                
                feeds = data.get("feeds", [])
                return [self._normalize_reading(f) for f in feeds]
            except Exception:
                return []

    async def push_reading(self, node_id: str, data: Dict[str, Any]) -> bool:
        """
        Not implemented for ThingSpeak usually (devices push directly), 
        but could be used if backend proxies the write.
        """
        pass

    def _normalize_reading(self, raw: Dict[str, Any]) -> Dict[str, Any]:
        """Convert ThingSpeak field1..N to named keys if possible."""
        # In a real app, we'd map field1 -> 'flow_rate' based on Node config
        # For now, just return raw with timestamp
        return {
            "timestamp": raw.get("created_at"),
            "entry_id": raw.get("entry_id"),
            "field1": raw.get("field1"),
            "field2": raw.get("field2"),
            "field3": raw.get("field3"),
            # ...
        }

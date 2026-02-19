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
        Config must contain 'channel_id', 'read_key', and 'field_mapping'.
        """
        channel_id = config.get("channel_id")
        read_key = config.get("read_key")
        mapping = config.get("field_mapping", {})
        
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
                return self._normalize_reading(latest, mapping)
            except Exception as e:
                print(f"Error fetching ThingSpeak data for {node_id}: {e}")
                return {}

    async def fetch_history(self, node_id: str, config: Dict[str, Any], days: int = 1) -> List[Dict[str, Any]]:
        """
        Fetch historical data and apply mapping.
        """
        channel_id = config.get("channel_id")
        read_key = config.get("read_key")
        mapping = config.get("field_mapping", {})
        
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
                return [self._normalize_reading(f, mapping) for f in feeds]
            except Exception:
                return []

    def _normalize_reading(self, raw: Dict[str, Any], mapping: Dict[str, str]) -> Dict[str, Any]:
        """Convert ThingSpeak field1..N to named keys based on field_mapping."""
        normalized = {
            "timestamp": raw.get("created_at"),
            "entry_id": raw.get("entry_id")
        }
        
        # Apply Mapping: e.g. {"field1": "depth"} -> normalized["depth"] = raw["field1"]
        for ts_field, alias in mapping.items():
            if ts_field in raw:
                try:
                    val = raw[ts_field]
                    # Try to convert to float/int if numeric
                    if val is not None and isinstance(val, str):
                        if '.' in val: val = float(val)
                        else: val = int(val)
                    normalized[alias] = val
                except ValueError:
                    normalized[alias] = raw[ts_field]
        
        # Always include raw fields as fallback if no mapping
        if not mapping:
            for i in range(1, 9):
                key = f"field{i}"
                if key in raw:
                    normalized[key] = raw[key]
                    
        return normalized

    async def push_reading(self, device_id: str, data: Dict[str, Any]) -> bool:
        """
        Push a reading to ThingSpeak (not typically used as we mostly pull).
        Returns True if successful.
        """
        # ThingSpeak is primarily a pull-based system
        # This method is here to satisfy the abstract base class
        # but in practice we don't push to ThingSpeak from our API
        return True

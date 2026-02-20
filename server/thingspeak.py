"""
ThingSpeak API client.
Simple wrapper for fetching telemetry data from ThingSpeak channels.
"""
import httpx
from typing import Dict, Any, Optional, List


class ThingSpeakClient:
    """ThingSpeak API client for fetching channel data with caching and rate limiting."""
    
    BASE_URL = "https://api.thingspeak.com"
    CACHE_TTL = 30  # Cache data for 30 seconds
    
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=10.0)
        self._cache = {}  # Simple in-memory cache: {channel_id: (timestamp, data)}
        self._last_request_time = 0
        self._min_request_interval = 0.25  # 250ms between requests (4 req/sec max)
    
    async def get_latest(
        self,
        channel_id: str,
        read_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Fetch latest reading from ThingSpeak channel with caching and rate limiting.
        
        Args:
            channel_id: ThingSpeak channel ID
            read_key: Read API key (optional for public channels)
        
        Returns:
            dict: Latest feed data
            {
                "created_at": "2024-01-01T12:00:00Z",
                "entry_id": 123,
                "field1": "25.5",
                "field2": "60.2",
                ...
            }
        """
        import time
        import asyncio
        
        # Check cache first
        cache_key = f"latest:{channel_id}"
        if cache_key in self._cache:
            timestamp, data = self._cache[cache_key]
            if time.time() - timestamp < self.CACHE_TTL:
                print(f"[CACHE HIT] ThingSpeak channel {channel_id}")
                return data
        
        # Rate limiting
        time_since_last_request = time.time() - self._last_request_time
        if time_since_last_request < self._min_request_interval:
            await asyncio.sleep(self._min_request_interval - time_since_last_request)
        
        url = f"{self.BASE_URL}/channels/{channel_id}/feeds/last.json"
        params = {}
        if read_key:
            params["api_key"] = read_key
        
        try:
            self._last_request_time = time.time()
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            # Cache the result
            self._cache[cache_key] = (time.time(), data)
            print(f"[CACHE MISS] ThingSpeak channel {channel_id} - fetched and cached")
            
            return data
        except httpx.HTTPStatusError as e:
            print(f"[ERROR] ThingSpeak API HTTP {e.response.status_code}: {e}")
            return {}
        except httpx.TimeoutException:
            print(f"[ERROR] ThingSpeak API timeout for channel {channel_id}")
            return {}
        except Exception as e:
            print(f"[ERROR] Unexpected error fetching ThingSpeak data: {e}")
            return {}
    
    async def get_history(
        self,
        channel_id: str,
        read_key: Optional[str] = None,
        results: int = 100
    ) -> Dict[str, Any]:
        """
        Fetch historical data from ThingSpeak channel.
        
        Args:
            channel_id: ThingSpeak channel ID
            read_key: Read API key (optional for public channels)
            results: Number of results to fetch (default 100, max 8000)
        
        Returns:
            dict: Channel data with feeds
            {
                "channel": {...},
                "feeds": [
                    {
                        "created_at": "...",
                        "field1": "...",
                        ...
                    }
                ]
            }
        """
        url = f"{self.BASE_URL}/channels/{channel_id}/feeds.json"
        params = {"results": min(results, 8000)}  # ThingSpeak max is 8000
        if read_key:
            params["api_key"] = read_key
        
        try:
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            print(f"[ERROR] ThingSpeak API error: {e}")
            return {"channel": {}, "feeds": []}
        except Exception as e:
            print(f"[ERROR] Unexpected error fetching ThingSpeak history: {e}")
            return {"channel": {}, "feeds": []}
    
    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()


# Singleton instance
_thingspeak_client: Optional[ThingSpeakClient] = None


def get_thingspeak_client() -> ThingSpeakClient:
    """Get or create ThingSpeak client singleton."""
    global _thingspeak_client
    if _thingspeak_client is None:
        _thingspeak_client = ThingSpeakClient()
    return _thingspeak_client

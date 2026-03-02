import httpx
import time
import asyncio
import logging
from typing import Dict, Any, Optional
from datetime import datetime
from diskcache import Cache

logger = logging.getLogger(__name__)

class TelemetryMapper:
    """Base class for mapping raw ThingSpeak fields to typed snapshot columns."""
    
    @staticmethod
    def map_tank(feed: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
        """Maps fields for EvaraTank.
        
        The ultrasonic sensor measures the distance from the top of the tank to the water surface.
        To get the water level percentage:
        1. Water Level (cm) = Tank Height (cm) - Sensor Reading (cm)
        2. Percentage = (Water Level / Tank Height) × 100
        """
        mapping = config.get("field_mapping", {})
        
        # Tank height in cm (total height from bottom to top)
        # TODO: Move this to device-specific config in database
        TANK_HEIGHT_CM = 1316.0
        
        # Get sensor reading (distance from top to water surface in cm)
        depth_field = mapping.get("depth_field", "field1")
        sensor_distance_cm = float(feed.get(depth_field)) if feed.get(depth_field) is not None else None
        
        # Calculate water level percentage
        if sensor_distance_cm is not None:
            # Water level = tank height - distance from top
            water_level_cm = max(0, TANK_HEIGHT_CM - sensor_distance_cm)
            # Convert to percentage (capped between 0-100%)
            level_percentage = min(100.0, max(0.0, (water_level_cm / TANK_HEIGHT_CM) * 100))
        else:
            level_percentage = None
        
        # Optional temperature field
        temp_field = mapping.get("temperature", "field2")
        
        return {
            "level_percentage": level_percentage,
            "temperature_value": float(feed.get(temp_field)) if feed.get(temp_field) is not None else None,
        }

    @staticmethod
    def map_flow(feed: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
        """Maps fields for EvaraFlow."""
        mapping = config.get("field_mapping", {})
        # Standard Flow fields: total_liters (cumulative), flow_rate (instantaneous)
        liters_field = mapping.get("total_liters", "field1")
        rate_field = mapping.get("flow_rate", "field2")
        
        return {
            "total_liters": int(float(feed.get(liters_field))) if feed.get(liters_field) is not None else None,
            "flow_rate": float(feed.get(rate_field)) if feed.get(rate_field) is not None else None,
        }

    @staticmethod
    def map_deep(feed: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
        """Maps fields for EvaraDeep."""
        mapping = config.get("field_mapping", {})
        # Standard Deep fields: water_depth (from surface)
        depth_field = mapping.get("depth", "field1")
        
        return {
            "depth_value": float(feed.get(depth_field)) if feed.get(depth_field) is not None else None,
        }

class ThingSpeakClient:
    """
    Industrial-grade ThingSpeak ingestion client.
    Implements:
    - Request Coalescing (Thundering Herd protection via Promise Registry)
    - Rate Limit compliance (Min interval enforcement & exponential backoff)
    - Chunk-based incremental fetching (via last_fetched_at)
    """

    BASE_URL = "https://api.thingspeak.com"
    CACHE_TTL = 30  # Fallback snapshot TTL
    MIN_REQUEST_INTERVAL = 15.0  # Strict 15s polling interval per channel to respect free tier limits

    def __init__(self):
        self.client = httpx.AsyncClient(timeout=15.0)
        self.cache = Cache('./.telemetry_cache')
        # Rate tracking: channel_id -> last_request_time
        self._last_request_times: Dict[str, float] = {}
        # Promise Registry for Request Coalescing: device_id -> asyncio.Future
        self._active_fetches: Dict[str, asyncio.Future] = {}

    async def _safe_fetch_with_backoff(self, url: str, params: Dict[str, Any], max_retries=3) -> Optional[Dict]:
        """Execute HTTP request with strict exponential backoff on 429s."""
        base_delay = 1.0
        for attempt in range(max_retries):
            try:
                response = await self.client.get(url, params=params)
                if response.status_code == 429: # Too Many Requests
                    delay = base_delay * (2 ** attempt)
                    logger.warning(f"[Rate Limit] ThingSpeak 429. Backing off for {delay}s...")
                    await asyncio.sleep(delay)
                    continue
                response.raise_for_status()
                return response.json()
            except httpx.HTTPError as e:
                logger.error(f"[ThingSpeak HTTP Error] Attempt {attempt+1}/{max_retries}: {e}")
                if attempt == max_retries - 1:
                    return None
            except Exception as e:
                logger.error(f"[ThingSpeak Unexpected Error]: {e}")
                return None
        return None

    async def fetch_incremental_telemetry(
        self,
        device_id: str,
        channel_id: str,
        read_key: Optional[str] = None,
        last_fetched_at: Optional[datetime] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Fetch only new data since last_fetched_at.
        Uses Request Coalescing to ensure concurrent requests for the same device return the same promise.
        """
        # 1. Request Coalescing (Thundering Herd Protection)
        if device_id in self._active_fetches:
            logger.info(f"[Coalesce] Merging concurrent request for device {device_id}")
            return await self._active_fetches[device_id]

        future = asyncio.Future()
        self._active_fetches[device_id] = future

        try:
            # 2. Rate Limit Enforcement
            now = time.time()
            last_req = self._last_request_times.get(channel_id, 0)
            elapsed = now - last_req

            if elapsed < self.MIN_REQUEST_INTERVAL:
                wait_time = self.MIN_REQUEST_INTERVAL - elapsed
                logger.debug(f"[Rate Limit] Deferring fetch for {channel_id} by {wait_time:.2f}s")
                await asyncio.sleep(wait_time)
            
            self._last_request_times[channel_id] = time.time()

            # 3. Construct Chunk Fetch URL
            url = f"{self.BASE_URL}/channels/{channel_id}/feeds.json"
            params: Dict[str, Any] = {"results": 1} # Fallback to latest 1 if no timestamp
            if read_key:
                params["api_key"] = read_key
            
            if last_fetched_at:
                # Format to ThingSpeak required ISO format: YYYY-MM-DD%20HH:NN:SS
                ts_str = last_fetched_at.strftime('%Y-%m-%d %H:%M:%S')
                params["start"] = ts_str
                # Remove results limit if fetching a chunk based on time
                del params["results"] 

            logger.info(f"[ThingSpeak Fetch] Channel {channel_id} | Since: {last_fetched_at}")
            
            data = await self._safe_fetch_with_backoff(url, params)
            
            future.set_result(data)
            return data

        except Exception as e:
            logger.error(f"[ThingSpeak Fetch Failed] Device {device_id}: {e}")
            future.set_result(None)
            return None
            
        finally:
            if device_id in self._active_fetches:
                del self._active_fetches[device_id]

    async def get_history(self, channel_id: str, read_key: Optional[str] = None, results: int = 100) -> Dict[str, Any]:
        """Fetch historical data. Standard proxy bypass."""
        url = f"{self.BASE_URL}/channels/{channel_id}/feeds.json"
        params = {"results": min(results, 8000)}
        if read_key:
            params["api_key"] = read_key
        data = await self._safe_fetch_with_backoff(url, params)
        return data or {"channel": {}, "feeds": []}

    async def close(self):
        """Close HTTP client and cache."""
        await self.client.aclose()
        self.cache.close()

# Singleton logic
_thingspeak_client: Optional[ThingSpeakClient] = None

def get_thingspeak_client() -> ThingSpeakClient:
    global _thingspeak_client
    if _thingspeak_client is None:
        _thingspeak_client = ThingSpeakClient()
    return _thingspeak_client

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
        """
        Maps fields for EvaraTank.
        Physics: the sensor reports AIR GAP from sensor (top) to water surface.
          water_height_cm = tank_height_cm - air_gap_cm
          level_percentage  = water_height_cm / tank_height_cm * 100
        tank_height_cm is stored in device_telemetry_config by PUT /config;
        falls back to 1316cm (13.16m) if not yet set.
        """
        mapping = config.get("field_mapping", {})

        # Use DB-stored height (set via PUT /config); fallback to legacy constant
        TANK_HEIGHT_CM = float(config.get("tank_height_cm") or 1316.0)

        depth_field = mapping.get("depth_field", "field1")
        raw = feed.get(depth_field)
        sensor_distance_cm = float(raw) if raw is not None else None

        if sensor_distance_cm is not None:
            water_level_cm = max(0.0, min(TANK_HEIGHT_CM, TANK_HEIGHT_CM - sensor_distance_cm))
            level_percentage = round(water_level_cm / TANK_HEIGHT_CM * 100, 4)
        else:
            level_percentage = None

        temp_field = mapping.get("temperature", "field2")
        raw_temp = feed.get(temp_field)
        return {
            "level_percentage": level_percentage,
            "temperature_value": float(raw_temp) if raw_temp is not None else None,
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
        """
        Maps fields for EvaraDeep.
        Default mapping (KRB WL8 device):
          field1 → temperature_value  (°C from onboard sensor)
          field2 → depth_value        (cm distance from sensor to water surface)
        Overridable via device_telemetry_config.field_mapping:
          {"depth": "field2", "temperature": "field1"}
        """
        mapping = config.get("field_mapping", {})
        depth_field = mapping.get("depth", "field2")          # KRB: field2 = distance sensor
        temp_field  = mapping.get("temperature", "field1")    # KRB: field1 = temperature

        raw_depth = feed.get(depth_field)
        raw_temp  = feed.get(temp_field)

        return {
            "depth_value":       float(raw_depth) if raw_depth is not None else None,
            "temperature_value": float(raw_temp)  if raw_temp  is not None else None,
        }

class ThingSpeakClient:
    """
    Industrial-grade ThingSpeak ingestion client.
    Implements:
    - Request Coalescing (Thundering Herd protection via Promise Registry)
    - Rate Limit compliance (Min interval enforcement & exponential backoff)
    - Chunk-based incremental fetching (via last_fetched_at)
    - Phase 25: Per-channel circuit breaker (open after 5 consecutive failures)
    """

    BASE_URL = "https://api.thingspeak.com"
    CACHE_TTL = 30  # Fallback snapshot TTL
    MIN_REQUEST_INTERVAL = 15.0  # Strict 15s polling interval per channel to respect free tier limits

    # Circuit breaker config
    CB_FAILURE_THRESHOLD = 5          # open after this many consecutive failures
    CB_HALF_OPEN_TIMEOUT = 300.0      # seconds before trying again (5 min)

    def __init__(self):
        self.client = httpx.AsyncClient(timeout=15.0)
        self.cache = Cache('./.telemetry_cache')
        # Rate tracking: channel_id -> last_request_time
        self._last_request_times: Dict[str, float] = {}
        # Promise Registry for Request Coalescing: device_id -> asyncio.Future
        self._active_fetches: Dict[str, asyncio.Future] = {}
        # Phase 25: Circuit breaker state per channel_id
        # State: 'closed' | 'open' | 'half-open'
        self._cb_failures: Dict[str, int] = {}       # consecutive failure count
        self._cb_opened_at: Dict[str, float] = {}    # timestamp when circuit opened
        self._cb_state: Dict[str, str] = {}          # 'closed' | 'open'

    # ------------------------------------------------------------------ #
    # Phase 25: Circuit breaker helpers                                    #
    # ------------------------------------------------------------------ #

    def _cb_is_open(self, channel_id: str) -> bool:
        """Return True if the circuit is OPEN (requests should be blocked)."""
        state = self._cb_state.get(channel_id, "closed")
        if state == "open":
            # Check half-open timeout
            opened_at = self._cb_opened_at.get(channel_id, 0.0)
            if time.time() - opened_at >= self.CB_HALF_OPEN_TIMEOUT:
                # Transition to half-open — allow one probe
                self._cb_state[channel_id] = "half-open"
                logger.info(f"[CircuitBreaker] Channel {channel_id}: half-open probe allowed")
                return False
            return True
        return False

    def _cb_record_success(self, channel_id: str) -> None:
        self._cb_failures[channel_id] = 0
        self._cb_state[channel_id] = "closed"

    def _cb_record_failure(self, channel_id: str) -> None:
        count = self._cb_failures.get(channel_id, 0) + 1
        self._cb_failures[channel_id] = count
        if count >= self.CB_FAILURE_THRESHOLD:
            if self._cb_state.get(channel_id) != "open":
                self._cb_state[channel_id] = "open"
                self._cb_opened_at[channel_id] = time.time()
                logger.error(
                    f"[CircuitBreaker] Channel {channel_id}: OPEN after "
                    f"{count} consecutive failures. Will retry in {self.CB_HALF_OPEN_TIMEOUT}s."
                )

    async def _safe_fetch_with_backoff(self, url: str, params: Dict[str, Any], max_retries=3, channel_id: Optional[str] = None) -> Optional[Dict]:
        """Execute HTTP request with strict exponential backoff on 429s.
        Integrates with circuit breaker if channel_id is provided (Phase 25).
        """
        # Phase 25: circuit breaker check
        if channel_id and self._cb_is_open(channel_id):
            logger.warning(f"[CircuitBreaker] Channel {channel_id}: OPEN — request blocked, returning None")
            return None

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
                result = response.json()
                if channel_id:
                    self._cb_record_success(channel_id)
                return result
            except httpx.HTTPError as e:
                logger.error(f"[ThingSpeak HTTP Error] Attempt {attempt+1}/{max_retries}: {e}")
                if attempt == max_retries - 1:
                    if channel_id:
                        self._cb_record_failure(channel_id)
                    return None
            except Exception as e:
                logger.error(f"[ThingSpeak Unexpected Error]: {e}")
                if channel_id:
                    self._cb_record_failure(channel_id)
                return None
        if channel_id:
            self._cb_record_failure(channel_id)
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
        - Request Coalescing: concurrent callers share one in-flight future.
        - Rate Limit: if within window, return cached snapshot immediately (no sleep).
        - Cap: incremental fetches limited to results=50 to prevent memory spikes.
        - Cache: successful fetch is written to diskcache for subsequent rate-limited hits.
        """
        # 1. Request Coalescing (Thundering Herd Protection)
        if device_id in self._active_fetches:
            logger.info(f"[Coalesce] Merging concurrent request for device {device_id}")
            return await self._active_fetches[device_id]

        future: asyncio.Future = asyncio.get_running_loop().create_future()  # FIX: get_event_loop() deprecated in Python 3.10+
        self._active_fetches[device_id] = future

        try:
            # 2. Rate Limit — return cached snapshot immediately (never block the request path)
            now = time.time()
            last_req = self._last_request_times.get(channel_id, 0)
            elapsed = now - last_req

            if elapsed < self.MIN_REQUEST_INTERVAL:
                cached = self.cache.get(f"snap:{device_id}")
                if cached is not None:
                    logger.debug(f"[Cache Hit] Returning cached snapshot for {device_id} (rate window)")
                    future.set_result(cached)
                    return cached
                # No cache yet — allow through even if within window (first request)

            self._last_request_times[channel_id] = time.time()

            # 3. Construct Chunk Fetch URL — cap to 50 results max
            url = f"{self.BASE_URL}/channels/{channel_id}/feeds.json"
            params: Dict[str, Any] = {"results": 1}
            if read_key:
                params["api_key"] = read_key

            if last_fetched_at:
                ts_str = last_fetched_at.strftime('%Y-%m-%d %H:%M:%S')
                params["start"] = ts_str
                params["results"] = 50  # Phase 3: cap incremental chunk size

            logger.info(f"[ThingSpeak Fetch] Channel {channel_id} | Since: {last_fetched_at}")

            data = await self._safe_fetch_with_backoff(url, params, channel_id=channel_id)

            # 4. Write to cache on success (Phase 7)
            if data:
                self.cache.set(f"snap:{device_id}", data, expire=self.CACHE_TTL)

            future.set_result(data)
            return data

        except Exception as e:
            logger.error(f"[ThingSpeak Fetch Failed] Device {device_id}: {e}")
            if not future.done():
                future.set_result(None)
            return None

        finally:
            self._active_fetches.pop(device_id, None)

    async def get_history(self, channel_id: str, read_key: Optional[str] = None, results: int = 100) -> Dict[str, Any]:
        """Fetch historical data. Standard proxy bypass."""
        url = f"{self.BASE_URL}/channels/{channel_id}/feeds.json"
        params = {"results": min(results, 8000)}
        if read_key:
            params["api_key"] = read_key
        data = await self._safe_fetch_with_backoff(url, params, channel_id=channel_id)
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

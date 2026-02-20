"""
ThingSpeak Telemetry Service - Phase 3 Refactored
=================================================

Optimizations:
- Circuit breaker pattern (5 failures = 60s cooldown)
- Token bucket rate limiting (4 requests/min ThingSpeak limit)
- Caching layer (60s TTL for latest readings)
- Credential encryption/decryption
- Retry logic with exponential backoff
- Comprehensive error handling
- Backward compatible API contracts
"""

import httpx
import asyncio
from typing import Dict, Any, List, Optional
from app.services.telemetry.base import BaseTelemetryService
from app.core.config import get_settings
from app.core.service_base import ExternalAPIService, CachedService
from app.core.rate_limiter import TokenBucketRateLimiter
from app.services.security import EncryptionService

settings = get_settings()


class ThingSpeakTelemetryService(BaseTelemetryService, ExternalAPIService, CachedService):
    """
    ThingSpeak implementation with Phase 3 optimizations.
    
    Features:
    - Rate limiting: 4 requests/min (ThingSpeak limit)
    - Circuit breaker: Opens after 5 failures, recovers after 60s
    - Caching: 60s TTL for latest readings
    - Encryption: API keys encrypted at rest
    - Retry: Exponential backoff (1s, 2s, 4s)
    """
    
    BASE_URL = "https://api.thingspeak.com"
    
    def __init__(self, cache_client=None):
        ExternalAPIService.__init__(self)
        CachedService.__init__(self, cache_client=cache_client)
        
        # ThingSpeak rate limit: 4 requests/minute (per channel)
        # Using token bucket: capacity=4, refill_rate=4/60 tokens/sec
        self.rate_limiter = TokenBucketRateLimiter(
            capacity=4,
            refill_rate=4.0 / 60.0  # ~0.0667 tokens/sec
        )
        
        # Circuit breaker config
        self.failure_threshold = 5
        self.recovery_timeout_seconds = 60
    
    async def fetch_latest(
        self,
        node_id: str,
        config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Fetch latest reading from ThingSpeak Channel.
        
        PHASE 3: Now with caching, rate limiting, and circuit breaker.
        
        Args:
            node_id: Unique node identifier
            config: {
                'channel_id': str,
                'read_key': str (encrypted),
                'field_mapping': Dict[str, str]
            }
            
        Returns:
            Normalized reading dict with timestamp and field values
            Empty dict on error (maintains backward compatibility)
        """
        # 1. Try cache first (60s TTL)
        cache_key = f"thingspeak:latest:{node_id}"
        cached = await self.get_or_compute(
            cache_key,
            lambda: self._fetch_latest_from_api(node_id, config),
            ttl=60
        )
        
        if cached:
            return cached
        
        # Fallback if cache fails
        return await self._fetch_latest_from_api(node_id, config)
    
    async def _fetch_latest_from_api(
        self,
        node_id: str,
        config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Internal method to fetch from API with rate limiting and circuit breaker.
        """
        channel_id = config.get("channel_id")
        read_key = config.get("read_key")
        mapping = config.get("field_mapping", {})
        
        if not channel_id:
            self.log_error("fetch_latest", ValueError("Missing channel_id"))
            return {}
        
        # Decrypt API key if encrypted
        if read_key and isinstance(read_key, str):
            try:
                read_key = EncryptionService.decrypt(read_key)
            except Exception as e:
                self.log_error("decrypt_api_key", e, node_id=node_id)
                # Try using key as-is (might be plain text in dev)
        
        # 2. Check circuit breaker
        if not self.should_attempt_request():
            self.log_operation(
                "circuit_breaker_open",
                node_id=node_id,
                action="skipped_request"
            )
            return {}
        
        # 3. Rate limiting - wait if needed
        wait_time = self.rate_limiter.get_wait_time()
        if wait_time > 0:
            self.log_operation(
                "rate_limit_wait",
                node_id=node_id,
                wait_seconds=round(wait_time, 2)
            )
            await asyncio.sleep(wait_time)
        
        # 4. Consume token
        if not self.rate_limiter.consume():
            self.log_operation(
                "rate_limited",
                node_id=node_id,
                action="request_dropped"
            )
            return {}
        
        # 5. Make API request with retry
        url = f"{self.BASE_URL}/channels/{channel_id}/feeds.json"
        params = {
            "api_key": read_key,
            "results": 1
        }
        
        try:
            result = await self.execute_with_retry(
                self._make_request,
                url,
                params,
                max_retries=3,
                initial_delay=1.0
            )
            
            if not result:
                return {}
            
            feeds = result.get("feeds", [])
            if not feeds:
                return {}
            
            # 6. Normalize and return
            latest = feeds[0]
            normalized = self._normalize_reading(latest, mapping)
            
            self.record_success()
            self.log_operation(
                "fetch_latest_success",
                node_id=node_id,
                channel_id=channel_id
            )
            
            return normalized
            
        except Exception as e:
            self.record_failure()
            self.log_error("fetch_latest", e, node_id=node_id, channel_id=channel_id)
            return {}
    
    async def _make_request(
        self,
        url: str,
        params: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Make HTTP request to ThingSpeak API.
        Raises exception on failure (for retry logic).
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=5.0)
            response.raise_for_status()
            return response.json()
    
    async def fetch_history(
        self,
        node_id: str,
        config: Dict[str, Any],
        days: int = 1
    ) -> List[Dict[str, Any]]:
        """
        Fetch historical data from ThingSpeak.
        
        PHASE 3: Now with rate limiting and circuit breaker.
        
        Args:
            node_id: Unique node identifier
            config: ThingSpeak configuration
            days: Number of days of history (default: 1)
            
        Returns:
            List of normalized readings (empty list on error)
        """
        channel_id = config.get("channel_id")
        read_key = config.get("read_key")
        mapping = config.get("field_mapping", {})
        
        if not channel_id:
            return []
        
        # Decrypt API key
        if read_key and isinstance(read_key, str):
            try:
                read_key = EncryptionService.decrypt(read_key)
            except Exception:
                pass  # Try plain text
        
        # Check circuit breaker
        if not self.should_attempt_request():
            return []
        
        # Rate limiting
        wait_time = self.rate_limiter.get_wait_time()
        if wait_time > 0:
            await asyncio.sleep(wait_time)
        
        if not self.rate_limiter.consume():
            return []
        
        # Make request
        url = f"{self.BASE_URL}/channels/{channel_id}/feeds.json"
        params = {
            "api_key": read_key,
            "days": days
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params, timeout=10.0)
                response.raise_for_status()
                data = response.json()
                
                feeds = data.get("feeds", [])
                normalized = [self._normalize_reading(f, mapping) for f in feeds]
                
                self.record_success()
                self.log_operation(
                    "fetch_history_success",
                    node_id=node_id,
                    count=len(normalized)
                )
                
                return normalized
                
        except Exception as e:
            self.record_failure()
            self.log_error("fetch_history", e, node_id=node_id)
            return []
    
    def _normalize_reading(
        self,
        raw: Dict[str, Any],
        mapping: Dict[str, str]
    ) -> Dict[str, Any]:
        """
        Convert ThingSpeak field1..N to named keys based on field_mapping.
        
        MAINTAINED: Same normalization logic as Phase 1 (backward compatible).
        
        Args:
            raw: Raw ThingSpeak feed entry
            mapping: Field mapping {"field1": "water_level", ...}
            
        Returns:
            Normalized reading dict
        """
        normalized = {
            "timestamp": raw.get("created_at"),
            "entry_id": raw.get("entry_id")
        }
        
        # Apply mapping: {"field1": "depth"} -> normalized["depth"] = raw["field1"]
        for ts_field, alias in mapping.items():
            if ts_field in raw:
                try:
                    val = raw[ts_field]
                    # Convert to numeric if possible
                    if val is not None and isinstance(val, str):
                        if '.' in val:
                            val = float(val)
                        else:
                            val = int(val)
                    normalized[alias] = val
                except ValueError:
                    normalized[alias] = raw[ts_field]
        
        # Fallback: include raw fields if no mapping
        if not mapping:
            for i in range(1, 9):
                key = f"field{i}"
                if key in raw:
                    normalized[key] = raw[key]
        
        return normalized
    
    async def push_reading(
        self,
        device_id: str,
        data: Dict[str, Any]
    ) -> bool:
        """
        Push a reading to ThingSpeak.
        
        NOT IMPLEMENTED: ThingSpeak is pull-based in our architecture.
        Method exists to satisfy abstract base class.
        
        Returns:
            True (no-op for backward compatibility)
        """
        self.log_operation(
            "push_reading_skipped",
            device_id=device_id,
            reason="thingspeak_is_pull_based"
        )
        return True
    
    async def verify_channel(
        self,
        channel_id: str,
        read_api_key: Optional[str] = None
    ) -> bool:
        """
        Verify ThingSpeak channel accessibility.
        
        PHASE 3: Now with rate limiting and better error handling.
        
        Args:
            channel_id: ThingSpeak channel ID
            read_api_key: Read API key (optional, may be encrypted)
            
        Returns:
            True if channel accessible, False otherwise
        """
        # Decrypt key if needed
        if read_api_key and isinstance(read_api_key, str):
            try:
                read_api_key = EncryptionService.decrypt(read_api_key)
            except Exception:
                pass  # Try plain text
        
        # Check circuit breaker
        if not self.should_attempt_request():
            return False
        
        # Rate limiting
        if not self.rate_limiter.consume():
            return False
        
        # Make request
        url = f"{self.BASE_URL}/channels/{channel_id}/feeds.json"
        params = {"results": 1}
        if read_api_key:
            params["api_key"] = read_api_key
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params, timeout=5.0)
                success = response.status_code == 200
                
                if success:
                    self.record_success()
                else:
                    self.record_failure()
                
                return success
                
        except Exception as e:
            self.record_failure()
            self.log_error("verify_channel", e, channel_id=channel_id)
            return False
    
    def get_rate_limit_status(self) -> Dict[str, Any]:
        """
        Get current rate limiter status (for monitoring).
        
        Returns:
            Status dict with tokens available and wait time
        """
        return {
            "tokens_available": round(self.rate_limiter.tokens, 2),
            "capacity": self.rate_limiter.capacity,
            "wait_time_seconds": round(self.rate_limiter.get_wait_time(), 2),
            "circuit_open": self.circuit_open,
            "failure_count": self.failure_count
        }


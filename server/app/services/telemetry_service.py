"""
Telemetry Service Facade
========================

PHASE 3: Refactored to use optimized ThingSpeakTelemetryService
with rate limiting, circuit breaker, and caching.

Maintains backward compatibility with existing API contracts.
"""

import httpx
from typing import Optional
from app.services.telemetry.thingspeak import ThingSpeakTelemetryService


class TelemetryService:
    """
    Facade for telemetry operations.
    
    PHASE 3: Now delegates to optimized ThingSpeakTelemetryService.
    """
    
    # Shared service instance (singleton pattern for rate limiter)
    _thingspeak_service = None
    
    @classmethod
    def _get_thingspeak_service(cls) -> ThingSpeakTelemetryService:
        """Get or create shared ThingSpeak service instance."""
        if cls._thingspeak_service is None:
            from app.core.cache import memory_cache
            cls._thingspeak_service = ThingSpeakTelemetryService(
                cache_client=memory_cache
            )
        return cls._thingspeak_service
    
    @staticmethod
    async def verify_thingspeak_channel(
        channel_id: str,
        read_api_key: Optional[str] = None
    ) -> bool:
        """
        Verifies if a ThingSpeak channel exists and is accessible.
        
        PHASE 3: Now uses optimized service with rate limiting and circuit breaker.
        MAINTAINED: Same API signature for backward compatibility.
        
        Args:
            channel_id: ThingSpeak channel ID
            read_api_key: Read API key (optional, may be encrypted)
            
        Returns:
            True if channel accessible, False otherwise
        """
        service = TelemetryService._get_thingspeak_service()
        return await service.verify_channel(channel_id, read_api_key)

    @staticmethod
    def validate_coordinates(lat: float, lng: float) -> bool:
        """
        Basic GeoJSON compatible coordinate validation.
        
        MAINTAINED: No changes (doesn't interact with ThingSpeak).
        """
        if lat < -90 or lat > 90:
            return False
        if lng < -180 or lng > 180:
            return False
        return True


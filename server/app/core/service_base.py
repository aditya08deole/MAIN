"""
Base classes for service layer to ensure consistency and maintainability.
All services should inherit from these base classes.
"""
from abc import ABC, abstractmethod
from typing import Generic, TypeVar, Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.logging import setup_logging

logger = setup_logging()

T = TypeVar('T')


class BaseService(ABC):
    """
    Abstract base class for all services.
    Provides common logging and error handling patterns.
    """
    
    def __init__(self):
        self.logger = logger
    
    def log_operation(self, operation: str, **kwargs):
        """Log service operation with context."""
        context = " ".join([f"{k}={v}" for k, v in kwargs.items()])
        self.logger.info(f"{self.__class__.__name__}.{operation}: {context}")
    
    def log_error(self, operation: str, error: Exception, **kwargs):
        """Log service error with context."""
        context = " ".join([f"{k}={v}" for k, v in kwargs.items()])
        self.logger.error(
            f"{self.__class__.__name__}.{operation} FAILED: {str(error)}"
,            extra={"context": context, "error_type": type(error).__name__}
        )


class DatabaseService(BaseService):
    """
    Base class for services that interact with database.
    Provides database session management and common query patterns.
    """
    
    def __init__(self, db: AsyncSession):
        super().__init__()
        self.db = db
    
    async def execute_with_retry(self, query, max_retries: int = 3):
        """
        Execute query with retry logic for transient failures.
        """
        import asyncio
        
        for attempt in range(max_retries):
            try:
                result = await self.db.execute(query)
                return result
            except Exception as e:
                if attempt < max_retries - 1:
                    wait_time = 0.1 * (2 ** attempt)  # Exponential backoff
                    await asyncio.sleep(wait_time)
                    continue
                raise e


class CachedService(BaseService):
    """
    Base class for services that use caching.
    Provides standardized cache key generation and cache operations.
    """
    
    def __init__(self, cache_client=None):
        super().__init__()
        self.cache = cache_client
    
    def generate_cache_key(self, prefix: str, *args, **kwargs) -> str:
        """
        Generate consistent cache key from prefix and parameters.
        """
        parts = [prefix]
        parts.extend([str(arg) for arg in args])
        parts.extend([f"{k}:{v}" for k, v in sorted(kwargs.items())])
        return ":".join(parts)
    
    async def get_or_compute(
        self,
        cache_key: str,
        compute_fn,
        ttl: int = 300
    ) -> Any:
        """
        Get from cache or compute and cache the result.
        """
        if self.cache:
            cached = await self.cache.get(cache_key)
            if cached is not None:
                self.log_operation("cache_hit", key=cache_key)
                return cached
        
        # Compute result
        result = await compute_fn()
        
        # Cache result
        if self.cache:
            await self.cache.set(cache_key, result, ttl=ttl)
            self.log_operation("cache_set", key=cache_key, ttl=ttl)
        
        return result
    
    async def invalidate_pattern(self, pattern: str):
        """
        Invalidate all cache keys matching pattern.
        """
        if self.cache:
            await self.cache.invalidate_pattern(pattern)
            self.log_operation("cache_invalidate", pattern=pattern)


class ExternalAPIService(BaseService):
    """
    Base class for services that interact with external APIs.
    Provides circuit breaker, retry logic, and timeout handling.
    """
    
    def __init__(self):
        super().__init__()
        self.circuit_open = False
        self.failure_count = 0
        self.failure_threshold = 5
        self.recovery_timeout_seconds = 60
        self.last_failure_time = None
    
    def should_attempt_request(self) -> bool:
        """
        Check if circuit breaker allows request.
        """
        if not self.circuit_open:
            return True
        
        # Check if recovery timeout elapsed
        import time
        if time.time() - self.last_failure_time > self.recovery_timeout_seconds:
            self.circuit_open = False
            self.failure_count = 0
            self.log_operation("circuit_recovered")
            return True
        
        return False
    
    def record_success(self):
        """Record successful request."""
        self.failure_count = max(0, self.failure_count - 1)
    
    def record_failure(self):
        """Record failed request and potentially open circuit."""
        import time
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.failure_count >= self.failure_threshold:
            self.circuit_open = True
            self.log_operation(
                "circuit_opened",
                failure_count=self.failure_count,
                threshold=self.failure_threshold
            )
    
    async def execute_with_circuit_breaker(
        self,
        api_call,
        fallback_value=None
    ) -> Any:
        """
        Execute API call with circuit breaker protection.
        """
        if not self.should_attempt_request():
            self.log_operation("circuit_blocked")
            return fallback_value
        
        try:
            result = await api_call()
            self.record_success()
            return result
        except Exception as e:
            self.record_failure()
            self.log_error("api_call", e)
            return fallback_value


class TelemetryServiceBase(DatabaseService, CachedService):
    """
    Base class for telemetry-related services.
    Combines database and cache capabilities.
    """
    
    def __init__(self, db: AsyncSession, cache_client=None):
        DatabaseService.__init__(self, db)
        CachedService.__init__(self, cache_client)
    
    async def store_reading(
        self,
        device_id: str,
        readings: Dict[str, Any]
    ):
        """
        Store telemetry reading to database.
        Subclasses should implement specific storage logic.
        """
        raise NotImplementedError("Subclass must implement store_reading")
    
    async def get_latest_reading(
        self,
        device_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get latest telemetry reading for device.
        Subclasses should implement specific retrieval logic.
        """
        raise NotImplementedError("Subclass must implement get_latest_reading")

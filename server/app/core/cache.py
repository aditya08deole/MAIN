import time
import asyncio
import json
from typing import Any, Optional, Dict, Tuple
from abc import ABC, abstractmethod


class CacheBackend(ABC):
    """Abstract base class for cache backends."""
    
    @abstractmethod
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        pass
    
    @abstractmethod
    async def set(self, key: str, value: Any, ttl: int = 60):
        """Set value in cache with TTL."""
        pass
    
    @abstractmethod
    async def delete(self, key: str):
        """Delete a specific key."""
        pass
    
    @abstractmethod
    async def invalidate(self, key_pattern: str):
        """Remove all keys matching the pattern."""
        pass
    
    @abstractmethod
    async def clear(self):
        """Clear all cache."""
        pass


class AsyncTTLCache(CacheBackend):
    """
    A simple in-memory cache with Time-To-Live (TTL) support.
    Designed for async context to avoid blocking.
    """
    def __init__(self):
        self._cache: Dict[str, Tuple[Any, float]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Optional[Any]:
        """Retrieve a value if it exists and hasn't expired."""
        async with self._lock:
            if key in self._cache:
                value, expiry = self._cache[key]
                if time.time() < expiry:
                    return value
                else:
                    del self._cache[key] # Lazy expiration
        return None

    async def set(self, key: str, value: Any, ttl: int = 60):
        """Set a value with a TTL in seconds."""
        async with self._lock:
            expiry = time.time() + ttl
            self._cache[key] = (value, expiry)

    async def delete(self, key: str):
        """Delete a specific key."""
        async with self._lock:
            if key in self._cache:
                del self._cache[key]

    async def invalidate(self, key_pattern: str):
        """Invalidate keys matching a prefix (simple implementation)."""
        async with self._lock:
            keys_to_delete = [k for k in self._cache.keys() if k.startswith(key_pattern)]
            for k in keys_to_delete:
                del self._cache[k]

    async def clear(self):
        """Clear entire cache."""
        async with self._lock:
            self._cache.clear()


class RedisCacheBackend(CacheBackend):
    """
    Redis-based distributed cache backend.
    
    Benefits:
    - Distributed caching across multiple processes/servers
    - Persistent cache (survives restarts)
    - Built-in TTL support with automatic expiration
    - Atomic operations
    - Connection pooling for high concurrency
    
    Usage:
        redis_cache = RedisCacheBackend(redis_url="redis://localhost:6379/0")
        await redis_cache.set("key", {"data": "value"}, ttl=300)
        value = await redis_cache.get("key")
    """
    
    def __init__(self, redis_url: str = "redis://localhost:6379/0", max_connections: int = 50):
        self.redis_url = redis_url
        self.max_connections = max_connections
        self._redis = None
        self._lock = asyncio.Lock()
    
    async def _get_redis(self):
        """Lazy initialization of Redis connection pool."""
        if self._redis is None:
            async with self._lock:
                if self._redis is None:  # Double-check locking
                    try:
                        import redis.asyncio as aioredis
                        self._redis = aioredis.from_url(
                            self.redis_url,
                            encoding="utf-8",
                            decode_responses=True,
                            max_connections=self.max_connections
                        )
                        # Test connection
                        await self._redis.ping()
                        print(f"✅ Redis cache connected: {self.redis_url}")
                    except ImportError:
                        print("⚠️  redis[asyncio] not installed. Install with: pip install redis[asyncio]")
                        raise
                    except Exception as e:
                        print(f"⚠️  Redis connection failed: {e}. Falling back to memory cache.")
                        raise
        return self._redis
    
    def _serialize(self, value: Any) -> str:
        """Serialize value to JSON string."""
        return json.dumps(value, default=str)
    
    def _deserialize(self, value: str) -> Any:
        """Deserialize JSON string to value."""
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return value
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from Redis cache."""
        try:
            redis = await self._get_redis()
            value = await redis.get(key)
            if value is not None:
                return self._deserialize(value)
            return None
        except Exception as e:
            print(f"Redis GET error for key '{key}': {e}")
            return None
    
    async def set(self, key: str, value: Any, ttl: int = 60):
        """Set value in Redis cache with TTL in seconds."""
        try:
            redis = await self._get_redis()
            serialized = self._serialize(value)
            await redis.setex(key, ttl, serialized)
        except Exception as e:
            print(f"Redis SET error for key '{key}': {e}")
    
    async def delete(self, key: str):
        """Delete a specific key from Redis."""
        try:
            redis = await self._get_redis()
            await redis.delete(key)
        except Exception as e:
            print(f"Redis DELETE error for key '{key}': {e}")
    
    async def invalidate(self, key_pattern: str):
        """
        Remove all keys matching the pattern.
        Uses SCAN for efficient pattern matching (non-blocking).
        """
        try:
            redis = await self._get_redis()
            # Use SCAN for safe iteration over large keyspaces
            cursor = 0
            while True:
                cursor, keys = await redis.scan(cursor, match=f"{key_pattern}*", count=100)
                if keys:
                    await redis.delete(*keys)
                if cursor == 0:
                    break
        except Exception as e:
            print(f"Redis INVALIDATE error for pattern '{key_pattern}': {e}")
    
    async def clear(self):
        """Clear all cache (use with caution in production!)."""
        try:
            redis = await self._get_redis()
            await redis.flushdb()
        except Exception as e:
            print(f"Redis CLEAR error: {e}")
    
    async def close(self):
        """Close Redis connection pool."""
        if self._redis:
            await self._redis.close()


async def create_cache_backend() -> CacheBackend:
    """
    Factory function to create the appropriate cache backend.
    
    Tries Redis first if configured, falls back to in-memory cache if Redis is unavailable.
    Configure via environment variables:
    - USE_REDIS_CACHE=true/false
    - REDIS_URL=redis://localhost:6379/0
    """
    from app.core.config import settings
    
    # Check if Redis is configured
    redis_url = getattr(settings, "REDIS_URL", None) or "redis://localhost:6379/0"
    use_redis = getattr(settings, "USE_REDIS_CACHE", False)
    
    if use_redis:
        try:
            redis_backend = RedisCacheBackend(redis_url=redis_url)
            # Test connection
            await redis_backend._get_redis()
            print("✅ Using Redis distributed cache")
            return redis_backend
        except Exception as e:
            print(f"⚠️  Redis unavailable, falling back to memory cache: {e}")
    
    print("✅ Using in-memory cache")
    return AsyncTTLCache()


# Global Cache Instance
memory_cache: CacheBackend = AsyncTTLCache()

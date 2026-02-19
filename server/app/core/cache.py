import time
import asyncio
from typing import Any, Optional, Dict, Tuple

class AsyncTTLCache:
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

# Global Cache Instance
memory_cache = AsyncTTLCache()

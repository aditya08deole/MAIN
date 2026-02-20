"""
Production-grade middleware for request handling, logging, and rate limiting.
Follows SOLID principles with single responsibility per middleware class.
"""
from typing import Callable, Dict, List
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from collections import defaultdict
from datetime import datetime, timedelta
import time
from app.core.logging import setup_logging

logger = setup_logging()


class BaseMiddleware:
    """Abstract base for all middleware implementations."""
    
    async def __call__(self, request: Request, call_next: Callable) -> Response:
        """Process request and return response."""
        raise NotImplementedError("Middleware must implement __call__")


class RequestLoggingMiddleware(BaseMiddleware):
    """
    Handles structured request/response logging with performance metrics.
    Single Responsibility: Logging only.
    """
    
    def __init__(self, log_auth_header: bool = False, log_body: bool = False):
        self.log_auth_header = log_auth_header
        self.log_body = log_body
    
    async def __call__(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        
        # Extract request metadata
        method = request.method
        path = request.url.path
        client_ip = request.client.host if request.client else "unknown"
        
        # Optional auth logging (sanitized)
        auth_info = "No Auth"
        if self.log_auth_header and "Authorization" in request.headers:
            auth_header = request.headers["Authorization"]
            auth_info = f"{auth_header[:20]}..." if len(auth_header) > 20 else auth_header
        
        # Process request
        response = await call_next(request)
        
        # Calculate metrics
        process_time_ms = round((time.time() - start_time) * 1000, 2)
        
        # Structured logging
        log_data = {
            "method": method,
            "path": path,
            "client_ip": client_ip,
            "status_code": response.status_code,
            "process_time_ms": process_time_ms
        }
        
        if self.log_auth_header:
            log_data["auth"] = auth_info
        
        # Log with appropriate level
        if response.status_code >= 500:
            logger.error(f"REQUEST FAILED", extra=log_data)
        elif response.status_code >= 400:
            logger.warning(f"REQUEST ERROR", extra=log_data)
        else:
            logger.info(f"REQUEST OK", extra=log_data)
        
        return response


class TokenBucketRateLimiter:
    """
    Token bucket algorithm implementation for rate limiting.
    Provides smooth rate limiting with burst capacity.
    
    Algorithm: O(1) time complexity for rate check
    """
    
    def __init__(self, capacity: int, refill_rate: float):
        """
        Initialize token bucket.
        
        Args:
            capacity: Maximum tokens (burst capacity)
            refill_rate: Tokens per second refill rate
        """
        self.capacity = capacity
        self.refill_rate = refill_rate
        self.buckets: Dict[str, Dict] = {}
    
    def _refill_bucket(self, bucket: Dict) -> None:
        """Refill tokens based on elapsed time."""
        now = time.time()
        elapsed = now - bucket["last_refill"]
        tokens_to_add = elapsed * self.refill_rate
        
        bucket["tokens"] = min(
            self.capacity,
            bucket["tokens"] + tokens_to_add
        )
        bucket["last_refill"] = now
    
    def is_allowed(self, identity: str) -> bool:
        """
        Check if request is allowed under rate limit.
        
        Args:
            identity: Unique identifier (IP, user ID, API key)
        
        Returns:
            True if request allowed, False if rate limited
        """
        now = time.time()
        
        # Initialize bucket if new identity
        if identity not in self.buckets:
            self.buckets[identity] = {
                "tokens": self.capacity,
                "last_refill": now
            }
        
        bucket = self.buckets[identity]
        self._refill_bucket(bucket)
        
        # Consume token if available
        if bucket["tokens"] >= 1:
            bucket["tokens"] -= 1
            return True
        
        return False
    
    def cleanup_stale_buckets(self, max_age_seconds: int = 3600) -> None:
        """Remove buckets not accessed recently to prevent memory leak."""
        now = time.time()
        stale_identities = [
            identity for identity, bucket in self.buckets.items()
            if now - bucket["last_refill"] > max_age_seconds
        ]
        for identity in stale_identities:
            del self.buckets[identity]


class RateLimitMiddleware(BaseMiddleware):
    """
    Rate limiting middleware with configurable limits per path pattern.
    Uses token bucket algorithm for smooth rate limiting.
    """
    
    def __init__(self, rate_limits: Dict[str, Dict[str, int]] = None):
        """
        Initialize rate limiter with path-specific limits.
        
        Args:
            rate_limits: Dict mapping path patterns to limits
                Example: {
                    "/api/v1/admin": {"requests_per_minute": 30},
                    "/api/v1/auth": {"requests_per_minute": 20}
                }
        """
        self.rate_limits = rate_limits or {}
        self.limiters: Dict[str, TokenBucketRateLimiter] = {}
        
        # Create limiters for each path pattern
        for path_pattern, config in self.rate_limits.items():
            rpm = config.get("requests_per_minute", 60)
            capacity = config.get("burst_capacity", rpm)
            refill_rate = rpm / 60.0  # Convert to per-second rate
            
            self.limiters[path_pattern] = TokenBucketRateLimiter(
                capacity=capacity,
                refill_rate=refill_rate
            )
    
    def _get_limiter_for_path(self, path: str) -> tuple[TokenBucketRateLimiter, str] | None:
        """Find matching limiter for request path."""
        for pattern, limiter in self.limiters.items():
            if path.startswith(pattern):
                return limiter, pattern
        return None
    
    async def __call__(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        
        # Check if path requires rate limiting
        limiter_info = self._get_limiter_for_path(path)
        
        if limiter_info:
            limiter, pattern = limiter_info
            client_ip = request.client.host if request.client else "unknown"
            
            if not limiter.is_allowed(client_ip):
                logger.warning(
                    f"RATE LIMIT EXCEEDED",
                    extra={
                        "path": path,
                        "pattern": pattern,
                        "client_ip": client_ip
                    }
                )
                return JSONResponse(
                    status_code=429,
                    content={
                        "status": "error",
                        "message": "Rate limit exceeded. Please try again later.",
                        "retry_after_seconds": 60
                    }
                )
        
        return await call_next(request)


class HealthCheckService:
    """
    Centralized health check execution service.
    Single Responsibility: System health validation.
    """
    
    def __init__(self):
        self.last_check_time: float = 0
        self.cached_results: Dict = {}
        self.cache_ttl: int = 30  # Cache health results for 30 seconds
    
    async def run_all_checks(self, force: bool = False) -> Dict[str, str]:
        """
        Run all system health checks with caching.
        
        Args:
            force: Force fresh checks ignoring cache
        
        Returns:
            Dict mapping check names to status strings
        """
        now = time.time()
        
        # Return cached results if recent
        if not force and (now - self.last_check_time) < self.cache_ttl:
            return self.cached_results
        
        checks = {}
        
        # Database connectivity check
        checks["database"] = await self._check_database()
        
        # Environment variables check
        checks["env_vars"] = await self._check_environment()
        
        # Supabase connectivity
        checks["supabase_auth"] = await self._check_supabase()
        
        # ThingSpeak API (non-critical)
        checks["thingspeak"] = await self._check_thingspeak()
        
        # Cache results
        self.cached_results = checks
        self.last_check_time = now
        
        return checks
    
    async def _check_database(self) -> str:
        """Check database connectivity and latency."""
        try:
            from app.db.session import engine
            from sqlalchemy import text
            
            start = time.time()
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            latency_ms = round((time.time() - start) * 1000, 1)
            
            return f"[OK] Connected (latency: {latency_ms}ms)"
        except Exception as e:
            return f"[ERROR] {str(e)}"
    
    async def _check_environment(self) -> str:
        """Verify required environment variables."""
        from app.core.config import get_settings
        
        settings = get_settings()
        required_vars = ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_JWT_SECRET"]
        
        missing = []
        for var in required_vars:
            # Check both lowercase and uppercase versions
            if not getattr(settings, var, None) and not getattr(settings, var.lower(), None):
                missing.append(var)
        
        if missing:
            return f"[WARN] Missing: {', '.join(missing)}"
        return "[OK] All present"
    
    async def _check_supabase(self) -> str:
        """Check Supabase API reachability."""
        try:
            from app.core.config import get_settings
            import httpx
            
            settings = get_settings()
            async with httpx.AsyncClient(timeout=3) as client:
                resp = await client.get(f"{settings.SUPABASE_URL}/auth/v1/settings")
                return f"[OK] Reachable (HTTP {resp.status_code})"
        except Exception as e:
            return f"[WARN] Unreachable: {str(e)}"
    
    async def _check_thingspeak(self) -> str:
        """Check ThingSpeak API reachability (non-critical)."""
        try:
            import httpx
            
            async with httpx.AsyncClient(timeout=3) as client:
                resp = await client.get("https://api.thingspeak.com/channels/public.json?page=1")
                return f"[OK] Reachable (HTTP {resp.status_code})"
        except Exception as e:
            return f"[WARN] Unreachable (non-critical): {str(e)}"


# Middleware factory functions for FastAPI integration
def create_request_logging_middleware(log_auth: bool = False) -> RequestLoggingMiddleware:
    """Factory for request logging middleware."""
    return RequestLoggingMiddleware(log_auth_header=log_auth)


def create_rate_limit_middleware(config: Dict = None) -> RateLimitMiddleware:
    """Factory for rate limiting middleware."""
    default_config = {
        "/api/v1/admin": {"requests_per_minute": 30, "burst_capacity": 50},
        "/api/v1/auth": {"requests_per_minute": 20, "burst_capacity": 30}
    }
    return RateLimitMiddleware(rate_limits=config or default_config)

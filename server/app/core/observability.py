"""
Phase 6: Observability & Reliability Module

Implements:
1. Structured Logging with correlation IDs
2. Application Metrics (Prometheus-compatible)
3. Health Checks with dependency validation
4. SLO/SLI Tracking
5. Error Rate Monitoring
6. Performance Metrics
"""

import time
import logging
import json
from typing import Dict, List, Optional, Callable
from datetime import datetime, timedelta
from collections import defaultdict, deque
from dataclasses import dataclass, asdict
from enum import Enum
import uuid
from fastapi import Request
from contextvars import ContextVar

# Context variable for correlation ID
correlation_id_var: ContextVar[str] = ContextVar("correlation_id", default="")


class LogLevel(Enum):
    """Log severity levels."""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


@dataclass
class StructuredLog:
    """Structured log entry."""
    timestamp: str
    level: str
    correlation_id: str
    service: str
    message: str
    metadata: Dict
    error: Optional[Dict] = None


class StructuredLogger:
    """
    Structured logger with correlation ID support.
    
    Usage:
        logger = StructuredLogger("api_service")
        logger.info("User logged in", user_id="123", ip="1.2.3.4")
        logger.error("Database error", error=exception, query="SELECT...")
    """
    
    def __init__(self, service_name: str):
        self.service_name = service_name
        self.logger = logging.getLogger(service_name)
    
    def _log(self, level: LogLevel, message: str, **metadata):
        """Internal logging method."""
        correlation_id = correlation_id_var.get() or str(uuid.uuid4())
        
        log_entry = StructuredLog(
            timestamp=datetime.utcnow().isoformat(),
            level=level.value,
            correlation_id=correlation_id,
            service=self.service_name,
            message=message,
            metadata=metadata
        )
        
        # Log as JSON
        log_json = json.dumps(asdict(log_entry))
        
        if level == LogLevel.ERROR or level == LogLevel.CRITICAL:
            self.logger.error(log_json)
        elif level == LogLevel.WARNING:
            self.logger.warning(log_json)
        elif level == LogLevel.INFO:
            self.logger.info(log_json)
        else:
            self.logger.debug(log_json)
    
    def debug(self, message: str, **metadata):
        """Log debug message."""
        self._log(LogLevel.DEBUG, message, **metadata)
    
    def info(self, message: str, **metadata):
        """Log info message."""
        self._log(LogLevel.INFO, message, **metadata)
    
    def warning(self, message: str, **metadata):
        """Log warning message."""
        self._log(LogLevel.WARNING, message, **metadata)
    
    def error(self, message: str, error: Optional[Exception] = None, **metadata):
        """Log error message with exception details."""
        if error:
            metadata["error"] = {
                "type": type(error).__name__,
                "message": str(error),
                "traceback": str(error.__traceback__) if hasattr(error, "__traceback__") else None
            }
        self._log(LogLevel.ERROR, message, **metadata)
    
    def critical(self, message: str, error: Optional[Exception] = None, **metadata):
        """Log critical message."""
        if error:
            metadata["error"] = {
                "type": type(error).__name__,
                "message": str(error)
            }
        self._log(LogLevel.CRITICAL, message, **metadata)


class MetricsCollector:
    """
    Application metrics collector (Prometheus-compatible).
    
    Tracks:
    - Request counts
    - Response times
    - Error rates
    - Active connections
    - Cache hit rates
    - Database query times
    """
    
    def __init__(self):
        self.request_count = defaultdict(int)
        self.error_count = defaultdict(int)
        self.response_times = defaultdict(list)
        self.active_connections = 0
        self.cache_hits = 0
        self.cache_misses = 0
        self.db_query_times = deque(maxlen=1000)
    
    def record_request(self, method: str, endpoint: str, status_code: int, duration: float):
        """Record HTTP request metrics."""
        key = f"{method}_{endpoint}"
        self.request_count[key] += 1
        self.response_times[key].append(duration)
        
        if status_code >= 400:
            self.error_count[key] += 1
    
    def record_cache_access(self, hit: bool):
        """Record cache access."""
        if hit:
            self.cache_hits += 1
        else:
            self.cache_misses += 1
    
    def record_db_query(self, duration: float):
        """Record database query time."""
        self.db_query_times.append(duration)
    
    def get_cache_hit_rate(self) -> float:
        """Calculate cache hit rate."""
        total = self.cache_hits + self.cache_misses
        if total == 0:
            return 0.0
        return self.cache_hits / total
    
    def get_error_rate(self, endpoint: str) -> float:
        """Calculate error rate for endpoint."""
        key = f"GET_{endpoint}"  # Simplified
        total = self.request_count.get(key, 0)
        errors = self.error_count.get(key, 0)
        
        if total == 0:
            return 0.0
        return errors / total
    
    def get_avg_response_time(self, endpoint: str) -> float:
        """Get average response time for endpoint."""
        key = f"GET_{endpoint}"
        times = self.response_times.get(key, [])
        
        if not times:
            return 0.0
        return sum(times) / len(times)
    
    def get_p95_response_time(self, endpoint: str) -> float:
        """Get P95 response time for endpoint."""
        key = f"GET_{endpoint}"
        times = sorted(self.response_times.get(key, []))
        
        if not times:
            return 0.0
        
        index = int(len(times) * 0.95)
        return times[index] if index < len(times) else times[-1]
    
    def get_metrics_summary(self) -> Dict:
        """Get summary of all metrics."""
        return {
            "total_requests": sum(self.request_count.values()),
            "total_errors": sum(self.error_count.values()),
            "cache_hit_rate": self.get_cache_hit_rate(),
            "active_connections": self.active_connections,
            "avg_db_query_time": sum(self.db_query_times) / len(self.db_query_times) if self.db_query_times else 0.0
        }


class HealthCheck:
    """
    Comprehensive health check system.
    
    Checks:
    - Database connectivity
    - Cache availability
    - External API reachability
    - Disk space
    - Memory usage
    """
    
    def __init__(self):
        self.checks: List[Callable] = []
    
    def register_check(self, name: str, check_func: Callable):
        """Register a health check function."""
        self.checks.append((name, check_func))
    
    async def run_all_checks(self) -> Dict:
        """Run all registered health checks."""
        results = {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "checks": {}
        }
        
        for name, check_func in self.checks:
            try:
                result = await check_func()
                results["checks"][name] = {
                    "status": "healthy" if result else "unhealthy",
                    "details": result
                }
                
                if not result:
                    results["status"] = "degraded"
                    
            except Exception as e:
                results["checks"][name] = {
                    "status": "unhealthy",
                    "error": str(e)
                }
                results["status"] = "unhealthy"
        
        return results


async def check_database_health() -> bool:
    """Check database connectivity."""
    try:
        from app.db.session import AsyncSessionLocal
        async with AsyncSessionLocal() as db:
            await db.execute("SELECT 1")
            return True
    except Exception:
        return False


async def check_cache_health() -> bool:
    """Check cache availability."""
    try:
        from app.core.cache import memory_cache
        await memory_cache.set("health_check", "ok", ttl=5)
        value = await memory_cache.get("health_check")
        return value == "ok"
    except Exception:
        return False


async def check_websocket_health() -> bool:
    """Check WebSocket manager status."""
    try:
        from app.services.websockets import manager
        stats = manager.get_stats()
        return stats["active_connections"] >= 0
    except Exception:
        return False


@dataclass
class SLI:
    """Service Level Indicator."""
    name: str
    target: float
    actual: float
    unit: str
    
    @property
    def met(self) -> bool:
        """Check if SLI target is met."""
        return self.actual <= self.target


@dataclass
class SLO:
    """Service Level Objective."""
    name: str
    description: str
    indicators: List[SLI]
    
    @property
    def compliance_rate(self) -> float:
        """Calculate SLO compliance rate."""
        if not self.indicators:
            return 1.0
        met = sum(1 for sli in self.indicators if sli.met)
        return met / len(self.indicators)


class SLOTracker:
    """
    Track Service Level Objectives.
    
    SLOs:
    - 99.9% uptime
    - < 200ms P95 latency
    - < 1% error rate
    - < 100ms database P95
    """
    
    def __init__(self, metrics: MetricsCollector):
        self.metrics = metrics
    
    def get_current_slos(self) -> List[SLO]:
        """Get current SLO status."""
        return [
            SLO(
                name="API Latency",
                description="95% of API requests complete in < 200ms",
                indicators=[
                    SLI(
                        name="Dashboard P95",
                        target=200.0,
                        actual=self.metrics.get_p95_response_time("/api/v1/dashboard/stats"),
                        unit="ms"
                    )
                ]
            ),
            SLO(
                name="Error Rate",
                description="< 1% error rate across all endpoints",
                indicators=[
                    SLI(
                        name="Dashboard Error Rate",
                        target=0.01,
                        actual=self.metrics.get_error_rate("/api/v1/dashboard/stats"),
                        unit="%"
                    )
                ]
            ),
            SLO(
                name="Cache Efficiency",
                description="> 80% cache hit rate",
                indicators=[
                    SLI(
                        name="Cache Hit Rate",
                        target=0.80,
                        actual=self.metrics.get_cache_hit_rate(),
                        unit="%"
                    )
                ]
            )
        ]
    
    def get_slo_compliance_report(self) -> Dict:
        """Generate SLO compliance report."""
        slos = self.get_current_slos()
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "overall_compliance": sum(slo.compliance_rate for slo in slos) / len(slos) if slos else 1.0,
            "slos": [
                {
                    "name": slo.name,
                    "description": slo.description,
                    "compliance_rate": slo.compliance_rate,
                    "indicators": [
                        {
                            "name": sli.name,
                            "target": sli.target,
                            "actual": sli.actual,
                            "unit": sli.unit,
                            "met": sli.met
                        }
                        for sli in slo.indicators
                    ]
                }
                for slo in slos
            ]
        }


# Global instances
metrics_collector = MetricsCollector()
health_check_system = HealthCheck()
slo_tracker = SLOTracker(metrics_collector)

# Register default health checks
health_check_system.register_check("database", check_database_health)
health_check_system.register_check("cache", check_cache_health)
health_check_system.register_check("websockets", check_websocket_health)


async def observability_middleware(request: Request, call_next):
    """
    Observability middleware for request tracking.
    
    - Sets correlation ID
    - Records metrics
    - Logs requests
    """
    # Generate correlation ID
    correlation_id = str(uuid.uuid4())
    correlation_id_var.set(correlation_id)
    
    # Add to response headers
    request.state.correlation_id = correlation_id
    
    # Record request start
    start_time = time.time()
    
    # Process request
    response = await call_next(request)
    
    # Record metrics
    duration = (time.time() - start_time) * 1000  # Convert to ms
    metrics_collector.record_request(
        method=request.method,
        endpoint=request.url.path,
        status_code=response.status_code,
        duration=duration
    )
    
    # Add correlation ID to response
    response.headers["X-Correlation-ID"] = correlation_id
    
    return response


# Structured logger instances
api_logger = StructuredLogger("api_service")
db_logger = StructuredLogger("database_service")
cache_logger = StructuredLogger("cache_service")

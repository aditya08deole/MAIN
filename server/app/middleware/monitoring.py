"""
Phase 27: Performance Monitoring Middleware
Tracks request latency, error rates, and throughput.
Provides Prometheus-compatible metrics endpoint.
"""
import time
from collections import defaultdict
from typing import Dict, List
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from datetime import datetime, timedelta

class MetricsCollector:
    """
    In-memory metrics collector.
    Tracks request count, latency, error rate per endpoint.
    """
    
    def __init__(self):
        self.request_count: Dict[str, int] = defaultdict(int)
        self.error_count: Dict[str, int] = defaultdict(int)
        self.latency_sum: Dict[str, float] = defaultdict(float)
        self.latency_max: Dict[str, float] = defaultdict(float)
        self.start_time = datetime.utcnow()
    
    def record(self, path: str, status_code: int, latency_ms: float):
        """Record a request metric."""
        key = f"{path}"
        self.request_count[key] += 1
        self.latency_sum[key] += latency_ms
        self.latency_max[key] = max(self.latency_max[key], latency_ms)
        
        if status_code >= 400:
            self.error_count[key] += 1
    
    def get_summary(self) -> dict:
        """Return summary of all metrics."""
        uptime = (datetime.utcnow() - self.start_time).total_seconds()
        total_requests = sum(self.request_count.values())
        total_errors = sum(self.error_count.values())
        
        endpoints = []
        for path in self.request_count:
            count = self.request_count[path]
            avg_latency = self.latency_sum[path] / count if count > 0 else 0
            endpoints.append({
                "path": path,
                "requests": count,
                "errors": self.error_count.get(path, 0),
                "avg_latency_ms": round(avg_latency, 2),
                "max_latency_ms": round(self.latency_max.get(path, 0), 2),
            })
        
        # Sort by request count (most popular first)
        endpoints.sort(key=lambda x: x["requests"], reverse=True)
        
        return {
            "uptime_seconds": round(uptime, 0),
            "total_requests": total_requests,
            "total_errors": total_errors,
            "error_rate": round(total_errors / total_requests * 100, 2) if total_requests > 0 else 0,
            "requests_per_second": round(total_requests / uptime, 2) if uptime > 0 else 0,
            "top_endpoints": endpoints[:10],
        }

# Global metrics instance
metrics = MetricsCollector()


class MetricsMiddleware(BaseHTTPMiddleware):
    """Middleware to automatically track request metrics."""
    
    async def dispatch(self, request: Request, call_next):
        start = time.time()
        
        response = await call_next(request)
        
        latency_ms = (time.time() - start) * 1000
        path = request.url.path
        
        # Don't track health checks or static files
        if not path.startswith("/health") and not path.startswith("/docs"):
            metrics.record(path, response.status_code, latency_ms)
        
        # Add latency header
        response.headers["X-Response-Time"] = f"{latency_ms:.2f}ms"
        
        return response

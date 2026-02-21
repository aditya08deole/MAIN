"""
Performance monitoring utilities for backend
Tracks API response times, database query performance, and resource usage
"""
import time
import asyncio
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from collections import deque
from functools import wraps
import psutil

# ============================================================================
# PERFORMANCE METRICS TRACKER
# ============================================================================

class PerformanceMetrics:
    """
    Track performance metrics in memory.
    Stores recent data points for analysis.
    """
    
    def __init__(self, max_samples: int = 1000):
        self.max_samples = max_samples
        self.api_response_times: deque = deque(maxlen=max_samples)
        self.db_query_times: deque = deque(maxlen=max_samples)
        self.error_counts: Dict[str, int] = {}
        self.endpoint_counts: Dict[str, int] = {}
        
    def record_api_request(self, endpoint: str, duration_ms: float, status_code: int):
        """Record API request metrics."""
        self.api_response_times.append({
            'endpoint': endpoint,
            'duration_ms': duration_ms,
            'status_code': status_code,
            'timestamp': datetime.utcnow().isoformat()
        })
        
        # Count endpoint usage
        self.endpoint_counts[endpoint] = self.endpoint_counts.get(endpoint, 0) + 1
        
        # Count errors
        if status_code >= 400:
            error_key = f"{status_code}"
            self.error_counts[error_key] = self.error_counts.get(error_key, 0) + 1
    
    def record_db_query(self, query_type: str, duration_ms: float):
        """Record database query metrics."""
        self.db_query_times.append({
            'query_type': query_type,
            'duration_ms': duration_ms,
            'timestamp': datetime.utcnow().isoformat()
        })
    
    def get_api_stats(self) -> Dict[str, Any]:
        """Get API performance statistics."""
        if not self.api_response_times:
            return {
                'total_requests': 0,
                'avg_response_time_ms': 0,
                'p50_ms': 0,
                'p95_ms': 0,
                'p99_ms': 0,
                'error_rate': 0
            }
        
        durations = sorted([r['duration_ms'] for r in self.api_response_times])
        total_requests = len(durations)
        error_count = sum(self.error_counts.values())
        
        return {
            'total_requests': total_requests,
            'avg_response_time_ms': round(sum(durations) / len(durations), 2),
            'p50_ms': self._percentile(durations, 50),
            'p95_ms': self._percentile(durations, 95),
            'p99_ms': self._percentile(durations, 99),
            'error_rate': round((error_count / total_requests) * 100, 2) if total_requests > 0 else 0,
            'top_endpoints': self._get_top_endpoints(5)
        }
    
    def get_db_stats(self) -> Dict[str, Any]:
        """Get database performance statistics."""
        if not self.db_query_times:
            return {'total_queries': 0}
        
        durations = sorted([q['duration_ms'] for q in self.db_query_times])
        
        return {
            'total_queries': len(durations),
            'avg_query_time_ms': round(sum(durations) / len(durations), 2),
            'p50_ms': self._percentile(durations, 50),
            'p95_ms': self._percentile(durations, 95),
            'p99_ms': self._percentile(durations, 99)
        }
    
    def get_system_stats(self) -> Dict[str, Any]:
        """Get system resource usage."""
        try:
            cpu_percent = psutil.cpu_percent(interval=0.1)
            memory = psutil.virtual_memory()
            
            return {
                'cpu_percent': round(cpu_percent, 2),
                'memory_used_mb': round(memory.used / 1024 / 1024, 2),
                'memory_percent': round(memory.percent, 2),
                'memory_available_mb': round(memory.available / 1024 / 1024, 2)
            }
        except Exception as e:
            return {'error': str(e)}
    
    def _percentile(self, data: List[float], percentile: int) -> float:
        """Calculate percentile from sorted data."""
        if not data:
            return 0
        index = int(len(data) * (percentile / 100))
        return round(data[min(index, len(data) - 1)], 2)
    
    def _get_top_endpoints(self, limit: int) -> List[Dict[str, Any]]:
        """Get most frequently called endpoints."""
        sorted_endpoints = sorted(
            self.endpoint_counts.items(),
            key=lambda x: x[1],
            reverse=True
        )[:limit]
        
        return [
            {'endpoint': endpoint, 'count': count}
            for endpoint, count in sorted_endpoints
        ]
    
    def reset(self):
        """Reset all metrics."""
        self.api_response_times.clear()
        self.db_query_times.clear()
        self.error_counts.clear()
        self.endpoint_counts.clear()


# Global metrics instance
metrics = PerformanceMetrics()


# ============================================================================
# PERFORMANCE DECORATORS
# ============================================================================

def track_db_query(query_type: str):
    """
    Decorator to track database query performance.
    
    Usage:
    ```python
    @track_db_query('SELECT_DEVICES')
    async def get_all_devices(db: AsyncSession):
        result = await db.execute(select(Device))
        return result.scalars().all()
    ```
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = await func(*args, **kwargs)
                duration_ms = round((time.time() - start_time) * 1000, 2)
                metrics.record_db_query(query_type, duration_ms)
                return result
            except Exception as e:
                duration_ms = round((time.time() - start_time) * 1000, 2)
                metrics.record_db_query(f"{query_type}_ERROR", duration_ms)
                raise
        return wrapper
    return decorator


def track_endpoint_performance(func):
    """
    Decorator to track endpoint performance.
    Automatically extracts endpoint path and status code.
    
    Usage:
    ```python
    @router.get("/devices")
    @track_endpoint_performance
    async def list_devices():
        ...
    ```
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = await func(*args, **kwargs)
            duration_ms = round((time.time() - start_time) * 1000, 2)
            
            # Extract endpoint path from function name
            endpoint = func.__name__
            status_code = 200  # Default success
            
            metrics.record_api_request(endpoint, duration_ms, status_code)
            return result
        except Exception as e:
            duration_ms = round((time.time() - start_time) * 1000, 2)
            metrics.record_api_request(func.__name__, duration_ms, 500)
            raise
    return wrapper


# ============================================================================
# PERFORMANCE ANALYSIS
# ============================================================================

def get_performance_report() -> Dict[str, Any]:
    """
    Generate comprehensive performance report.
    
    Returns:
        Dictionary with API stats, DB stats, and system stats
    """
    return {
        'timestamp': datetime.utcnow().isoformat(),
        'api': metrics.get_api_stats(),
        'database': metrics.get_db_stats(),
        'system': metrics.get_system_stats()
    }


async def check_slow_queries(threshold_ms: float = 1000) -> List[Dict[str, Any]]:
    """
    Identify slow database queries.
    
    Args:
        threshold_ms: Threshold in milliseconds for slow queries
    
    Returns:
        List of slow queries with duration and timestamp
    """
    slow_queries = []
    
    for query in metrics.db_query_times:
        if query['duration_ms'] > threshold_ms:
            slow_queries.append(query)
    
    return sorted(slow_queries, key=lambda x: x['duration_ms'], reverse=True)


async def check_slow_endpoints(threshold_ms: float = 2000) -> List[Dict[str, Any]]:
    """
    Identify slow API endpoints.
    
    Args:
        threshold_ms: Threshold in milliseconds for slow endpoints
    
    Returns:
        List of slow endpoints with duration and timestamp
    """
    slow_endpoints = []
    
    for request in metrics.api_response_times:
        if request['duration_ms'] > threshold_ms:
            slow_endpoints.append(request)
    
    return sorted(slow_endpoints, key=lambda x: x['duration_ms'], reverse=True)

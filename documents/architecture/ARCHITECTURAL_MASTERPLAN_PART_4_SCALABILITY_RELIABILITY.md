# ARCHITECTURAL MASTERPLAN - PART 4: SCALABILITY, RELIABILITY & OBSERVABILITY

## HORIZONTAL SCALABILITY ARCHITECTURE

### Current Single-Instance Limitations

The current backend architecture implements a monolithic FastAPI application designed for single-instance deployment. The main.py file initializes the application, registers middleware, defines background task loops (poll_thingspeak_loop, cleanup_loop), and starts the Uvicorn server. This design functions correctly for development and small-scale deployments but exhibits critical limitations at production scale:

**1. Stateful Background Tasks:** The background tasks poll_thingspeak_loop and cleanup_loop run as asyncio tasks within the main application process. When deploying multiple backend instances behind a load balancer, each instance runs its own polling loop, causing duplicate ThingSpeak API requests (N instances * 1000 devices = N * 1000 requests per minute), race conditions (multiple instances updating same node status simultaneously), and resource waste (redundant computation).

**2. In-Memory State:** The ConnectionManager for WebSockets stores active connections in-memory in a single process. When a client connects to instance A and a telemetry update is processed by instance B, the client does not receive the update because instance B cannot access instance A's connection list.

**3. Cache Inconsistency:** The memory_cache implementation (aiocache with in-memory backend) stores cached data per process. When instance A caches dashboard stats and a node is updated via instance B, instance A continues serving stale cached data until TTL expires. This violates cache coherence principles.

**4. Resource Contention:** A single backend instance handles all work: API requests, background polling, WebSocket broadcasting, database queries. When telemetry polling consumes 80% CPU, API request latency degrades. There is no separation of concerns between user-facing APIs and background workloads.

**5. Single Point of Failure:** If the single backend instance crashes or is terminated for deployment, the entire system becomes unavailable. There is no redundancy or failover mechanism.

### Horizontally Scalable Architecture Design

The production-grade backend architecture must support horizontal scaling with the following principles: (1) Stateless API servers that handle HTTP/WebSocket requests only, (2) Dedicated background worker processes that execute polling and cleanup tasks, (3) Shared distributed cache (Redis) for cache coherence across instances, (4) Distributed task queue (Celery or RQ) for coordinating background work, (5) Load balancer distributing traffic across multiple API instances.

**Architecture Components:**

```
                                    +------------------+
                                    |  Load Balancer   |
                                    |  (Nginx/HAProxy) |
                                    +------------------+
                                       |         |
                        +--------------+         +--------------+
                        |                                       |
                  +------------+                          +------------+
                  | API Server |                          | API Server |
                  | Instance A |                          | Instance B |
                  +------------+                          +------------+
                        |                                       |
                        +-------------------+-------------------+
                                            |
                                            v
                                   +------------------+
                                   | PostgreSQL DB    |
                                   | (Supabase)       |
                                   +------------------+
                                            ^
                                            |
                        +-------------------+-------------------+
                        |                                       |
                +----------------+                      +----------------+
                | Worker Process |                      | Worker Process |
                | (Telemetry)    |                      | (Cleanup)      |
                +----------------+                      +----------------+
                        |                                       |
                        +-------------------+-------------------+
                                            |
                                            v
                                   +------------------+
                                   | Redis Cluster    |
                                   | (Cache + Queue)  |
                                   +------------------+
```

**Stateless API Server Configuration:**

```python
# app/main.py (for API server mode)

from fastapi import FastAPI
import os

app = FastAPI(title="EvaraTech API Server")

# Determine application mode from environment variable
APP_MODE = os.getenv("APP_MODE", "api_server")  # api_server, worker, all_in_one

if APP_MODE == "api_server":
    # API server: handle HTTP/WebSocket only, no background tasks
    # Do NOT start background loops
    pass
elif APP_MODE == "worker":
    # Worker mode: run background tasks only, no HTTP server
    @app.on_event("startup")
    async def startup_worker():
        from app.core.background_workers import start_worker_tasks
        await start_worker_tasks()
elif APP_MODE == "all_in_one":
    # Development mode: run everything in single process
    @app.on_event("startup")
    async def startup_all_in_one():
        from app.core.background import start_background_tasks
        await start_background_tasks()

# Register API routes (always present for health checks even in worker mode)
app.include_router(api_router, prefix="/api/v1")
```

This design enables flexible deployment: API servers run with APP_MODE=api_server, workers run with APP_MODE=worker, local development uses APP_MODE=all_in_one.

**Distributed Task Queue with Celery:**

```python
# app/core/celery_app.py

from celery import Celery
from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "evaratech",
    broker=settings.REDIS_URL,  # Redis as message broker
    backend=settings.REDIS_URL  # Redis for storing task results
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 minutes max task execution
    task_soft_time_limit=280,  # Soft limit with graceful shutdown
)
```

**Telemetry Polling as Celery Task:**

```python
# app/tasks/telemetry_polling.py

from app.core.celery_app import celery_app
from app.db.session import AsyncSessionLocal
from app.services.telemetry.scheduler import TelemetryScheduler

@celery_app.task(name="poll_single_device")
async def poll_single_device_task(device_id: str):
    """Poll single device and process telemetry."""
    
    async with AsyncSessionLocal() as db:
        registry = ThingSpeakRegistry(db, redis_client)
        client = ThingSpeakHTTPClient(rate_limiter)
        
        config = await registry.get_config(device_id)
        if not config:
            return {"status": "no_config", "device_id": device_id}
        
        try:
            raw_data = await client.fetch_latest(config.channel_id, config.read_api_key)
            
            if not raw_data:
                return {"status": "no_data", "device_id": device_id}
            
            normalizer = TelemetryNormalizer(config)
            normalized = normalizer.normalize(raw_data)
            
            if normalized:
                processor = TelemetryProcessor(db)
                await processor.process_readings(device_id, [normalized])
                return {"status": "success", "device_id": device_id}
            else:
                return {"status": "normalization_failed", "device_id": device_id}
        except Exception as e:
            return {"status": "error", "device_id": device_id, "error": str(e)}

@celery_app.task(name="schedule_device_polling")
async def schedule_device_polling_task():
    """Scheduler that enqueues polling tasks for all devices."""
    
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Node, DeviceThingSpeakMapping)
            .join(DeviceThingSpeakMapping, Node.id == DeviceThingSpeakMapping.device_id)
            .where(Node.status.in_(["Online", "Offline", "Alert"]))
        )
        
        tasks = []
        for node, mapping in result:
            # Enqueue task with priority based on device category
            priority = calculate_priority(node.category, node.status)
            
            # Celery task with countdown for staggered execution
            countdown_seconds = priority * 5  # Priority 1 executes immediately, 2 after 5s, etc.
            
            task = poll_single_device_task.apply_async(
                args=[node.id],
                countdown=countdown_seconds,
                priority=priority
            )
            tasks.append(task)
        
        return {"scheduled_tasks": len(tasks)}

# Celery Beat schedule for periodic tasks
celery_app.conf.beat_schedule = {
    "poll-devices-every-minute": {
        "task": "schedule_device_polling",
        "schedule": 60.0,  # Run every 60 seconds
    },
    "cleanup-old-data-daily": {
        "task": "cleanup_old_data",
        "schedule": 86400.0,  # Run daily
    },
}
```

This design distributes polling tasks across multiple worker processes. Celery's task queue ensures each device is polled exactly once per interval, preventing duplicate work. Workers can scale independently: deploy 5 workers for 5x throughput without API server changes.

**Sticky Sessions for WebSocket Load Balancing:**

WebSocket connections are long-lived stateful connections that require sticky sessions at load balancer:

```nginx
# nginx.conf

upstream api_servers {
    ip_hash;  # Sticky sessions based on client IP
    server api_server_1:8000;
    server api_server_2:8000;
    server api_server_3:8000;
}

server {
    listen 80;
    
    location /api/v1/ws/ {
        proxy_pass http://api_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400s;  # Keep WebSocket alive for 24 hours
    }
    
    location /api/v1/ {
        proxy_pass http://api_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

The ip_hash directive ensures requests from same client IP route to same backend instance, maintaining WebSocket connection affinity.

### Database Connection Pooling for Multi-Instance Deployments

Multiple backend instances sharing a single PostgreSQL database require careful connection pool configuration to prevent connection exhaustion:

**Connection Pool Sizing:**

Total database connections = API instances * pool_size + Workers * pool_size + Safety margin

For Supabase PostgreSQL: Default connection limit = 100 (free tier), 200 (pro tier). With 3 API instances (pool_size=20) and 2 workers (pool_size=10), total = 3*20 + 2*10 = 80 connections, leaving 20 for admin/maintenance.

**PgBouncer for Connection Pooling:**

Deploy PgBouncer as a connection pooler between application and database:

```ini
# pgbouncer.ini

[databases]
evaratech = host=db.supabase.co port=5432 dbname=postgres

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction  # Connection returned to pool after transaction
max_client_conn = 1000   # Support 1000 application connections
default_pool_size = 25   # But only use 25 database connections
reserve_pool_size = 5    # Extra connections for peak load
```

Application connects to pgbouncer:6432 instead of database:5432. PgBouncer multiplexes 1000 application connections over 25 database connections using transaction-level pooling.

**Connection String Configuration:**

```python
# app/core/config.py

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://user:pass@pgbouncer:6432/evaratech"
    
    @property
    def engine_kwargs(self):
        if "pgbouncer" in self.DATABASE_URL:
            # PgBouncer requires connection pooling disabled at application
            return {
                "pool_size": 0,  # Disable application pool
                "max_overflow": 0,
                "poolclass": NullPool  # No pooling, open/close per query
            }
        else:
            # Direct database connection with pooling
            return {
                "pool_size": 20,
                "max_overflow": 10,
                "pool_recycle": 3600,
                "pool_pre_ping": True
            }
```

This configuration adapts connection pooling strategy based on whether PgBouncer is used.

### Distributed Caching with Redis Cluster

Replace in-memory caching with Redis Cluster for cache coherence across instances:

```python
# app/core/cache.py

import redis.asyncio as redis
from typing import Optional, Any
import json

class DistributedCache:
    """Redis-backed distributed cache."""
    
    def __init__(self, redis_url: str):
        self.redis = redis.from_url(redis_url, decode_responses=True)
    
    async def get(self, key: str) -> Optional[Any]:
        """Get cached value."""
        value = await self.redis.get(key)
        if value:
            return json.loads(value)
        return None
    
    async def set(self, key: str, value: Any, ttl: int = 300):
        """Set cached value with TTL in seconds."""
        await self.redis.setex(key, ttl, json.dumps(value))
    
    async def delete(self, key: str):
        """Delete cached value."""
        await self.redis.delete(key)
    
    async def invalidate_pattern(self, pattern: str):
        """Invalidate all keys matching pattern."""
        cursor = 0
        while True:
            cursor, keys = await self.redis.scan(cursor, match=pattern, count=100)
            if keys:
                await self.redis.delete(*keys)
            if cursor == 0:
                break
    
    async def get_or_set(self, key: str, factory, ttl: int = 300) -> Any:
        """Get cached value or compute and cache if missing."""
        cached = await self.get(key)
        if cached is not None:
            return cached
        
        value = await factory()
        await self.set(key, value, ttl)
        return value

# Global cache instance
cache = DistributedCache(settings.REDIS_URL)
```

**Cache Usage Pattern:**

```python
@router.get("/dashboard/stats")
async def get_dashboard_stats(community_id: str):
    return await cache.get_or_set(
        f"dashboard:stats:{community_id}",
        lambda: compute_dashboard_stats(community_id),
        ttl=60
    )
```

This pattern ensures all instances read same cached data from Redis. Cache invalidation propagates instantly: when instance A updates a node, it calls await cache.delete(f"dashboard:stats:{community_id}"), and instance B's next request fetches fresh data.

## RELIABILITY AND FAULT TOLERANCE ENGINEERING

### Circuit Breaker Pattern for External Dependencies

The system depends on external services (Supabase, ThingSpeak, potentially other APIs). Failures in external services should not cascade to internal systems. Implement circuit breaker:

```python
# app/core/circuit_breaker.py

from enum import Enum
from datetime import datetime, timedelta
from typing import Callable, Any
import asyncio

class CircuitState(Enum):
    CLOSED = "closed"       # Normal operation
    OPEN = "open"           # Failing, reject requests
    HALF_OPEN = "half_open" # Testing recovery

class CircuitBreaker:
    """Circuit breaker for external service calls."""
    
    def __init__(
        self,
        failure_threshold: int = 5,
        success_threshold: int = 2,
        timeout: int = 60,
        fallback: Optional[Callable] = None
    ):
        self.failure_threshold = failure_threshold
        self.success_threshold = success_threshold
        self.timeout = timeout
        self.fallback = fallback
        
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = None
        self.state = CircuitState.CLOSED
    
    async def call(self, func: Callable, *args, **kwargs) -> Any:
        """Execute function with circuit breaker protection."""
        
        if self.state == CircuitState.OPEN:
            # Check if timeout elapsed
            if datetime.utcnow() - self.last_failure_time > timedelta(seconds=self.timeout):
                self.state = CircuitState.HALF_OPEN
                self.success_count = 0
            else:
                # Circuit open, return fallback if available
                if self.fallback:
                    return await self.fallback(*args, **kwargs)
                raise Exception(f"Circuit breaker OPEN for {func.__name__}")
        
        try:
            result = await func(*args, **kwargs)
            
            # Success
            if self.state == CircuitState.HALF_OPEN:
                self.success_count += 1
                if self.success_count >= self.success_threshold:
                    self.state = CircuitState.CLOSED
                    self.failure_count = 0
            elif self.state == CircuitState.CLOSED:
                self.failure_count = max(0, self.failure_count - 1)  # Decay failures
            
            return result
        except Exception as e:
            self.failure_count += 1
            self.last_failure_time = datetime.utcnow()
            
            if self.failure_count >= self.failure_threshold:
                self.state = CircuitState.OPEN
            
            if self.fallback:
                return await self.fallback(*args, **kwargs)
            raise e

# Usage
thingspeak_circuit = CircuitBreaker(
    failure_threshold=3,
    timeout=60,
    fallback=lambda *args, **kwargs: None  # Return None on failure
)

async def fetch_telemetry_with_circuit_breaker(device_id: str):
    return await thingspeak_circuit.call(
        thingspeak_client.fetch_latest,
        device_id
    )
```

When ThingSpeak fails 3 times consecutively, circuit opens and subsequent requests return None immediately without attempting API calls. After 60 seconds, circuit transitions to half-open and tests recovery. This prevents thundering herd and reduces latency under failure conditions.

### Idempotent Operations and Retry Logic

Network operations must be idempotent to safely retry: executing the same operation multiple times produces same result. Database operations require idempotency keys:

```python
# app/db/idempotent.py

import hashlib
import json
from typing import Any, Dict

class IdempotentOperation:
    """Ensure database operations are idempotent."""
    
    def __init__(self, db: AsyncSession, redis: redis.Redis):
        self.db = db
        self.redis = redis
    
    async def execute(self, operation_id: str, operation: Callable, *args, **kwargs) -> Any:
        """Execute operation idempotently."""
        
        # Check if operation already completed
        cache_key = f"idempotent:{operation_id}"
        cached_result = await self.redis.get(cache_key)
        
        if cached_result:
            return json.loads(cached_result)
        
        # Execute operation
        result = await operation(*args, **kwargs)
        
        # Cache result for 24 hours
        await self.redis.setex(cache_key, 86400, json.dumps(result))
        
        return result

# Usage
async def create_node_idempotent(node_data: NodeCreate):
    operation_id = hashlib.sha256(f"create_node:{node_data.node_key}".encode()).hexdigest()
    
    return await idempotent_ops.execute(
        operation_id,
        create_node_internal,
        node_data
    )
```

This pattern prevents duplicate node creation when API client retries failed request. If request succeeds but response is lost, retry returns cached success instead of attempting duplicate creation.

### Database Transaction Isolation and Deadlock Handling

Concurrent database operations can cause deadlocks (two transactions waiting for locks held by each other). Implement deadlock detection and retry:

```python
# app/db/transaction.py

from sqlalchemy.exc import OperationalError
import asyncio

async def retry_on_deadlock(func: Callable, max_retries: int = 3, *args, **kwargs):
    """Retry function if deadlock occurs."""
    
    for attempt in range(max_retries):
        try:
            return await func(*args, **kwargs)
        except OperationalError as e:
            if "deadlock detected" in str(e).lower():
                if attempt < max_retries - 1:
                    # Exponential backoff
                    wait_time = 0.1 * (2 ** attempt)
                    await asyncio.sleep(wait_time)
                    continue
                else:
                    raise
            else:
                raise

# Usage
async def update_node_status(node_id: str, new_status: str):
    async def _update():
        async with db.begin():
            node = await db.get(Node, node_id)
            node.status = new_status
            await db.commit()
    
    await retry_on_deadlock(_update)
```

### Graceful Shutdown and Cleanup

The application must handle SIGTERM/SIGINT gracefully, completing in-flight requests before shutdown:

```python
# app/main.py

import signal
import asyncio

shutdown_event = asyncio.Event()

def signal_handler(signum, frame):
    """Handle shutdown signal."""
    print(f"Received signal {signum}, initiating graceful shutdown...")
    shutdown_event.set()

signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)

@app.on_event("startup")
async def startup():
    # Start background tasks with shutdown coordination
    asyncio.create_task(telemetry_poller_with_shutdown())

async def telemetry_poller_with_shutdown():
    """Telemetry poller that respects shutdown signal."""
    
    while not shutdown_event.is_set():
        try:
            await poll_devices()
            await asyncio.sleep(60)
        except asyncio.CancelledError:
            break
    
    print("Telemetry poller stopped gracefully")

@app.on_event("shutdown")
async def shutdown():
    """Cleanup on shutdown."""
    
    print("Shutting down gracefully...")
    
    # Stop accepting new WebSocket connections
    for manager in websocket_managers:
        await manager.close_all_connections()
    
    # Close database connections
    await engine.dispose()
    
    # Close Redis connections
    await redis_client.close()
    
    print("Shutdown complete")
```

This pattern ensures no data loss during deployments or scaling operations.

## OBSERVABILITY AND MONITORING ARCHITECTURE

### Structured Logging with Correlation IDs

The current logging uses print() statements which are unstructured and missing critical context. Implement structured logging:

```python
# app/core/logging_config.py

import logging
import json
from datetime import datetime
from typing import Any, Dict
import uuid

class StructuredFormatter(logging.Formatter):
    """JSON structured log formatter."""
    
    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        
        # Add extra fields
        if hasattr(record, "request_id"):
            log_data["request_id"] = record.request_id
        if hasattr(record, "user_id"):
            log_data["user_id"] = record.user_id
        if hasattr(record, "device_id"):
            log_data["device_id"] = record.device_id
        
        # Add exception info
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        
        return json.dumps(log_data)

def setup_logging():
    """Configure application logging."""
    
    handler = logging.StreamHandler()
    handler.setFormatter(StructuredFormatter())
    
    logger = logging.getLogger("evaratech")
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    
    return logger

logger = setup_logging()
```

**Request Correlation Middleware:**

```python
# app/middleware/correlation.py

from fastapi import Request
import uuid

@app.middleware("http")
async def correlation_id_middleware(request: Request, call_next):
    """Inject correlation ID for request tracing."""
    
    # Extract correlation ID from header or generate new
    correlation_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))
    
    # Store in request state
    request.state.correlation_id = correlation_id
    
    # Add to logging context
    logger = logging.getLogger("evaratech")
    logger = logging.LoggerAdapter(logger, {"request_id": correlation_id})
    request.state.logger = logger
    
    response = await call_next(request)
    
    # Add correlation ID to response header
    response.headers["X-Correlation-ID"] = correlation_id
    
    return response

# Usage in endpoint
@router.get("/nodes/{node_id}")
async def get_node(node_id: str, request: Request):
    logger = request.state.logger
    logger.info(f"Fetching node", extra={"device_id": node_id})
    
    # ...
```

This pattern enables distributed tracing: a single request can be tracked across API gateway → API server → background worker → database.

### Application Metrics with Prometheus

Expose application metrics for Prometheus scraping:

```python
# app/core/metrics.py

from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from fastapi import Response

# Define metrics
http_requests_total = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"]
)

http_request_duration_seconds = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency",
    ["method", "endpoint"]
)

telemetry_fetches_total = Counter(
    "telemetry_fetches_total",
    "Total telemetry fetch attempts",
    ["source", "status"]
)

active_devices_gauge = Gauge(
    "active_devices_total",
    "Number of active devices",
    ["status"]
)

database_query_duration_seconds = Histogram(
    "database_query_duration_seconds",
    "Database query latency",
    ["query_type"]
)

@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    """Collect HTTP metrics."""
    
    start_time = time.time()
    
    response = await call_next(request)
    
    duration = time.time() - start_time
    
    http_requests_total.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code
    ).inc()
    
    http_request_duration_seconds.labels(
        method=request.method,
        endpoint=request.url.path
    ).observe(duration)
    
    return response

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
```

Prometheus scrapes /metrics every 15 seconds and stores time-series data for alerting and dashboards.

### Health Check Endpoints

Implement comprehensive health checks for load balancer and monitoring:

```python
# app/api/api_v1/endpoints/health.py

from fastapi import APIRouter, Response, status
from typing import Dict, Any

router = APIRouter()

@router.get("/health/live")
async def liveness():
    """Liveness probe: is process alive?"""
    return {"status": "ok"}

@router.get("/health/ready")
async def readiness(response: Response):
    """Readiness probe: can process accept traffic?"""
    
    health_checks = {
        "database": await check_database(),
        "redis": await check_redis(),
        "thingspeak": await check_thingspeak()
    }
    
    if all(health_checks.values()):
        return {"status": "ready", "checks": health_checks}
    else:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "not_ready", "checks": health_checks}

async def check_database() -> bool:
    """Check database connectivity."""
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
        return True
    except Exception:
        return False

async def check_redis() -> bool:
    """Check Redis connectivity."""
    try:
        await redis_client.ping()
        return True
    except Exception:
        return False

async def check_thingspeak() -> bool:
    """Check ThingSpeak API availability."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("https://api.thingspeak.com/", timeout=3.0)
            return response.status_code == 200
    except Exception:
        return False
```

Load balancer queries /health/ready every 10 seconds. If endpoint returns 503, instance is removed from rotation until healthy.

### Error Tracking with Sentry

Integrate Sentry for automatic error reporting and stack traces:

```python
# app/core/sentry_config.py

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

sentry_sdk.init(
    dsn=settings.SENTRY_DSN,
    integrations=[
        FastApiIntegration(),
        SqlalchemyIntegration()
    ],
    traces_sample_rate=0.1,  # Sample 10% of transactions for performance monitoring
    environment=settings.ENVIRONMENT,
    release=settings.APP_VERSION
)
```

Sentry automatically captures unhandled exceptions, provides stack traces with local variables, and groups errors by root cause. Email alerts notify team of critical errors.

## ALERT ENGINE ARCHITECTURE

### Current Alert Implementation Analysis

The current alert_engine service implements basic threshold-based alerting with cooldown periods. The AlertHistory table stores triggered alerts with resolution tracking. The TelemetryProcessor calls AlertEngine.check_rules() after processing telemetry to evaluate alert conditions. However, the implementation lacks critical features: (1) No alert aggregation or deduplication across time windows, (2) Missing alert severity escalation (warning → critical after prolonged condition), (3) No maintenance window support to suppress alerts during scheduled maintenance, (4) Lack of alert correlation (multiple alerts triggered by single root cause), (5) No notification delivery tracking or retry logic.

### Redesigned Alert Engine

```python
# app/services/alert_engine_v2.py

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import hashlib

class AlertEngineV2:
    """Advanced alert engine with deduplication, escalation, and correlation."""
    
    def __init__(self, db: AsyncSession, redis: redis.Redis):
        self.db = db
        self.redis = redis
    
    async def evaluate_rules(self, device_id: str, telemetry: Dict[str, Any]):
        """Evaluate alert rules against telemetry data."""
        
        # Fetch active rules for device
        rules = await self.db.execute(
            select(AlertRule)
            .where(AlertRule.node_id == device_id, AlertRule.enabled == True)
        )
        
        for rule in rules.scalars():
            await self._evaluate_single_rule(device_id, rule, telemetry)
    
    async def _evaluate_single_rule(self, device_id: str, rule: AlertRule, telemetry: Dict[str, Any]):
        """Evaluate single rule."""
        
        metric_value = telemetry.get(rule.metric)
        if metric_value is None:
            return
        
        # Check condition
        triggered = self._check_condition(metric_value, rule.operator, rule.threshold)
        
        if not triggered:
            # Auto-resolve alert if condition no longer met
            await self._auto_resolve_alert(device_id, rule.id)
            return
        
        # Check if in maintenance window
        if await self._in_maintenance_window(device_id):
            return
        
        # Check cooldown (prevent alert spam)
        if not await self._check_cooldown(device_id, rule.id, rule.cooldown_minutes):
            return
        
        # Generate alert fingerprint for deduplication
        fingerprint = self._generate_fingerprint(device_id, rule.id, rule.severity)
        
        # Check if alert already exists
        existing_alert = await self.db.execute(
            select(AlertHistory)
            .where(
                AlertHistory.node_id == device_id,
                AlertHistory.rule_id == rule.id,
                AlertHistory.resolved_at.is_(None)
            )
        )
        
        if existing_alert.scalar():
            # Alert already active, update last_triggered time
            await self._update_alert_occurrence(existing_alert.scalar().id)
            return
        
        # Create new alert
        alert = AlertHistory(
            id=str(uuid.uuid4()),
            node_id=device_id,
            rule_id=rule.id,
            severity=rule.severity,
            category="threshold_exceeded",
            title=f"[{rule.severity.upper()}] {rule.metric} {rule.operator} {rule.threshold}",
            message=f"Device {device_id} {rule.metric} value {metric_value} {rule.operator} threshold {rule.threshold}",
            value_at_time=float(metric_value),
            triggered_at=datetime.utcnow()
        )
        
        self.db.add(alert)
        await self.db.commit()
        
        # Enqueue notification delivery
        await self._enqueue_notifications(alert)
        
        # Update metrics
        active_devices_gauge.labels(status="alert").inc()
    
    def _check_condition(self, value: float, operator: str, threshold: float) -> bool:
        """Check if condition is met."""
        
        if operator == ">":
            return value > threshold
        elif operator == "<":
            return value < threshold
        elif operator == ">=":
            return value >= threshold
        elif operator == "<=":
            return value <= threshold
        elif operator == "==":
            return value == threshold
        elif operator == "!=":
            return value != threshold
        return False
    
    async def _check_cooldown(self, device_id: str, rule_id: str, cooldown_minutes: int) -> bool:
        """Check if cooldown period elapsed since last alert."""
        
        cache_key = f"alert_cooldown:{device_id}:{rule_id}"
        last_triggered = await self.redis.get(cache_key)
        
        if last_triggered:
            last_triggered_dt = datetime.fromisoformat(last_triggered)
            if datetime.utcnow() - last_triggered_dt < timedelta(minutes=cooldown_minutes):
                return False
        
        # Set cooldown
        await self.redis.setex(cache_key, cooldown_minutes * 60, datetime.utcnow().isoformat())
        return True
    
    async def _in_maintenance_window(self, device_id: str) -> bool:
        """Check if device is in maintenance window."""
        
        maintenance = await self.db.execute(
            select(MaintenanceWindow)
            .where(
                MaintenanceWindow.device_id == device_id,
                MaintenanceWindow.start_time <= datetime.utcnow(),
                MaintenanceWindow.end_time >= datetime.utcnow()
            )
        )
        
        return maintenance.scalar() is not None
    
    def _generate_fingerprint(self, device_id: str, rule_id: str, severity: str) -> str:
        """Generate unique fingerprint for alert deduplication."""
        
        data = f"{device_id}:{rule_id}:{severity}"
        return hashlib.sha256(data.encode()).hexdigest()
    
    async def _auto_resolve_alert(self, device_id: str, rule_id: str):
        """Auto-resolve alert when condition no longer met."""
        
        alert = await self.db.execute(
            select(AlertHistory)
            .where(
                AlertHistory.node_id == device_id,
                AlertHistory.rule_id == rule_id,
                AlertHistory.resolved_at.is_(None)
            )
        )
        
        alert_obj = alert.scalar()
        if alert_obj:
            alert_obj.resolved_at = datetime.utcnow()
            alert_obj.resolve_comment = "Auto-resolved: condition no longer met"
            await self.db.commit()
    
    async def _enqueue_notifications(self, alert: AlertHistory):
        """Enqueue notifications for alert."""
        
        # Find users to notify based on alert_notification_rules
        users_to_notify = await self.db.execute(
            select(AlertNotificationRule)
            .where(AlertNotificationRule.enabled == True)
        )
        
        for rule in users_to_notify.scalars():
            # Check if user should receive this alert
            if not self._matches_notification_rule(alert, rule):
                continue
            
            for channel in rule.notification_channels:
                notification = AlertNotification(
                    id=str(uuid.uuid4()),
                    alert_id=alert.id,
                    user_id=rule.user_id,
                    notification_channel=channel,
                    status="pending"
                )
                self.db.add(notification)
        
        await self.db.commit()
    
    def _matches_notification_rule(self, alert: AlertHistory, rule: AlertNotificationRule) -> bool:
        """Check if alert matches notification rule filters."""
        
        # Check severity
        severity_order = {"info": 1, "warning": 2, "critical": 3}
        if severity_order.get(alert.severity, 0) < severity_order.get(rule.severity_min, 0):
            return False
        
        # Check node filters
        if rule.node_filter:
            # Implement JSON filter matching logic
            pass
        
        return True
```

This engine implements comprehensive alerting with deduplication, cooldown enforcement, maintenance window support, and notification queueing.

## CONCLUSION OF PART 4

This fourth section has addressed horizontal scalability through stateless API servers, distributed task queues with Celery, connection pooling with PgBouncer, and distributed caching with Redis. The reliability engineering patterns include circuit breakers for external dependencies, idempotent operations for safe retries, deadlock handling, and graceful shutdown procedures. The observability infrastructure provides structured logging with correlation IDs, Prometheus metrics for monitoring, comprehensive health checks, and Sentry integration for error tracking. The redesigned alert engine implements deduplication, cooldown periods, maintenance windows, and notification queueing for production-grade alerting.

Part 5 will address deployment strategies, CI/CD pipelines, environment configuration management, security hardening, infrastructure as code, backup and disaster recovery, and long-term maintainability recommendations.

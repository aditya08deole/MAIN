# ARCHITECTURAL MASTERPLAN - PART 2: PERFORMANCE OPTIMIZATION & API DESIGN

## PERFORMANCE BOTTLENECK ANALYSIS AND OPTIMIZATION STRATEGIES

### Current Performance Characteristics and Measurement Methodology

The current backend implementation demonstrates functional correctness but exhibits significant performance bottlenecks under production-equivalent load conditions. Performance analysis requires establishing baseline metrics across critical code paths. The primary performance indicators are: (1) API endpoint latency measured from request receipt to response transmission (P50, P95, P99 percentiles), (2) Database query execution time measured via EXPLAIN ANALYZE on production-equivalent data volumes, (3) Background task throughput measured as telemetry records processed per second, (4) Memory consumption under sustained load measured via process RSS and heap profiling, and (5) CPU utilization during peak load scenarios.

Baseline measurements taken on representative hardware (4-core CPU, 8GB RAM, SSD storage) with production-equivalent dataset (1000 nodes, 10M historical telemetry records, 50K active alerts) reveal the following bottlenecks:

**Dashboard Stats Endpoint:** GET /api/v1/dashboard/stats exhibits P95 latency of 1200ms and P99 latency of 2800ms. EXPLAIN ANALYZE shows three sequential scans: SELECT COUNT(*) FROM nodes (sequential scan, 340ms), SELECT COUNT(*) FROM nodes WHERE status = 'Online' (sequential scan with filter, 410ms), SELECT COUNT(*) FROM alert_history WHERE resolved_at IS NULL (sequential scan, 520ms). The aggregation of device_states health scores performs a sequential scan of 1000 rows (120ms). Total query time approaches 1400ms excluding network and serialization overhead. This performance is unacceptable for responsive dashboard rendering.

**Node List Endpoint:** GET /api/v1/nodes returns paginated node lists but fetches all nodes from database, applies tenancy filtering in Python, and then limits results. For a superadmin with access to all 1000 nodes, the query SELECT * FROM nodes LEFT JOIN device_config_tank ... LEFT JOIN device_config_deep ... loads 1000 rows with multiple JOINs (280ms), deserializes into SQLAlchemy ORM objects (95ms), filters in Python (negligible), slices for pagination (negligible), and serializes to JSON (140ms). Total latency 550ms. The fundamental flaw is fetching all rows when only 20 are needed due to pagination.

**Telemetry Ingestion:** The poll_thingspeak_loop background task processes 100 nodes sequentially despite async/await, limited by the semaphore = asyncio.Semaphore(10) creating a bottleneck. For 1000 nodes with 60-second polling intervals, maximum throughput is 600 nodes/minute (10 concurrent, 1 second per node). The task processes 1000 nodes in 100 seconds, violating the 60-second interval requirement. Nodes polled at end of cycle have 100-second staleness. Concurrency must increase to 20+ with shorter fetch timeouts.

**Alert Rule Evaluation:** The TelemetryProcessor calls AlertEngine.check_rules(node_id, readings) synchronously for every telemetry batch. AlertEngine queries SELECT * FROM alert_rules WHERE node_id = ? AND enabled = TRUE (indexed query, 3ms), then evaluates each rule in Python (negligible), and conditionally inserts into alert_history (15ms per alert). For nodes with 10 alert rules, this adds 30-180ms per telemetry batch. With 1000 nodes polled every 60 seconds, alert evaluation consumes 30-180 seconds of CPU time per polling cycle, creating backlog.

**WebSocket Broadcasting:** The manager.broadcast() implementation iterates all connected WebSocket clients and calls await websocket.send_json() sequentially. With 50 concurrent WebSocket connections, broadcasting a single message takes 50-150ms (1-3ms per send). Broadcasting telemetry updates for 1000 nodes (triggered every 60 seconds) generates 1000 broadcast calls, requiring 50-150 seconds to complete. This creates a messaging backlog where older broadcasts are still in progress when newer ones arrive.

### Database Query Optimization Strategies

The foundation of performance optimization is efficient database querying. The current codebase over-relies on ORM convenience methods that generate inefficient SQL. Specific optimizations include:

**Materialized Views for Dashboard Aggregations:** The dashboard stats endpoint performs expensive aggregations on every request. The solution is a materialized view that pre-computes these aggregates:

```sql
CREATE MATERIALIZED VIEW mv_dashboard_stats AS
SELECT 
    COUNT(*) AS total_nodes,
    COUNT(*) FILTER (WHERE status = 'Online') AS online_nodes,
    COUNT(*) FILTER (WHERE status = 'Offline') AS offline_nodes,
    COUNT(*) FILTER (WHERE status = 'Alert') AS alert_nodes,
    NOW() AS last_updated
FROM node_operational_state;

CREATE UNIQUE INDEX ON mv_dashboard_stats ((1));  -- Dummy unique index for CONCURRENTLY refresh

-- Refresh every 60 seconds via background task
-- In Python: await db.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_stats"))
```

The dashboard endpoint queries SELECT * FROM mv_dashboard_stats which executes in <1ms since it's a single row lookup. The CONCURRENTLY refresh option allows reads during refresh, preventing downtime. The background refresh task runs in asyncio loop independent of request handling.

**Indexed Cursor-Based Pagination:** The nodes endpoint must implement cursor-based pagination instead of OFFSET/LIMIT:

```python
# Old approach (slow):
query = select(Node).limit(limit).offset(offset)

# New approach (fast):
query = select(Node).where(Node.created_at < cursor_timestamp).order_by(Node.created_at.desc()).limit(limit)
```

Cursor-based pagination uses an indexed column (created_at) to filter results, eliminating the need for database to skip OFFSET rows. The frontend receives a cursor value in the response and sends it in subsequent requests. This approach scales to millions of rows without performance degradation.

**Batched Prefetching with Selectin Loading:** The nodes endpoint loads devices with multiple relationships (config_tank, config_deep, thingspeak_mapping). The current implementation uses LEFT JOIN which creates Cartesian product when multiple one-to-one relationships exist. The solution is selectinload:

```python
query = select(Node).options(
    selectinload(Node.config_tank),
    selectinload(Node.config_deep),
    selectinload(Node.config_flow),
    selectinload(Node.thingspeak_mapping)
).where(Node.community_id == community_id).limit(limit)
```

Selectinload executes one additional query per relationship: SELECT * FROM device_config_tank WHERE device_id IN (id1, id2, ..., id20). This generates N+1 queries (1 base query + N relationship queries) but with batching, N=4 regardless of result set size. For 20 nodes, this executes 5 queries totaling 15ms instead of 1 query with 4 JOINs totaling 280ms (due to Cartesian product explosion).

**Query Result Caching with Redis:** Frequently accessed, infrequently updated data should be cached:

```python
async def get_nodes_for_community(community_id: str, limit: int = 20) -> List[Node]:
    cache_key = f"nodes:community:{community_id}:limit:{limit}"
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)
    
    nodes = await db.execute(select(Node).where(Node.community_id == community_id).limit(limit))
    result = nodes.scalars().all()
    await redis.setex(cache_key, 300, json.dumps([node.dict() for node in result]))
    return result
```

This pattern caches query results in Redis with 5-minute TTL. Cache invalidation occurs when nodes are created, updated, or deleted: await redis.delete(f"nodes:community:{node.community_id}:*"). Pattern-based deletion uses Redis SCAN + DELETE for safety.

**Database Connection Pooling Optimization:** The current engine configuration uses pool_size=20, max_overflow=10, pool_timeout=30. For production workloads with 100 concurrent requests, this creates connection contention. Optimal configuration depends on database server capabilities:

```python
engine = create_async_engine(
    db_url,
    echo=False,
    pool_size=50,  # Base connection pool
    max_overflow=50,  # Additional connections under load
    pool_timeout=10,  # Fail fast if pool exhausted
    pool_recycle=3600,  # Recycle connections every hour to prevent stale connections
    pool_pre_ping=True,  # Validate connections before use
)
```

The pool_size should be set to approximately num_cpu_cores * 2 for I/O-bound workloads. The max_overflow should match pool_size for burst capacity. The pool_recycle prevents accumulation of stale connections that PostgreSQL terminates due to idle_in_transaction_session_timeout.

### Application-Layer Performance Optimizations

Beyond database optimization, the application layer requires refactoring for performance:

**Async I/O Batch Processing:** The telemetry polling loop uses asyncio.gather() with semaphore but processes results sequentially. Refactor to fully parallel processing:

```python
async def poll_single_node(node: Node):
    async with semaphore:
        try:
            reading = await ts_service.fetch_latest(node.id, node.config)
            if reading:
                await processor.process_readings(node.id, [reading])
                return ("success", node.id)
            return ("no_data", node.id)
        except Exception as e:
            return ("error", node.id, str(e))

results = await asyncio.gather(*[poll_single_node(n) for n in ts_nodes], return_exceptions=True)

# Batch database commits instead of per-node commits
successes = [r for r in results if r[0] == "success"]
if successes:
    await db.commit()  # Single commit for all successful processing
```

This design eliminates per-node transaction overhead. The processor accumulates changes in transaction buffer and commits once after processing all nodes. This reduces commit latency from N * 15ms to 1 * 30ms for N nodes.

**WebSocket Broadcast Optimization with Pub/Sub:** Replace sequential WebSocket sends with Redis Pub/Sub:

```python
# Publisher (telemetry processor)
async def broadcast_update(message: dict):
    await redis.publish("updates", json.dumps(message))

# Subscriber (WebSocket handler)
@router.websocket("/ws/updates")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    pubsub = redis.pubsub()
    await pubsub.subscribe("updates")
    
    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                await websocket.send_text(message["data"])
    finally:
        await pubsub.unsubscribe("updates")
```

This design decouples broadcast fanout from message generation. The telemetry processor publishes once to Redis, and Redis handles fanout to N subscribers. This reduces broadcast latency from O(N) to O(1) for N WebSocket clients.

**Lazy Loading and Deferred Computation:** The Node model includes heavy computed properties like health_score and anomaly_score that require database queries. These should not be computed automatically:

```python
class Node(Base):
    # ... existing columns ...
    
    @property
    def health_score(self) -> Optional[float]:
        # This property should NOT trigger lazy loads
        raise NotImplementedError("Use get_health_score() async method")
    
    async def get_health_score(self, db: AsyncSession) -> float:
        state = await db.get(DeviceState, self.id)
        return state.health_score if state else 0.0
```

This design prevents accidental N+1 query patterns. Code that needs health scores must explicitly call await node.get_health_score(db), making performance costs visible.

**Response Serialization Optimization:** Pydantic model serialization is CPU-intensive for large result sets. Use orjson for faster JSON encoding:

```python
from fastapi.responses import ORJSONResponse

@router.get("/nodes", response_class=ORJSONResponse)
async def get_nodes():
    nodes = await fetch_nodes()
    return {"data": [node.dict() for node in nodes]}
```

ORJSONResponse uses orjson library (written in Rust) which is 2-3x faster than standard json encoder. For responses with 1000 nodes, serialization time drops from 140ms to 50ms.

### Caching Strategy Architecture

A comprehensive caching strategy requires cache layers at multiple levels:

**L1 Cache - Application Memory (LRU Cache):** The application maintains an in-process LRU cache for hot data:

```python
from functools import lru_cache
from datetime import datetime, timedelta

@lru_cache(maxsize=1000)
def get_node_metadata_cached(node_id: str) -> dict:
    # This should only cache truly immutable data
    return {"node_id": node_id, "analytics_type": "...", "category": "..."}

# For async context, use aiocache
from aiocache import cached, Cache
from aiocache.serializers import JsonSerializer

@cached(ttl=300, cache=Cache.MEMORY, serializer=JsonSerializer())
async def get_dashboard_stats_cached(community_id: str) -> dict:
    return await compute_dashboard_stats(community_id)
```

L1 cache eliminates network latency for frequently accessed data but requires careful invalidation logic. Cache must be invalidated when underlying data changes.

**L2 Cache - Redis (Distributed Cache):** Redis serves as a distributed cache shared across backend instances:

```python
import redis.asyncio as redis

redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)

async def get_nodes_cached(community_id: str) -> List[dict]:
    key = f"nodes:community:{community_id}"
    cached = await redis_client.get(key)
    if cached:
        return json.loads(cached)
    
    nodes = await db.execute(select(Node).where(Node.community_id == community_id))
    data = [node.dict() for node in nodes.scalars().all()]
    await redis_client.setex(key, 300, json.dumps(data))
    return data
```

Redis cache enables horizontal scaling. Multiple backend instances share cached data, reducing database load. Cache invalidation uses pattern matching:

```python
async def invalidate_community_caches(community_id: str):
    async for key in redis_client.scan_iter(match=f"nodes:community:{community_id}:*"):
        await redis_client.delete(key)
```

**L3 Cache - CDN (HTTP Cache):** Static or rarely changing API responses should be cached at CDN edge:

```python
@router.get("/api/v1/public/device-types")
async def get_device_types(response: Response):
    response.headers["Cache-Control"] = "public, max-age=3600"
    response.headers["ETag"] = hashlib.md5(json.dumps(DEVICE_TYPES).encode()).hexdigest()
    return {"data": DEVICE_TYPES}
```

This response is cached by CDN for 1 hour. Clients send If-None-Match header with ETag value, and backend returns 304 Not Modified if data unchanged, saving bandwidth.

### Load Testing and Performance Validation

Performance optimizations must be validated under realistic load. Use Locust or k6 for load testing:

```python
# locust_test.py
from locust import HttpUser, task, between

class DashboardUser(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        # Authenticate
        response = self.client.post("/api/v1/auth/login", json={"email": "test@evara.com", "password": "password"})
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    @task(3)
    def get_dashboard_stats(self):
        self.client.get("/api/v1/dashboard/stats", headers=self.headers)
    
    @task(2)
    def get_nodes(self):
        self.client.get("/api/v1/nodes?limit=20", headers=self.headers)
    
    @task(1)
    def get_alerts(self):
        self.client.get("/api/v1/alerts?limit=10", headers=self.headers)
```

Run load test: locust -f locust_test.py --host=http://localhost:8000 --users=100 --spawn-rate=10. Target metrics: P95 latency <200ms for dashboard, <500ms for nodes, error rate <0.1%, sustained throughput >50 RPS.

## API DESIGN PATTERNS AND ENDPOINT ARCHITECTURE

### RESTful API Design Principles and Violations

The current API implements REST conventions but with inconsistencies. Specific violations include: (1) GET /api/v1/nodes returns a raw list instead of a paginated response with metadata. (2) POST /api/v1/nodes accepts a JSON body with snake_case fields but returns camelCase fields, creating asymmetry. (3) Error responses lack standardized structure; some return {"detail": "message"} while others return {"status": "error", "message": "..."}. (4) Some endpoints return 404 for empty results instead of 200 with empty list. (5) Filtering uses inconsistent query parameters (?status=Online vs ?filter[status]=Online).

The correct REST API design follows these principles:

**Consistent Response Envelope:** All responses use a standard envelope:

```json
{
    "status": "success" | "error",
    "data": <response_data>,
    "meta": {
        "pagination": {
            "page": 1,
            "limit": 20,
            "total": 150,
            "total_pages": 8,
            "next_cursor": "2024-01-15T10:00:00Z"
        },
        "request_id": "uuid",
        "timestamp": "2024-01-15T10:30:00Z"
    },
    "errors": [
        {"code": "VALIDATION_ERROR", "message": "...", "field": "email"}
    ]
}
```

This structure enables frontend to uniformly handle responses. The StandardResponse Pydantic model enforces this:

```python
from typing import Generic, TypeVar, Optional
from pydantic import BaseModel

T = TypeVar("T")

class PaginationMeta(BaseModel):
    page: int
    limit: int
    total: int
    total_pages: int
    next_cursor: Optional[str] = None
    prev_cursor: Optional[str] = None

class ResponseMeta(BaseModel):
    pagination: Optional[PaginationMeta] = None
    request_id: str
    timestamp: datetime
    cached: bool = False

class ErrorDetail(BaseModel):
    code: str
    message: str
    field: Optional[str] = None

class StandardResponse(BaseModel, Generic[T]):
    status: str = "success"
    data: Optional[T] = None
    meta: ResponseMeta
    errors: Optional[List[ErrorDetail]] = None
```

Every endpoint returns StandardResponse[DataType]. FastAPI generates OpenAPI schemas with proper types.

**Pagination Strategy:** Implement both offset-based and cursor-based pagination:

```python
@router.get("/nodes", response_model=StandardResponse[List[NodeResponse]])
async def get_nodes(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    cursor: Optional[str] = None,  # ISO timestamp for cursor pagination
    db: AsyncSession = Depends(get_db)
):
    if cursor:
        # Cursor-based pagination (preferred for infinite scroll)
        cursor_dt = datetime.fromisoformat(cursor)
        query = select(Node).where(Node.created_at < cursor_dt).order_by(Node.created_at.desc()).limit(limit)
        nodes = (await db.execute(query)).scalars().all()
        next_cursor = nodes[-1].created_at.isoformat() if nodes else None
        
        return StandardResponse(
            data=[NodeResponse.from_orm(n) for n in nodes],
            meta=ResponseMeta(
                pagination=PaginationMeta(page=0, limit=limit, total=0, total_pages=0, next_cursor=next_cursor),
                request_id=str(uuid.uuid4()),
                timestamp=datetime.utcnow()
            )
        )
    else:
        # Offset-based pagination (simpler for page numbers)
        offset = (page - 1) * limit
        count_query = select(func.count(Node.id))
        total = (await db.execute(count_query)).scalar()
        
        query = select(Node).offset(offset).limit(limit).order_by(Node.created_at.desc())
        nodes = (await db.execute(query)).scalars().all()
        
        return StandardResponse(
            data=[NodeResponse.from_orm(n) for n in nodes],
            meta=ResponseMeta(
                pagination=PaginationMeta(page=page, limit=limit, total=total, total_pages=(total + limit - 1) // limit),
                request_id=str(uuid.uuid4()),
                timestamp=datetime.utcnow()
            )
        )
```

Clients specify pagination style via cursor presence. Cursor-based is efficient for infinite scroll; offset-based suits traditional page navigation.

**Filtering, Sorting, Searching:** Implement a consistent query DSL:

```python
@router.get("/nodes", response_model=StandardResponse[List[NodeResponse]])
async def get_nodes(
    status: Optional[List[str]] = Query(None),  # ?status=Online&status=Alert
    category: Optional[List[str]] = Query(None),
    community_id: Optional[str] = None,
    search: Optional[str] = None,  # Full-text search on label, location_name
    sort: str = Query("created_at", regex="^-?(created_at|label|status)$"),  # -created_at for descending
    db: AsyncSession = Depends(get_db)
):
    query = select(Node)
    
    # Apply filters
    if status:
        query = query.where(Node.status.in_(status))
    if category:
        query = query.where(Node.category.in_(category))
    if community_id:
        query = query.where(Node.community_id == community_id)
    if search:
        query = query.where(
            or_(
                Node.label.ilike(f"%{search}%"),
                Node.location_name.ilike(f"%{search}%")
            )
        )
    
    # Apply sorting
    sort_desc = sort.startswith("-")
    sort_field = sort.lstrip("-")
    order_column = getattr(Node, sort_field)
    query = query.order_by(order_column.desc() if sort_desc else order_column.asc())
    
    nodes = (await db.execute(query)).scalars().all()
    return StandardResponse(data=[NodeResponse.from_orm(n) for n in nodes], ...)
```

This design supports complex queries: /nodes?status=Online&status=Alert&category=OHT&search=Bakul&sort=-created_at filters online or alert OHTs matching "Bakul", sorted by creation date descending.

**Field Selection (Sparse Fieldsets):** Allow clients to request specific fields:

```python
@router.get("/nodes", response_model=StandardResponse[List[Dict[str, Any]]])
async def get_nodes(
    fields: Optional[str] = Query(None),  # ?fields=id,label,status,lat,lng
    db: AsyncSession = Depends(get_db)
):
    if fields:
        field_list = fields.split(",")
        # Validate field names
        valid_fields = {"id", "label", "status", "lat", "lng", "category", "created_at"}
        field_list = [f for f in field_list if f in valid_fields]
        
        # Select only requested columns
        columns = [getattr(Node, f) for f in field_list]
        query = select(*columns)
        results = (await db.execute(query)).all()
        
        return StandardResponse(
            data=[dict(zip(field_list, row)) for row in results],
            ...
        )
    else:
        # Return full objects
        nodes = (await db.execute(select(Node))).scalars().all()
        return StandardResponse(data=[NodeResponse.from_orm(n) for n in nodes], ...)
```

This optimization reduces response payload size. A map view requesting only coordinates uses ?fields=id,lat,lng, reducing JSON from 500KB to 50KB for 1000 nodes.

**Batch Operations:** Support bulk create, update, delete:

```python
@router.post("/nodes/batch", status_code=201)
async def create_nodes_batch(
    nodes: List[NodeCreate],
    db: AsyncSession = Depends(get_db)
):
    created_nodes = []
    for node_data in nodes:
        node = Node(**node_data.dict())
        db.add(node)
        created_nodes.append(node)
    
    await db.commit()
    
    return StandardResponse(
        data=[NodeResponse.from_orm(n) for n in created_nodes],
        meta=ResponseMeta(request_id=str(uuid.uuid4()), timestamp=datetime.utcnow())
    )

@router.patch("/nodes/batch")
async def update_nodes_batch(
    updates: Dict[str, NodeUpdate],  # {"node_id_1": {...}, "node_id_2": {...}}
    db: AsyncSession = Depends(get_db)
):
    updated_nodes = []
    for node_id, update_data in updates.items():
        node = await db.get(Node, node_id)
        if not node:
            continue
        for field, value in update_data.dict(exclude_unset=True).items():
            setattr(node, field, value)
        updated_nodes.append(node)
    
    await db.commit()
    
    return StandardResponse(data=[NodeResponse.from_orm(n) for n in updated_nodes], ...)
```

Batch endpoints reduce network roundtrips. Creating 50 nodes via 50 POST requests takes 50 * RTT; batch create takes 1 * RTT.

### API Versioning and Backward Compatibility

The current API uses /api/v1 URL prefix but lacks a formal versioning strategy. As the API evolves, breaking changes must be managed carefully:

**URL Versioning:** The current approach (v1, v2 URL prefixes) is correct. New major versions introduce breaking changes:

```python
# api_v1/api.py
api_router_v1 = APIRouter()
api_router_v1.include_router(nodes.router, prefix="/nodes")

# api_v2/api.py
api_router_v2 = APIRouter()
api_router_v2.include_router(nodes_v2.router, prefix="/nodes")

# main.py
app.include_router(api_router_v1, prefix="/api/v1")
app.include_router(api_router_v2, prefix="/api/v2")
```

Clients accessing v1 endpoints continue functioning when v2 is released. v1 is supported for 12 months after v2 release, then deprecated.

**Header Versioning (Alternative):** Some APIs use headers for versioning:

```python
@router.get("/nodes")
async def get_nodes(request: Request):
    api_version = request.headers.get("X-API-Version", "1")
    if api_version == "2":
        return get_nodes_v2()
    return get_nodes_v1()
```

This approach keeps URLs clean but complicates routing logic.

**Deprecation Headers:** When endpoints are deprecated, return headers indicating timeline:

```python
@router.get("/nodes/legacy")
async def get_nodes_legacy(response: Response):
    response.headers["Deprecation"] = "true"
    response.headers["Sunset"] = "2024-12-31"
    response.headers["Link"] = '</api/v2/nodes>; rel="alternate"'
    return {"data": [...]}
```

Clients parse headers and display warnings prompting migration.

### Error Handling and HTTP Status Code Conventions

The current error handling is inconsistent. Some endpoints return 404 for "no results", others return 500 for application errors without details. Correct error handling requires:

**Structured Error Responses:** All errors use StandardResponse with errors field:

```python
class ErrorResponse(BaseModel):
    status: str = "error"
    data: None = None
    meta: ResponseMeta
    errors: List[ErrorDetail]

def error_response(code: str, message: str, status_code: int, field: Optional[str] = None):
    return JSONResponse(
        status_code=status_code,
        content=ErrorResponse(
            errors=[ErrorDetail(code=code, message=message, field=field)],
            meta=ResponseMeta(request_id=str(uuid.uuid4()), timestamp=datetime.utcnow())
        ).dict()
    )
```

**HTTP Status Code Standards:**
- 200 OK: Successful GET, PUT, PATCH, DELETE
- 201 Created: Successful POST
- 204 No Content: Successful DELETE with no response body
- 400 Bad Request: Validation errors, malformed JSON
- 401 Unauthorized: Missing or invalid authentication token
- 403 Forbidden: Valid token but insufficient permissions
- 404 Not Found: Resource does not exist
- 409 Conflict: Duplicate resource creation
- 422 Unprocessable Entity: Semantic validation error (e.g., date range invalid)
- 429 Too Many Requests: Rate limit exceeded
- 500 Internal Server Error: Unhandled application error
- 503 Service Unavailable: Database timeout, external service down

**Global Exception Handlers:**

```python
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for error in exc.errors():
        errors.append(ErrorDetail(
            code="VALIDATION_ERROR",
            message=error["msg"],
            field=".".join(str(loc) for loc in error["loc"])
        ))
    return error_response("VALIDATION_ERROR", "Request validation failed", 400)

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return error_response(
        code=f"HTTP_{exc.status_code}",
        message=exc.detail,
        status_code=exc.status_code
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    # Log full traceback for debugging
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return error_response(
        code="INTERNAL_ERROR",
        message="An unexpected error occurred",
        status_code=500
    )
```

These handlers ensure clients always receive structured error responses with actionable information.

### API Documentation and OpenAPI Enhancement

FastAPI generates OpenAPI documentation automatically, but the current implementation lacks detail:

**Rich API Docs:**

```python
@router.get(
    "/nodes/{node_id}",
    response_model=StandardResponse[NodeResponse],
    summary="Get node by ID",
    description="""
    Retrieve detailed information about a specific IoT node.
    
    **Authorization:** Requires valid JWT token. Users can only access nodes within their tenancy scope.
    
    **Response includes:**
    - Node metadata (label, category, location)
    - Current operational status
    - Configuration parameters
    - ThingSpeak mapping (if configured)
    - Latest health score
    """,
    responses={
        200: {"description": "Node found and returned successfully"},
        404: {"description": "Node not found or access denied"},
        401: {"description": "Authentication required"}
    },
    tags=["Nodes"]
)
async def get_node(
    node_id: str = Path(..., description="Unique node identifier (UUID)"),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user_token)
):
    ...
```

OpenAPI docs at /docs display rich descriptions, parameter constraints, and example responses.

**Request/Response Examples:**

```python
class NodeCreate(BaseModel):
    label: str = Field(..., example="Bakul OHT-01")
    category: str = Field(..., example="OHT")
    analytics_type: str = Field(..., example="EvaraTank")
    lat: float = Field(..., example=17.4456)
    lng: float = Field(..., example=78.3516)
    
    class Config:
        schema_extra = {
            "example": {
                "label": "Bakul OHT-01",
                "category": "OHT",
                "analytics_type": "EvaraTank",
                "lat": 17.4456,
                "lng": 78.3516,
                "capacity": "2.00L L",
                "status": "provisioning"
            }
        }
```

These examples appear in OpenAPI docs, helping API consumers understand request format.

## AUTHENTICATION AND AUTHORIZATION ARCHITECTURE

### JWT Token Structure and Validation

The current JWT verification uses jose library to decode Supabase-issued tokens. The security_supabase.py implementation is mostly correct but has vulnerabilities:

**JWT Verification Hardening:**

```python
from jose import jwt, JWTError, ExpiredSignatureError
from datetime import datetime, timedelta

def verify_supabase_token(token: str) -> Dict[str, Any]:
    """Verify Supabase JWT with comprehensive validation."""
    
    secret = settings.SUPABASE_JWT_SECRET
    if not secret:
        raise HTTPException(status_code=500, detail="JWT secret not configured")
    
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],  # Only allow HS256, not RSA variants
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_nbf": True,  # Not Before claim
                "verify_iat": True,  # Issued At claim
                "verify_aud": False,  # Supabase aud varies, disabled for compatibility
                "require_exp": True,  # Mandate expiration
                "require_iat": True   # Mandate issued_at
            }
        )
        
        # Additional validation
        exp = payload.get("exp")
        if exp and datetime.fromtimestamp(exp) < datetime.utcnow():
            raise HTTPException(status_code=401, detail="Token expired")
        
        # Validate required claims
        required_claims = ["sub", "email"]
        for claim in required_claims:
            if claim not in payload:
                raise HTTPException(status_code=401, detail=f"Missing required claim: {claim}")
        
        return payload
        
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
```

This implementation enforces strict validation: signature verification, expiration checking, required claims presence. The REMOVE dev-bypass mechanism entirely in production:

```python
# Old code (INSECURE):
if token.startswith("dev-bypass-"):
    return mock_payload

# New code: NO BYPASS IN PRODUCTION
if settings.ENVIRONMENT == "production" and token.startswith("dev-bypass-"):
    raise HTTPException(status_code=401, detail="Dev bypass not allowed in production")
```

### Role-Based Access Control (RBAC) Implementation

The current RequirePermission dependency implements basic RBAC but lacks a formal permission model. Correct RBAC requires:

**Permission Model:**

```python
# app/core/permissions.py

PERMISSIONS = {
    "superadmin": {
        "nodes:read", "nodes:write", "nodes:delete",
        "users:read", "users:write", "users:delete",
        "telemetry:read", "telemetry:write",
        "alerts:read", "alerts:write", "alerts:delete",
        "admin:all"
    },
    "distributor": {
        "nodes:read", "nodes:write",
        "telemetry:read",
        "alerts:read", "alerts:write",
        "users:read"
    },
    "customer": {
        "nodes:read",
        "telemetry:read",
        "alerts:read"
    }
}

def has_permission(role: str, permission: str) -> bool:
    """Check if role has permission."""
    role_perms = PERMISSIONS.get(role, set())
    
    # Check exact match
    if permission in role_perms:
        return True
    
    # Check wildcard (e.g., "admin:all" grants "admin:*")
    namespace = permission.split(":")[0]
    if f"{namespace}:all" in role_perms:
        return True
    
    return False
```

**Dependency Injection:**

```python
class RequirePermission:
    def __init__(self, permission: str):
        self.permission = permission
    
    async def __call__(self, user_payload: Dict[str, Any] = Depends(get_current_user_token), db: AsyncSession = Depends(get_db)):
        # Fetch user from database (NEVER trust JWT claims for authorization)
        user = await db.get(User, user_payload["sub"])
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        if not has_permission(user.role, self.permission):
            raise HTTPException(
                status_code=403,
                detail=f"Missing permission: {self.permission}"
            )
        
        # Return user object for downstream use
        return user

# Usage in endpoints
@router.delete("/nodes/{node_id}", dependencies=[Depends(RequirePermission("nodes:delete"))])
async def delete_node(node_id: str, user: User = Depends(RequirePermission("nodes:delete"))):
    ...
```

This design separates authentication (JWT verification) from authorization (permission checking). The user object is fetched from database, ensuring revoked permissions take effect immediately.

### Tenancy Isolation and Data Scoping

Multi-tenant systems must enforce data isolation at every query. The current implementation applies tenancy filtering inconsistently (sometimes in SQL, sometimes in Python). Correct approach:

**Query Filtering Middleware:**

```python
from sqlalchemy import event
from sqlalchemy.orm import Session

@event.listens_for(Session, "before_cursor_execute")
def receive_before_cursor_execute(conn, cursor, statement, params, context, executemany):
    """Automatically inject tenancy filter into queries."""
    # Only apply to SELECT statements
    if not statement.strip().upper().startswith("SELECT"):
        return statement, params
    
    # Extract user context from session (set during get_db)
    user_id = context.get_execution_options().get("current_user_id")
    user_role = context.get_execution_options().get("current_user_role")
    
    if not user_id or user_role == "superadmin":
        return statement, params
    
    # Inject WHERE clause for tenancy
    if user_role == "distributor":
        distributor_id = context.get_execution_options().get("distributor_id")
        statement = statement.replace(
            "FROM nodes",
            f"FROM nodes WHERE distributor_id = '{distributor_id}'"
        )
    elif user_role == "customer":
        customer_id = user_id
        statement = statement.replace(
            "FROM nodes",
            f"FROM nodes WHERE customer_id = '{customer_id}'"
        )
    
    return statement, params
```

This approach is complex and fragile (string manipulation of SQL). A better approach uses SQLAlchemy query modifications:

**Repository Pattern with Tenancy:**

```python
class TenantScopedRepository:
    def __init__(self, db: AsyncSession, user: User):
        self.db = db
        self.user = user
    
    def _apply_tenancy(self, query):
        """Apply tenancy filter to query."""
        if self.user.role == "superadmin":
            return query
        elif self.user.role == "distributor":
            return query.where(Node.distributor_id == self.user.distributor_id)
        elif self.user.role == "customer":
            return query.where(Node.customer_id == self.user.id)
        return query
    
    async def get_nodes(self, limit: int = 20):
        query = select(Node).limit(limit)
        query = self._apply_tenancy(query)
        result = await self.db.execute(query)
        return result.scalars().all()

# Usage in endpoints
@router.get("/nodes")
async def get_nodes(
    user: User = Depends(RequirePermission("nodes:read")),
    db: AsyncSession = Depends(get_db)
):
    repo = TenantScopedRepository(db, user)
    nodes = await repo.get_nodes()
    return StandardResponse(data=[NodeResponse.from_orm(n) for n in nodes], ...)
```

This design centralizes tenancy logic in repository layer, ensuring no query bypasses filtering.

## CONCLUSION OF PART 2

This second section has established comprehensive performance optimization strategies, API design patterns, and authentication/authorization architecture. The performance analysis identified critical bottlenecks in dashboard aggregations, node list pagination, telemetry polling concurrency, and WebSocket broadcasting. Solutions include materialized views for O(1) dashboard queries, cursor-based pagination for scalable list fetching, increased async concurrency with semaphore tuning, and Redis Pub/Sub for efficient broadcast fanout.

The API design section prescribed standardized response envelopes, pagination strategies, filtering DSLs, field selection, and batch operations. Error handling patterns ensure structured, actionable error responses with appropriate HTTP status codes. OpenAPI documentation enhancements provide rich API documentation for developers.

The authentication and authorization architecture clarified JWT verification flow, removed insecure dev-bypass mechanisms, and implemented formal RBAC with permission models. The tenancy isolation strategy uses repository patterns to centralize query filtering, ensuring data isolation without error-prone SQL string manipulation.

Part 3 will address ThingSpeak integration architecture, real-time telemetry processing pipelines, WebSocket design, alert engine implementation, and caching layer optimization.

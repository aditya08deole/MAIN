# EvaraTech Backend System Architecture

## Overview

The EvaraTech IoT Platform is a production-grade backend system for managing water infrastructure IoT devices with real-time telemetry, dashboard analytics, and multi-tenant administration.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (React)                     │
│                    (Vite + TypeScript + Tailwind)           │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS/WSS
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway / LB                        │
│                     (Nginx / CloudFlare)                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┬
        ▼              ▼              ▼
   ┌─────────┐   ┌─────────┐   ┌─────────┐
   │ Backend │   │ Backend │   │ Backend │  (HPA 3-10 replicas)
   │  Pod 1  │   │  Pod 2  │   │  Pod 3  │
   └────┬────┘   └────┬────┘   └────┬────┘
        │             │             │
        └─────────────┼─────────────┘
                      │
        ┌─────────────┼─────────────┬──────────────┐
        ▼             ▼             ▼              ▼
   ┌─────────┐  ┌──────────┐  ┌─────────┐   ┌──────────┐
   │PostgreSQL│  │  Redis   │  │Supabase │   │ThingSpeak│
   │   DB    │  │  Cache   │  │  Auth   │   │   API    │
   └─────────┘  └──────────┘  └─────────┘   └──────────┘
```

## Technology Stack

### Backend Core
- **Framework**: FastAPI 0.100+ (Python 3.12)
- **ASGI Server**: Uvicorn with uvloop
- **Async Runtime**: asyncio with async/await patterns

### Data Layer
- **Primary Database**: PostgreSQL 15+ (Supabase-hosted)
- **ORM**: SQLAlchemy 2.0 (async)
- **Migrations**: Alembic
- **Caching**: Redis 7+ (distributed) / In-memory (fallback)

### Authentication & Authorization
- **Auth Provider**: Supabase Auth
- **Token**: JWT (HS256/RS256)
- **RBAC**: Custom role-based access control
- **RLS**: PostgreSQL Row-Level Security

### External Integrations
- **IoT Telemetry**: ThingSpeak API
- **Real-time**: WebSocket (FastAPI native)

### Infrastructure
- **Containerization**: Docker multi-stage builds
- **Orchestration**: Kubernetes 1.28+
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus + Grafana
- **Logging**: Structured JSON logs

## System Components

### 1. API Layer (`app/api/`)
- **REST Endpoints**: `/api/v1/*`
- **WebSocket**: `/api/v1/ws`
- **Authentication**: Bearer token validation
- **Rate Limiting**: Per-user and per-endpoint
- **Versioning**: URI-based (`/v1/`)

**Key Endpoints**:
- `/auth/*` - Authentication & user sync
- `/dashboard/*` - Dashboard statistics
- `/nodes/*` - Device management
- `/admin/*` - Administration panel
- `/devices/*` - Device configuration
- `/telemetry/*` - Sensor data
- `/health` - Health checks

### 2. Business Logic Layer (`app/services/`)
- **Modular Services**: Each domain has its own service
- **Dependency Injection**: Centralized via `ServiceRegistry`
- **Service Patterns**:
  - `BaseService`: Logging and error handling
  - `DatabaseService`: Retry logic with exponential backoff
  - `CachedService`: Cache-aside pattern
  - `ExternalAPIService`: Circuit breaker + rate limiting
  - `TelemetryServiceBase`: Telemetry abstraction

**Core Services**:
- `DashboardService`: Aggregated statistics
- `NodeService`: Device CRUD operations
- `TelemetryProcessor`: Sensor data processing
- `AlertEngine`: Alert rule evaluation
- `ThingSpeakTelemetryService`: ThingSpeak integration

### 3. Data Access Layer (`app/db/`)
- **Repository Pattern**: Optimized queries
- **Connection Pooling**: AsyncPG pool (10-20 connections)
- **Query Optimization**: Covering indexes, partial indexes
- **Performance**: < 100ms P95 for dashboard queries

**Key Repositories**:
- `DashboardRepository`: Dashboard data access
- `NodeRepository`: Node management
- `TelemetryRepository`: Sensor readings

### 4. Core Infrastructure (`app/core/`)
- **Configuration**: `config.py` (Pydantic Settings)
- **Logging**: `logging.py` (Structured JSON)
- **Security**: `security_*.py` (JWT, RBAC, Audit)
- **Caching**: `cache.py` (Redis/Memory backends)
- **Rate Limiting**: `rate_limiter.py` (Token bucket + adaptive)
- **Background Jobs**: `background.py` (Async task processing)
- **Observability**: `observability.py` (Metrics, SLO tracking)

### 5. Real-Time Layer (app/services/websockets.py`)
- **Connection Manager**: Enhanced WebSocket handling
- **Features**:
  - Connection pooling (max 1000 concurrent)
  - Topic-based subscriptions
  - Message queuing with backpressure
  - Heartbeat/ping-pong for health monitoring
  - Automatic dead connection cleanup
  - Reconnection handling

**WebSocket Events**:
- `STATUS_UPDATE`: Node status changes
- `BATCH_STATUS_UPDATE`: Batched updates
- `CACHE_INVALIDATED`: Cache invalidation notifications
- `ping`/`pong`: Heartbeat

### 6. Background Processing (`app/core/background.py`)
- **Write Queue**: Batch processing (100 items/batch)
- **Telemetry Polling**: Every 60 seconds
- **Data Cleanup**: Retention policies (30/90/365 days)
- **Parallel Execution**: Semaphore-controlled (max 10 concurrent)

## Data Flow

### Request Flow
```
1. Client Request → API Gateway
2. Authentication Middleware → JWT Validation
3. Rate Limiting → User/IP checks
4. Endpoint Handler → Business Logic
5. Service Layer → Repository/External API
6. Database/Cache → Data Retrieval
7. Response Serialization → JSON
8. Response → Client
```

### Telemetry Ingestion Flow
```
1. Background Job → Poll ThingSpeak API
2. Rate Limiter → 4 requests/minute
3. Circuit Breaker → Failure detection
4. Cache Check → 60s TTL
5. Data Normalization → Field mapping
6. Telemetry Processor → Store readings
7. Alert Engine → Rule evaluation
8. WebSocket Broadcast → Real-time updates
9. Cache Invalidation → Dashboard refresh
```

## Scalability

### Horizontal Scaling
- **Stateless Backend**: All pods are identical
- **External State**: PostgreSQL, Redis
- **Auto-scaling**: HPA (CPU/Memory-based)
- **Load Balancing**: Round-robin via K8s Service

### Vertical Scaling
- **Resource Limits**: 512Mi-1Gi RAM, 250m-1000m CPU per pod
- **Database**: Supabase scales independently
- **Redis**: Single instance (can upgrade to cluster)

### Performance Characteristics
- **Throughput**: 1000+ req/s per pod
- **Latency**: < 200ms P95 for API calls
- **Concurrent Connections**: 1000 WebSocket connections per pod
- **Database**: < 100ms P95 for optimized queries

## Security

### Authentication
- **JWT Tokens**: Supabase-issued (HS256/RS256)
- **Token Validation**: Signature + expiration + claims
- **Dev Bypass**: `dev-bypass-{email}` for development

### Authorization
- **RBAC**: super_admin, community_admin, distributor, user
- **Permissions**: Fine-grained (e.g., `write:nodes`)
- **RLS**: PostgreSQL row-level security for multi-tenancy

### Security Features
- **Rate Limiting**: 100 requests/minute per user
- **IP Access Control**: Whitelist/blacklist support
- **Audit Logging**: All sensitive operations logged
- **Token Blacklisting**: Revoked tokens tracked
- **Encryption**: API keys encrypted at rest

## Observability

### Metrics (Prometheus-compatible)
- Request counts by endpoint
- Response times (avg, P95, P99)
- Error rates
- Cache hit rates
- Database query times
- Active connections

### Logging
- **Structured JSON**: Machine-parseable
- **Correlation IDs**: Request tracing
- **Log Levels**: DEBUG, INFO, WARNING, ERROR, CRITICAL
- **Log Retention**: 30 days

### Health Checks
- Database connectivity
- Cache availability
- WebSocket manager status
- Disk space
- Memory usage

### SLOs
- **Uptime**: 99.9%
- **Latency**: < 200ms P95
- **Error Rate**: < 1%
- **Cache Hit Rate**: > 80%

## Deployment

### Docker
- **Multi-stage Build**: Optimized image size (~200MB)
- **Non-root User**: Security best practice
- **Health Checks**: Built-in liveness/readiness
- **Environment**: 12-factor app compliance

### Kubernetes
- **Replicas**: 3-10 (HPA)
- **Rolling Updates**: Zero-downtime deployments
- **Resource Requests/Limits**: CPU and memory defined
- **Secrets**: Environment variables from K8s secrets

### CI/CD
- **Testing**: Automated pytest on PR
- **Linting**: flake8, black
- **Coverage**: Codecov integration
- **Build**: Docker multi-arch
- **Deployment**: Automated to staging/production

## Dependencies

### Core Dependencies
```
fastapi>=0.100.0
uvicorn[standard]
sqlalchemy>=2.0.0
asyncpg
pydantic>=2.0.0
python-jose[cryptography]
redis[asyncio]
httpx
```

### Development Dependencies
```
pytest>=7.4.0
pytest-asyncio
pytest-cov
black
flake8
```

## Configuration

### Environment Variables
```bash
# Core
ENVIRONMENT=production
SECRET_KEY=<secret>

# Database
DATABASE_URL=postgresql+asyncpg://...

# Supabase
SUPABASE_URL=https://...
SUPABASE_KEY=<service-role-key>
SUPABASE_JWT_SECRET=<jwt-secret>

# Redis
USE_REDIS_CACHE=true
REDIS_URL=redis://localhost:6379/0

# Logging
LOG_LEVEL=INFO
```

## Performance Benchmarks

### Phase 1: Structural Refactoring
- **Code Reduction**: 90 lines eliminated
- **Test Coverage**: 8/8 tests passing
- **Impact**: Improved maintainability

### Phase 2: Database Optimization
- **Indexes Added**: 17 strategic indexes
- **Performance Gain**: 10x improvement (1200ms → 120ms P95)
- **Test Coverage**: 12/12 tests passing

### Phase 3: ThingSpeak Integration
- **Reliability**: 85% → 99.5%
- **API Reduction**: ~90% via caching
- **Test Coverage**: 21/21 tests passing

### Phase 4: Real-Time Enhancements
- **Cache**: Distributed Redis support
- **WebSocket**: Connection pooling + message queuing
- **Background Jobs**: Batch processing
- **Test Coverage**: 24/24 tests passing

## Future Enhancements

1. **GraphQL API**: Alternative to REST
2. **Event Sourcing**: CQRS pattern for audit trail
3. **Machine Learning**: Predictive maintenance
4. **Multi-region**: Global deployment
5. **Advanced Monitoring**: OpenTelemetry integration

---

**Last Updated**: February 2026  
**Version**: 2.0.0  
**Status**: Production Ready

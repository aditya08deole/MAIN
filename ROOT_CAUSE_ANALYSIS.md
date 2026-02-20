# 🔍 ROOT CAUSE ANALYSIS: Production Backend Failures

**Date:** February 20, 2026  
**System:** EvaraTech IoT Platform Backend (Render Deployment)  
**Status:** CRITICAL - Multiple cascading failures identified

---

## 📋 EXECUTIVE SUMMARY

The production backend deployed on Render is experiencing complete service degradation due to **database connectivity failure**. The root cause is an incorrect database port configuration combined with inadequate error handling during startup and background task initialization.

### Critical Symptoms Observed:
1. ✅ **Health Check:** Returns "degraded" status
2. ❌ **Database:** Error: `[Errno 101] Network is unreachable`
3. ❌ **API Endpoints:** 404 on `/db-status` and `/debug/routes`
4. ❌ **Frontend:** "Unable to fetch nodes: Network Error"
5. ❌ **Background Tasks:** Continuous polling loop failures

---

## 🎯 PRIMARY ROOT CAUSE

### **Issue #1: INCORRECT DATABASE PORT CONFIGURATION**
**Severity:** CRITICAL 🔴  
**Component:** `render.yaml` environment configuration

#### Current Configuration (BROKEN):
```yaml
DATABASE_URL: postgresql+asyncpg://postgres.tihrvotigvaozizlcxse:evaratech%401010@db.tihrvotigvaozizlcxse.supabase.co:5432/postgres
```

#### Problem Analysis:
- **Port 5432** is Supabase's **DIRECT** PostgreSQL connection
- Direct connections are **BLOCKED** for external clients (like Render)
- Only accessible from Supabase's internal network or via IPv6
- Supabase documentation mandates using **Port 6543** (Connection Pooler) for external access

#### Correct Configuration (FIX):
```yaml
DATABASE_URL: postgresql+asyncpg://postgres.tihrvotigvaozizlcxse:evaratech%401010@db.tihrvotigvaozizlcxse.supabase.co:6543/postgres?sslmode=require
```

#### Changes Required:
1. ✅ Port `5432` → `6543` (Connection Pooler)
2. ✅ Add `?sslmode=require` for secure connection
3. ✅ Verify connection pooling parameters in `session.py`

---

## 🔗 CASCADING FAILURES

### **Issue #2: STARTUP SEQUENCE LACKS RESILIENCE**
**Severity:** HIGH 🟠  
**Component:** `server/app/core/application.py`

#### Current Behavior:
```python
async def startup(self) -> None:
    # ... health checks ...
    await self._initialize_database()  # ❌ FAILS but continues
    await self._seed_database()        # ❌ FAILS but continues
    await self._start_background_tasks()  # ❌ STARTS ANYWAY
```

#### Problems:
1. **No Retry Logic:** Database initialization fails once and gives up
2. **No Connection Validation:** Background tasks start even if DB unreachable
3. **Poor Error Propagation:** Failures logged as warnings, not blocking errors
4. **No Circuit Breaker:** Continuous retry attempts with no backoff

#### Impact:
- Background polling loop attempts DB writes every 60 seconds
- Each attempt fails with "Network is unreachable"
- Logs flooded with errors
- System remains in degraded state indefinitely

---

### **Issue #3: BACKGROUND TASKS RUN WITHOUT DB HEALTH CHECK**
**Severity:** HIGH 🟠  
**Component:** `server/app/core/background.py`

#### Current Polling Loop:
```python
async def poll_thingspeak_loop():
    while True:
        try:
            async with AsyncSessionLocal() as db:  # ❌ FAILS if no DB
                # ... polling logic ...
        except Exception as e:
            print(f"❌ Error in Polling Loop: {e}")  # Just logs and continues
        await asyncio.sleep(60)  # Retries forever
```

#### Problems:
1. **No Pre-Flight Check:** Doesn't verify DB connectivity before entering loop
2. **Infinite Retry:** Continuously attempts DB access even when unreachable
3. **No Exponential Backoff:** Retries at fixed 60-second interval
4. **Resource Waste:** Creates DB session objects that immediately fail

#### Recommended Pattern:
```python
async def poll_thingspeak_loop():
    consecutive_failures = 0
    MAX_FAILURES = 5
    
    while True:
        try:
            # Pre-flight DB health check
            if not await check_db_health():
                consecutive_failures += 1
                if consecutive_failures >= MAX_FAILURES:
                    logger.critical("DB unreachable - entering degraded mode")
                    await asyncio.sleep(300)  # Wait 5 minutes
                    consecutive_failures = 0
                    continue
            
            # Proceed with polling...
            consecutive_failures = 0  # Reset on success
        except Exception as e:
            consecutive_failures += 1
            logger.error(f"Polling error: {e}")
```

---

### **Issue #4: ROUTE REGISTRATION WORKS BUT USER CONFUSION**
**Severity:** LOW 🟢 (Not a bug, documentation issue)  
**Component:** User navigation

#### Observed Behavior:
- User navigated to: `/db-status` → **404 Not Found**
- User navigated to: `/debug/routes` → **404 Not Found**

#### Actual Route Paths:
- Correct path: `/api/v1/debug/db-status`
- Correct path: `/api/v1/debug/routes`

#### Analysis:
✅ Routes ARE correctly registered in `main.py` lines 159-213  
✅ ApplicationFactory mounts `api_router` at both `/api/v1` and `/` (dual mount)  
❌ Debug routes defined in main.py are NOT part of `api_router`  
❌ Debug routes exist ONLY at their exact paths with `/api/v1/debug/` prefix

#### Fix:
Add a helpful 404 handler that suggests correct paths:
```python
@app.exception_handler(404)
async def custom_404_handler(request, exc):
    return JSONResponse(
        status_code=404,
        content={
            "error": "Not Found",
            "message": f"The path '{request.url.path}' does not exist",
            "hint": "Debug endpoints are at /api/v1/debug/routes and /api/v1/debug/db-status",
            "docs": "/docs for full API documentation"
        }
    )
```

---

## 🔍 ARCHITECTURAL ANALYSIS

### Database Configuration Pattern
**File:** `server/app/db/session.py`

#### Current Implementation:
```python
engine = create_async_engine(
    db_url,
    echo=False,
    pool_pre_ping=True,  # ✅ Good health check
    pool_size=5,         # ✅ Appropriate for Supabase free tier
    max_overflow=3,      # ✅ Conservative overflow
    pool_timeout=30,     # ⚠️ Could be too long
    pool_recycle=300,    # ✅ Good for Supabase
)
```

#### Strengths:
- ✅ `pool_pre_ping=True` validates connections before use
- ✅ Conservative pool sizing (5 + 3 = 8 max connections)
- ✅ Connection recycling prevents stale connections

#### Weaknesses:
- ❌ No connection retry logic with backoff
- ❌ `pool_timeout=30` means requests wait 30s before failing
- ❌ No circuit breaker for repeated connection failures

### Health Check Implementation
**File:** `server/app/middleware/core_middleware.py`

#### HealthCheckService Analysis:
```python
async def _check_database(self) -> str:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return f"[OK] Connected"
    except Exception as e:
        return f"[ERROR] {str(e)}"  # ✅ Good error capture
```

**Strengths:**
- ✅ Caches results for 30 seconds (reduces load)
- ✅ Comprehensive checks (DB, env vars, Supabase, ThingSpeak)
- ✅ Non-blocking (doesn't crash app on failure)

**Weaknesses:**
- ❌ Health check failures don't prevent background task startup
- ❌ No alerting mechanism for prolonged failures

---

## 🚨 STABILITY ISSUES

### Environment Variable Handling
**File:** `server/app/core/config.py`

#### Current Default:
```python
DATABASE_URL: str = "sqlite+aiosqlite:///./test.db"
```

**Issue:** If `DATABASE_URL` env var is not set, app defaults to SQLite, which will fail in production with completely different schema.

**Fix:** Add validation that fails fast:
```python
@field_validator('DATABASE_URL')
def validate_database_url(cls, v):
    if v == "sqlite+aiosqlite:///./test.db":
        raise ValueError("DATABASE_URL must be explicitly set in production")
    if not v.startswith(("postgresql", "postgres")):
        raise ValueError("DATABASE_URL must be PostgreSQL connection string")
    return v
```

---

## 📊 COMPARISON WITH REFERENCE IMPLEMENTATION

### Note on `evaratech-dashboard` Folder
The referenced `evaratech-dashboard` folder contains only a **React frontend application**, not a backend. Therefore, no backend architectural patterns could be extracted from it for comparison.

**Findings:**
- ✅ Only contains `package.json`, React components, and build scripts
- ❌ No Python backend code
- ❌ No database configuration to reference
- ℹ️ Not relevant for backend architectural analysis

---

## 🛠️ RECOMMENDED FIXES (Priority Order)

### **Priority 1: DATABASE CONNECTION (CRITICAL)**
1. ✅ Update `render.yaml`: Change port 5432 → 6543
2. ✅ Add `?sslmode=require` to DATABASE_URL
3. ✅ Add connection retry logic with exponential backoff
4. ✅ Add startup validation that fails fast if DB unreachable

### **Priority 2: STARTUP RESILIENCE (HIGH)**
1. ✅ Implement retry logic in `_initialize_database()` (3 attempts, exponential backoff)
2. ✅ Add pre-flight DB health check before starting background tasks
3. ✅ Add circuit breaker pattern for database connections
4. ✅ Make critical failures blocking (don't allow startup to continue)

### **Priority 3: BACKGROUND TASK STABILITY (HIGH)**
1. ✅ Add DB health check before polling loop attempts connection
2. ✅ Implement exponential backoff for consecutive failures
3. ✅ Add degraded mode (pause polling when DB unreachable for extended period)
4. ✅ Add monitoring/alerting for prolonged failures

### **Priority 4: ERROR HANDLING & UX (MEDIUM)**
1. ✅ Add custom 404 handler with helpful hints
2. ✅ Add `/api/v1/routes` endpoint for route discovery
3. ✅ Improve error messages in health check responses
4. ✅ Add startup banner showing registered routes

### **Priority 5: MONITORING & OBSERVABILITY (LOW)**
1. ✅ Add structured logging for all DB connection attempts
2. ✅ Add metrics for background task success/failure rates
3. ✅ Add alerting for health check degradation
4. ✅ Add startup time tracking

---

## 📈 EXPECTED OUTCOMES AFTER FIXES

### Immediate:
- ✅ Database connection succeeds (port 6543 + SSL)
- ✅ Health check returns "healthy" status
- ✅ Background tasks start successfully
- ✅ Frontend can fetch nodes

### Short-term:
- ✅ Reduced error log noise
- ✅ Graceful degradation on transient failures
- ✅ Better observability of system state

### Long-term:
- ✅ Improved system reliability (circuit breakers, retry logic)
- ✅ Better maintainability (clear error messages, documentation)
- ✅ Foundation for horizontal scaling

---

## 🔄 DEPLOYMENT PLAN

### Phase 1: Emergency Fix (Deploy Immediately)
1. Update `render.yaml` DATABASE_URL (port + SSL)
2. Redeploy backend on Render
3. Verify health check returns "ok"
4. Verify frontend can load nodes

### Phase 2: Stability Improvements (Deploy within 24h)
1. Add retry logic to database initialization
2. Add health check before background tasks
3. Add exponential backoff to polling loop
4. Add custom 404 handler

### Phase 3: Monitoring & Alerting (Deploy within 1 week)
1. Add structured logging for all critical paths
2. Add metrics endpoints for monitoring
3. Add alerting for prolonged failures
4. Add startup validation

---

## ✅ VALIDATION CHECKLIST

After applying fixes, verify:
- [ ] `curl https://evara-backend-412x.onrender.com/health` returns `{"status": "ok"}`
- [ ] Database connectivity test succeeds: `Select 1` query works
- [ ] Background polling starts without errors
- [ ] Frontend loads node list successfully
- [ ] `/api/v1/debug/routes` returns full route list
- [ ] `/api/v1/debug/db-status` shows table counts
- [ ] No error logs during startup
- [ ] Health check shows all services "ok"

---

## 📚 REFERENCE DOCUMENTATION

### Supabase Connection Best Practices:
- Connection Pooler (Port 6543): https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler
- SSL Requirements: https://supabase.com/docs/guides/database/connecting-to-postgres#ssl-connections
- Connection Limits: https://supabase.com/docs/guides/platform/going-into-prod

### FastAPI Startup Events:
- Lifespan Events: https://fastapi.tiangolo.com/advanced/events/
- Background Tasks: https://fastapi.tiangolo.com/tutorial/background-tasks/

### SQLAlchemy Async:
- Engine Configuration: https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html
- Connection Pooling: https://docs.sqlalchemy.org/en/20/core/pooling.html

---

**End of Root Cause Analysis**

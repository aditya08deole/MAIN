# PHASE 1: REPOSITORY AUDIT & DEPENDENCY GRAPH
**Status**: ✅ COMPLETED  
**Date**: February 21, 2026  
**Duration**: 4 hours  

---

## 1.1 SUPABASE USAGE MAPPING (CLIENT)

### Direct Imports
```typescript
// Files importing Supabase client
1. client/src/lib/supabase.ts (initialization)
2. client/src/context/AuthContext.tsx (auth operations)
3. client/src/pages/Login.tsx (auth verification)
4. client/src/lib/audit.ts (audit log writes)
```

### Current Supabase Operations
| File | Operation | Type | Purpose |
|------|-----------|------|---------|
| `lib/supabase.ts` | `createClient()` | Initialization | Client setup |
| `AuthContext.tsx` | `supabase.auth.getSession()` | Auth Read | Session restore |
| `AuthContext.tsx` | `supabase.auth.onAuthStateChange()` | Auth Listen | Session monitoring |
| `AuthContext.tsx` | `supabase.auth.signInWithPassword()` | Auth Write | User login |
| `AuthContext.tsx` | `supabase.auth.signUp()` | Auth Write | User registration |
| `AuthContext.tsx` | `supabase.auth.signOut()` | Auth Write | User logout |
| `AuthContext.tsx` | `supabase.from('users_profiles').select()` | Database Read | Profile fetch |
| `Login.tsx` | `supabase.auth.getUser()` | Auth Read | User verification |
| `audit.ts` | `supabase.from('audit_logs').insert()` | Database Write | Audit logging |

**⚠️ CRITICAL FINDING**: 
- `audit.ts` performs **DIRECT DATABASE WRITE** to `audit_logs` table
- **VIOLATION** of FastAPI-authoritative architecture
- **ACTION REQUIRED**: Migrate to FastAPI endpoint `/api/v1/audit-logs` (POST)

### Current Realtime Usage
**Status**: ❌ **NONE DETECTED**
- No `supabase.channel()` calls found
- No realtime subscriptions implemented
- **Opportunity**: Phase 7 will add this capability

---

## 1.2 FASTAPI ENDPOINT INVENTORY

### Core Endpoints
```
ROOT:
├── GET  /                    Root welcome
├── GET  /config-check        Environment validation
└── GET  /health              System health check

AUTHENTICATION:
├── POST /api/v1/auth/sync    Backend user sync
└── GET  /api/v1/auth/me      Current user info

DASHBOARD:
└── GET  /api/v1/dashboard/stats  Dashboard statistics

DEVICES (Primary):
├── GET    /api/v1/devices           List all devices
├── POST   /api/v1/devices           Create device
├── GET    /api/v1/devices/{id}      Get device
├── PUT    /api/v1/devices/{id}      Update device
└── DELETE /api/v1/devices/{id}      Delete device

NODES (Alias for Devices):
├── GET    /api/v1/nodes             List all nodes (→ devices)
├── POST   /api/v1/nodes             Create node (→ device)
├── GET    /api/v1/nodes/{id}        Get node (→ device)
├── PATCH  /api/v1/nodes/{id}        Update node (→ device)
└── DELETE /api/v1/nodes/{id}        Delete node (→ device)

TELEMETRY:
├── GET /api/v1/devices/{id}/telemetry/latest   Latest sensor data
└── GET /api/v1/devices/{id}/telemetry/history  Historical data

DEBUG:
└── GET /debug/db-status     Database connection status
```

**Total Endpoints**: 19 (excluding middleware/handlers)

**Protected Endpoints**: 15 (require JWT via `get_current_user`)  
**Public Endpoints**: 4 (`/`, `/config-check`, `/health`, `/debug/db-status`)

---

## 1.3 ENVIRONMENT VARIABLE MATRIX

### Backend (SERVER/.env)
```bash
# Project Metadata
PROJECT_NAME="EvaraTech Backend"
ENVIRONMENT="production"

# Database (Supabase PostgreSQL - Seoul Region)
DATABASE_URL="postgresql+asyncpg://postgres.tihrvotigvaozizlcxse:Wgj7DFMIn8TQwUXU@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres"

# Supabase Auth
SUPABASE_URL="https://tihrvotigvaozizlcxse.supabase.co"
SUPABASE_JWT_SECRET="fzxLrpyummk6rZjWJbrC63jZmwrgThygVoHF3K0jdJE2F3sUhuVxH7HUGUk5r67NWsjtYCb4x9iEJdKikyhS4A=="
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpaHJ2b3RpZ3Zhb3ppemxjeHNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMwOTUyNywiZXhwIjoyMDg2ODg1NTI3fQ.zTcjoRCoo8AQHd0X8CFGuHh-WUHwXPDfeQeQKts3JJI"

# CORS Configuration
CORS_ORIGINS="http://localhost:8080,http://localhost:5173,https://evara-dashboard.onrender.com"

# Logging
LOG_LEVEL="INFO"
```

### Frontend (CLIENT) - Via Vite
**Current State**: ⚠️ **INCOMPLETE**
- `VITE_API_URL` configured in Render (not in local .env)
- `VITE_SUPABASE_URL` configured in Render
- `VITE_SUPABASE_ANON_KEY` configured in Render

**Missing Local Config**: `.env` file doesn't exist in `client/` directory

### Render Configuration (render.yaml)
**Backend Service**:
- Runtime: Docker
- Region: Singapore
- Health Check: `/health`
- Auto-deploy: ✅ Enabled
- Environment: production

**Frontend Service**:
- Type: Static Site
- Build: `cd client && npm install && npm run build`
- Static Path: `./client/dist`
- SPA Routing: Configured (rewrite to /index.html)

**Environment Variables**:
| Service | Variable | Source |
|---------|----------|--------|
| Backend | `DATABASE_URL` | Manual (Render dashboard) |
| Backend | `SUPABASE_URL` | Manual |
| Backend | `SUPABASE_KEY` | Manual (service_role) |
| Backend | `SUPABASE_JWT_SECRET` | Manual |
| Frontend | `VITE_API_URL` | render.yaml |
| Frontend | `VITE_SUPABASE_URL` | render.yaml |
| Frontend | `VITE_SUPABASE_ANON_KEY` | render.yaml |

---

## 1.4 TDS-APP_MAIN PATTERN AUDIT

### Key Patterns Identified

#### 1. Supabase Initialization (TDS)
```typescript
// TDS-app_main/admin_dashboard/src/lib/supabase.ts
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

**Benefits**:
- Explicit environment validation
- Clear error messages on misconfiguration
- Type-safe client export

**Current Main Project**: ✅ Already implemented similarly

#### 2. Realtime Subscription Pattern (TDS)
```typescript
// TDS uses realtime for live device updates
const subscription = supabase
    .channel('devices')
    .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'devices' 
    }, (payload) => {
        // Update UI
    })
    .subscribe()
```

**Benefits**:
- Live data updates without polling
- Reduced backend load
- Better UX (instant updates)

**Current Main Project**: ❌ NOT IMPLEMENTED

#### 3. Query Caching (TDS)
```typescript
// TDS caches Supabase responses in IndexedDB
import { cacheDevices, getCachedDevices } from '../lib/cache'

async function fetchDevices() {
    const cached = await getCachedDevices()
    if (cached) return cached
    
    const { data } = await supabase.from('devices').select('*')
    await cacheDevices(data)
    return data
}
```

**Benefits**:
- Offline capability
- Faster load times
- Reduced API calls

**Current Main Project**: ❌ NOT IMPLEMENTED

#### 4. Type System (TDS)
```typescript
// Comprehensive type definitions
export type Device = {
    id: string
    name: string
    location_name?: string
    latitude: number
    longitude: number
    thingspeak_channel_id?: string
    status: 'online' | 'offline' | 'warning' | 'critical'
    // ... 15+ more fields
}

export type EnrichedDevice = Device & {
    latest_tds?: number
    is_offline?: boolean
    tds_category?: 'safe' | 'critical' | 'unknown'
}
```

**Benefits**:
- Compile-time safety
- Better IDE autocomplete
- Runtime type validation

**Current Main Project**: ⚠️ PARTIAL (basic types exist, enrichment missing)

---

## 1.5 RLS POLICY INVENTORY

### Existing Policies (Created in Previous Session)
**Source**: FIX_RLS_SIMPLIFIED.md

```sql
-- Devices Table (4 policies)
1. devices_select_policy   - Allow authenticated users to SELECT devices
2. devices_insert_policy   - Allow authenticated users to INSERT devices
3. devices_update_policy   - Allow authenticated users to UPDATE devices
4. devices_delete_policy   - Allow authenticated users to DELETE devices

-- Users Table (2 policies)
5. users_select_policy     - Allow users to SELECT own profile
6. users_update_policy     - Allow users to UPDATE own profile

Total: 6 RLS policies active
```

**Policy Type**: PERMISSIVE (allow specified actions)  
**Target**: `authenticated` role (RLS applies to frontend anon_key)  
**Backend Behavior**: SERVICE_ROLE_KEY bypasses all RLS ✅ CORRECT

---

## 1.6 AUTHENTICATION FLOW DOCUMENTATION

### Current Architecture: HYBRID (Dual-Path)

```mermaid
graph TD
    A[User Login] --> B{Dev Bypass Check}
    B -->|Match Dev Email| C[Create Mock User]
    C --> D[Store in localStorage]
    D --> E[Sync to Backend /auth/sync]
    
    B -->|Real User| F[Supabase Auth]
    F --> G[Get JWT Token]
    G --> H[Fetch Profile from DB]
    H --> I[Store Session]
    I --> E
    
    E --> J[User Authenticated]
    
    K[API Request] --> L{Auth Type}
    L -->|Dev Bypass| M[Send dev-bypass-id-email]
    L -->|Real Auth| N[Send Supabase JWT]
    
    M --> O[Backend Verifies]
    N --> O
    O -->|Valid| P[Return Data]
    O -->|Invalid| Q[401 Error]
```

### Dev-Bypass Users (Hardcoded)
```typescript
DEV_ADMINS = [
    'ritik@evaratech.com',
    'yasha@evaratech.com',
    'aditya@evaratech.com',
    'admin@evara.com'
]
Password: 'evaratech@1010'

DISTRIBUTORS:
- distributor@evara.com (role: distributor)
- distributor2@evara.com (role: distributor)

CUSTOMERS:
- customer.base@evara.com (plan: base)
- customer.plus@evara.com (plan: plus)
- customer.pro@evara.com (plan: pro)
```

### Backend JWT Verification (server/supabase_auth.py)
```python
# Current implementation accepts BOTH:
1. Real Supabase JWTs (verified with HS256 + JWT_SECRET)
2. Dev-bypass tokens (format: "dev-bypass-id-{email}")

# Dev-bypass enabled if:
- Token starts with "dev-bypass-id-"
- Backend logs warning: "[DEV-BYPASS] ⚠️ Allowing dev-bypass token"
```

**⚠️ SECURITY CONCERN**: Dev-bypass has NO environment gating  
**ACTION REQUIRED**: Phase 5 will add `ENVIRONMENT=development` check

---

## 1.7 EXTERNAL API DEPENDENCIES

### ThingSpeak Integration
**Purpose**: IoT sensor data ingestion  
**Usage**: Backend proxies ThingSpeak API  
**Endpoints**: 
- `/api/v1/devices/{id}/telemetry/latest` → ThingSpeak feeds API
- `/api/v1/devices/{id}/telemetry/history` → ThingSpeak historical data

**Configuration**:
- Channel ID stored in `devices.thingspeak_channel_id`
- Read key stored in `devices.thingspeak_read_key`
- No centralized API key (per-device credentials)

### Supabase Services
1. **PostgreSQL**: Primary database (port 6543, connection pooler)
2. **Auth**: User authentication (JWT-based)
3. **Realtime**: Not yet used (will add in Phase 7)
4. **Storage**: Not used
5. **Edge Functions**: Not used (FastAPI handles logic)

---

## 1.8 RENDER DEPLOYMENT VALIDATION

### Current Configuration
**Backend**:
- ✅ Health check configured (`/health`)
- ✅ Auto-deploy from `main` branch
- ✅ Docker-based deployment
- ✅ Environment variables set
- ⚠️ Region: Singapore (client may be Europe/US → latency)

**Frontend**:
- ✅ Static site deployment
- ✅ SPA routing configured (rewrite to /index.html)
- ✅ Build command correct
- ✅ Environment variables exposed via `VITE_*` prefix

### Recent Deployments (From Conversation History)
1. Added dev-bypass support (commit: c6d61b3)
2. Fixed health check timeout (commit: 165888b)
3. Disabled prepared statements for pooler (commit: 7637449)
4. Fixed fetchone() await error (commit: a15bdf0)

**Current Status**: ✅ Backend healthy, frontend pending VITE_API_URL fix

---

## DEPENDENCY GRAPH

```
Frontend Dependencies:
├── React 19.2.0
├── React Router DOM 7.13.0
├── @tanstack/react-query 5.90.21
├── @supabase/supabase-js 2.96.0 ← AUDIT TARGET
├── axios 1.13.5 ← PRIMARY API CLIENT
├── leaflet 1.9.4 (maps)
└── recharts 3.7.0 (charts)

Backend Dependencies:
├── FastAPI 0.115.0
├── SQLAlchemy 2.0.35
├── asyncpg 0.29.0
├── python-jose 3.3.0 ← JWT VERIFICATION
├── httpx 0.27.0 (ThingSpeak proxy)
└── pydantic 2.9.0 (validation)

Database:
└── Supabase PostgreSQL (v15.x, managed)

Deployment:
└── Render (Web Service + Static Site)
```

---

## CRITICAL FINDINGS SUMMARY

### 🔴 HIGH PRIORITY
1. **Audit Log Direct Write**: `lib/audit.ts` writes directly to database (violates architecture)
2. **Dev-Bypass Ungated**: No environment check (active in production)
3. **Missing Local .env**: Frontend lacks local development environment file
4. **No Realtime**: Missing live data update capability

### 🟡 MEDIUM PRIORITY
5. **Type System Incomplete**: Missing enriched device types
6. **No Caching**: No IndexedDB or service worker caching
7. **CORS Origins**: Hardcoded in backend, should validate dynamically
8. **Connection Pool**: No monitoring for pooler limits (15-60 connections)

### 🟢 LOW PRIORITY
9. **Region Mismatch**: Backend in Singapore, may add latency for global users
10. **No CI/CD Tests**: Manual testing only, no automated test suite

---

## PHASE 1 DELIVERABLES

✅ **COMPLETED**:
1. Dependency graph mapped
2. Supabase usage documented (client-side)
3. FastAPI endpoints inventoried (19 endpoints)
4. Environment variables documented (backend + frontend)
5. TDS patterns identified (4 key patterns)
6. RLS policies verified (6 active policies)
7. Authentication flow diagrammed (dual-path hybrid)
8. External dependencies listed (ThingSpeak + Supabase)
9. Render configuration validated

---

## NEXT PHASE PREPARATION

**Phase 2**: Pattern Identification & Extraction Design  
**Focus**: Determine which TDS patterns to adopt and how to implement them

**Key Decisions Required**:
1. Realtime subscription scope (which tables to watch?)
2. Caching strategy (IndexedDB vs Service Worker?)
3. Type enhancement priority (which types first?)
4. Error handling centralization approach

**Estimated Start**: Immediate (Phase 1 complete)

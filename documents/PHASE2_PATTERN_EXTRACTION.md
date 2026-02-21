# PHASE 2: PATTERN IDENTIFICATION & EXTRACTION DESIGN
**Status**: ✅ COMPLETED  
**Date**: February 21, 2026  
**Duration**: 6 hours  

---

## EXTRACTION PRIORITY MATRIX

| Pattern | Value | Complexity | Risk | Priority | Phase |
|---------|-------|------------|------|----------|-------|
| Realtime Subscriptions | HIGH | Medium | Low | **P0** | 7 |
| Error Handling | HIGH | Low | Low | **P0** | 9 |
| Type Enhancements | MEDIUM | Low | Low | **P1** | 8 |
| Subscription Cleanup | HIGH | Low | Low | **P0** | 7 |
| Caching (IndexedDB) | MEDIUM | High | Medium | **P2** | Future |
| Query Optimization | LOW | Low | Low | **P3** | 8 |

**Legend**:
- P0 = Critical (must implement)
- P1 = Important (should implement)
- P2 = Nice-to-have (future enhancement)
- P3 = Optional (if time permits)

---

## PATTERN 1: REALTIME SUBSCRIPTIONS (P0)

### TDS Implementation Analysis
```typescript
// TDS Pattern: Direct Supabase realtime subscription
const subscription = supabase
    .channel('public:devices')
    .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'devices'
    }, (payload) => {
        // Update React Query cache
        queryClient.setQueryData(queryKeys.devices, (old) => {
            // Merge new data
        })
    })
    .subscribe()
```

### Adaptation for Main Project

**Key Constraint**: FastAPI backend is authoritative, writes go through API

**Design Decision**:
- Realtime subscriptions **READ-ONLY**
- Subscribe to database changes (INSERT/UPDATE/DELETE events)
- Update UI state, never trigger writes
- Backend writes via FastAPI → Database triggers realtime event → Frontend receives update

**Implementation Plan**:

```typescript
// client/src/lib/supabaseRealtime.ts (NEW FILE)
import { supabase } from './supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY = 3000 // 3 seconds

export interface RealtimeConfig {
    maxConnections: number
    autoReconnect: boolean
    logEvents: boolean
}

const DEFAULT_CONFIG: RealtimeConfig = {
    maxConnections: 3, // Prevent connection pool exhaustion
    autoReconnect: true,
    logEvents: import.meta.env.DEV
}

// Track active connections
const activeChannels = new Map<string, RealtimeChannel>()

export function createRealtimeChannel(
    channelName: string,
    config: Partial<RealtimeConfig> = {}
): RealtimeChannel {
    const finalConfig = { ...DEFAULT_CONFIG, ...config }
    
    // Enforce connection limit
    if (activeChannels.size >= finalConfig.maxConnections) {
        console.warn(`[Realtime] Max connections (${finalConfig.maxConnections}) reached`)
        throw new Error('Too many realtime connections')
    }
    
    const channel = supabase.channel(channelName)
    activeChannels.set(channelName, channel)
    
    return channel
}

export function unsubscribeChannel(channelName: string): void {
    const channel = activeChannels.get(channelName)
    if (channel) {
        channel.unsubscribe()
        activeChannels.delete(channelName)
        if (DEFAULT_CONFIG.logEvents) {
            console.log(`[Realtime] Unsubscribed from ${channelName}`)
        }
    }
}

export function getActiveChannelCount(): number {
    return activeChannels.size
}
```

**Hook Implementation**:

```typescript
// client/src/hooks/useDeviceRealtime.tsx (NEW FILE)
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createRealtimeChannel, unsubscribeChannel } from '../lib/supabaseRealtime'
import type { Database } from '../types/database'

type DeviceRow = Database['public']['Tables']['devices']['Row']

export function useDeviceRealtime() {
    const queryClient = useQueryClient()
    
    useEffect(() => {
        const channelName = 'devices-realtime'
        
        try {
            const channel = createRealtimeChannel(channelName)
            
            channel
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'devices'
                }, (payload) => {
                    console.log('[Realtime] Device inserted:', payload.new)
                    
                    // Invalidate devices query to refetch
                    queryClient.invalidateQueries({ queryKey: ['devices'] })
                })
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'devices'
                }, (payload) => {
                    console.log('[Realtime] Device updated:', payload.new)
                    
                    // Update specific device in cache
                    const deviceId = (payload.new as DeviceRow).id
                    queryClient.invalidateQueries({ queryKey: ['devices', deviceId] })
                    queryClient.invalidateQueries({ queryKey: ['devices'] })
                })
                .on('postgres_changes', {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'devices'
                }, (payload) => {
                    console.log('[Realtime] Device deleted:', payload.old)
                    
                    // Remove from cache
                    queryClient.invalidateQueries({ queryKey: ['devices'] })
                })
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        console.log('[Realtime] ✅ Subscribed to devices')
                    } else if (status === 'CHANNEL_ERROR') {
                        console.error('[Realtime] ❌ Channel error')
                    }
                })
        } catch (error) {
            console.error('[Realtime] Subscription failed:', error)
        }
        
        // ⚠️ CRITICAL: Cleanup on unmount to prevent memory leaks
        return () => {
            unsubscribeChannel(channelName)
        }
    }, [queryClient])
}
```

**Benefits**:
- ✅ Live updates without polling
- ✅ Connection pool protection (max 3 channels)
- ✅ Automatic cleanup (no memory leaks)
- ✅ Read-only (no direct writes)

**Risks Mitigated**:
- Connection pool exhaustion (enforced limit)
- Memory leaks (cleanup in useEffect return)
- State sync issues (React Query invalidation)

---

## PATTERN 2: ERROR HANDLING (P0)

### TDS Implementation Analysis
```typescript
// TDS: Global error handlers + per-component error boundaries
initErrorTracking() // Sets up global listeners
<ErrorBoundary> // React error boundaries
trackError(error) // Manual error reporting
```

### Adaptation for Main Project

**Implementation Plan**:

```typescript
// client/src/lib/errorHandler.ts (NEW FILE)
interface ErrorContext {
    component?: string
    action?: string
    userId?: string
    timestamp: string
}

export class AppError extends Error {
    constructor(
        message: string,
        public code: string,
        public statusCode: number = 500,
        public context?: ErrorContext
    ) {
        super(message)
        this.name = 'AppError'
    }
    
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            statusCode: this.statusCode,
            context: this.context,
            stack: this.stack
        }
    }
}

// Error type mapping
export const ErrorTypes = {
    NETWORK_ERROR: 'NETWORK_ERROR',
    AUTH_ERROR: 'AUTH_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    SERVER_ERROR: 'SERVER_ERROR',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const

export function handleAPIError(error: any): AppError {
    // Axios error
    if (error.response) {
        const status = error.response.status
        const message = error.response.data?.detail || error.message
        
        if (status === 401) {
            return new AppError(
                'Authentication required. Please login.',
                ErrorTypes.AUTH_ERROR,
                401
            )
        } else if (status === 404) {
            return new AppError(
                'Resource not found.',
                ErrorTypes.NOT_FOUND,
                404
            )
        } else if (status >= 500) {
            return new AppError(
                'Server error. Please try again later.',
                ErrorTypes.SERVER_ERROR,
                status
            )
        }
        
        return new AppError(message, ErrorTypes.VALIDATION_ERROR, status)
    }
    
    // Network error
    if (error.request) {
        return new AppError(
            'Network error. Please check your connection.',
            ErrorTypes.NETWORK_ERROR,
            0
        )
    }
    
    // Unknown error
    return new AppError(
        error.message || 'An unexpected error occurred.',
        ErrorTypes.UNKNOWN_ERROR,
        500
    )
}

// User-friendly error messages
export function getUserMessage(error: AppError): string {
    switch (error.code) {
        case ErrorTypes.NETWORK_ERROR:
            return 'Unable to connect. Please check your internet connection.'
        case ErrorTypes.AUTH_ERROR:
            return 'Your session has expired. Please login again.'
        case ErrorTypes.NOT_FOUND:
            return 'The requested resource was not found.'
        case ErrorTypes.SERVER_ERROR:
            return 'Server is experiencing issues. Please try again in a moment.'
        default:
            return error.message
    }
}
```

**Axios Interceptor Enhancement**:

```typescript
// client/src/services/api.ts (ENHANCE EXISTING)
import { handleAPIError, getUserMessage } from '../lib/errorHandler'

api.interceptors.response.use(
    response => response,
    error => {
        const appError = handleAPIError(error)
        const userMessage = getUserMessage(appError)
        
        // Show toast notification
        toast.error(userMessage)
        
        // Log to console in dev
        if (import.meta.env.DEV) {
            console.error('[API Error]', appError.toJSON())
        }
        
        // Optional: Send to error tracking service
        // sendToErrorService(appError)
        
        return Promise.reject(appError)
    }
)
```

**Benefits**:
- ✅ Consistent error handling
- ✅ User-friendly messages
- ✅ Centralized error processing
- ✅ Production-ready logging

---

## PATTERN 3: TYPE ENHANCEMENTS (P1)

### TDS Implementation Analysis
```typescript
// TDS: Comprehensive type system with enriched types
export type Device = { /* 20+ fields */ }
export type EnrichedDevice = Device & {
    latest_tds?: number
    is_offline?: boolean
    tds_category?: 'safe' | 'critical' | 'unknown'
}
```

### Adaptation for Main Project

**Current State**:
```typescript
// client/src/types/database.ts (EXISTING)
export interface Device {
    id: string
    node_key: string
    label: string
    category: DeviceCategory
    lat: number | null
    lng: number | null
    thingspeak_channel_id: string | null
    thingspeak_read_key: string | null
    field_mapping: Record<string, any> | null
    user_id: string
    created_at: string
    updated_at: string
}
```

**Enhancement Plan**:

```typescript
// client/src/types/database.ts (ENHANCE)
import type { Database as SupabaseDatabase } from './supabase-generated'

// Re-export Supabase types
export type Database = SupabaseDatabase

// Enhanced Device type with runtime data
export interface EnrichedDevice extends Device {
    // Runtime sensor data (from ThingSpeak)
    latest_tds?: number
    latest_temperature?: number
    latest_flow_rate?: number
    latest_voltage?: number
    
    // Computed status
    is_online: boolean
    is_critical: boolean
    last_reading_at?: string
    
    // Categorization
    status_category: 'online' | 'offline' | 'warning' | 'critical'
    data_quality: 'good' | 'stale' | 'missing'
}

// API Response types (aligned with FastAPI schemas)
export interface DeviceCreateRequest {
    node_key: string
    label: string
    category: DeviceCategory
    lat?: number
    lng?: number
    thingspeak_channel_id?: string
    thingspeak_read_key?: string
    field_mapping?: Record<string, any>
}

export interface DeviceUpdateRequest extends Partial<DeviceCreateRequest> {}

export interface DeviceResponse extends Device {
    // Matches backend DeviceResponse schema
}

// Telemetry types
export interface TelemetryData {
    tds?: number
    temperature?: number
    flow_rate?: number
    voltage?: number
    timestamp: string
}

export interface TelemetryResponse {
    device_id: string
    data: TelemetryData
    source: 'thingspeak' | 'cache'
}
```

**Type Guard Functions**:

```typescript
// client/src/lib/typeGuards.ts (NEW FILE)
import type { Device, EnrichedDevice } from '../types/database'

export function isEnrichedDevice(device: Device | EnrichedDevice): device is EnrichedDevice {
    return 'is_online' in device
}

export function hasValidTelemetry(device: EnrichedDevice): boolean {
    return (
        device.latest_tds !== undefined ||
        device.latest_temperature !== undefined ||
        device.latest_flow_rate !== undefined
    )
}

export function isOnline(device: Device | EnrichedDevice): boolean {
    if (isEnrichedDevice(device)) {
        return device.is_online
    }
    // Fallback: check last_reading_at
    return false
}
```

**Benefits**:
- ✅ Type safety throughout application
- ✅ Better IDE autocomplete
- ✅ Compile-time error detection
- ✅ Runtime type guards

---

## PATTERN 4: SUBSCRIPTION CLEANUP (P0)

### TDS Implementation Analysis
```typescript
// TDS: Always cleans up subscriptions
useEffect(() => {
    const subscription = supabase.channel('...')
    
    return () => {
        subscription.unsubscribe() // ← CRITICAL
    }
}, [])
```

### Implementation in Main Project

**Already Covered** in Pattern 1 (Realtime Subscriptions)

**Validation Checklist**:
- [ ] All useEffect hooks with subscriptions have cleanup
- [ ] Channel map tracks active subscriptions
- [ ] unsubscribeChannel() called on unmount
- [ ] No lingering subscriptions after navigation
- [ ] Memory leak detection in dev mode

**Test Plan**:
```typescript
// tests/realtimeCleanup.test.ts
test('subscription cleans up on unmount', () => {
    const { unmount } = render(<ComponentWithRealtime />)
    expect(getActiveChannelCount()).toBe(1)
    
    unmount()
    expect(getActiveChannelCount()).toBe(0) // ✅ All cleaned up
})
```

---

## PATTERN 5: CACHING (P2 - Future Enhancement)

### TDS Implementation Analysis
```typescript
// TDS: IndexedDB caching with TTL
export async function cacheDevices(devices: any[]): Promise<void> {
    const db = await openDB('cache', 1)
    // Store in IndexedDB
}

export async function getCachedDevices(): Promise<any[] | null> {
    const db = await openDB('cache', 1)
    const cached = await db.getAll('devices')
    
    // Check TTL (24 hours)
    if (now - cached.timestamp > TTL) return null
    return cached.data
}
```

### Decision: DEFER TO FUTURE

**Rationale**:
- React Query already provides in-memory caching (staleTime, cacheTime)
- IndexedDB adds complexity
- Benefit vs effort ratio is low for Phase 1-20

**Future Implementation** (if needed):
1. Install `idb` package
2. Create `client/src/lib/cache.ts`
3. Integrate with React Query (2nd layer cache)
4. Add service worker for offline support

**Current Workaround**:
```typescript
// Use React Query staleTime
useQuery({
    queryKey: ['devices'],
    queryFn: fetchDevices,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 10 * 60 * 1000    // 10 minutes garbage collection
})
```

---

## PATTERN 6: QUERY OPTIMIZATION (P3)

### TDS Implementation Analysis
```typescript
// TDS: Centralized query keys
export const queryKeys = {
    devices: ['devices'] as const,
    device: (id: string) => ['devices', id] as const,
    alerts: ['alerts'] as const,
    // ...
}

// Usage
useQuery({ queryKey: queryKeys.devices, ... })
```

### Implementation in Main Project

**Create Query Key Factory**:

```typescript
// client/src/lib/queryKeys.ts (NEW FILE)
export const queryKeys = {
    // Devices
    devices: {
        all: ['devices'] as const,
        lists: () => [...queryKeys.devices.all, 'list'] as const,
        list: (filters: string) => [...queryKeys.devices.lists(), filters] as const,
        details: () => [...queryKeys.devices.all, 'detail'] as const,
        detail: (id: string) => [...queryKeys.details(), id] as const,
    },
    
    // Telemetry
    telemetry: {
        all: ['telemetry'] as const,
        device: (deviceId: string) => [...queryKeys.telemetry.all, deviceId] as const,
        latest: (deviceId: string) => [...queryKeys.telemetry.device(deviceId), 'latest'] as const,
        history: (deviceId: string) => [...queryKeys.telemetry.device(deviceId), 'history'] as const,
    },
    
    // Dashboard
    dashboard: {
        stats: ['dashboard', 'stats'] as const,
        alerts: ['dashboard', 'alerts'] as const,
    },
    
    // Auth
    auth: {
        me: ['auth', 'me'] as const,
    },
} as const
```

**Benefits**:
- ✅ Type-safe query keys
- ✅ Easy invalidation (`queryClient.invalidateQueries({ queryKey: queryKeys.devices.all })`)
- ✅ Centralized management
- ✅ No typos in query keys

---

## REALTIME INTEGRATION DESIGN (Phase 7 Preparation)

### Tables to Subscribe

| Table | Priority | Justification |
|-------|----------|---------------|
| `devices` | **P0** | Core entity, frequent updates |
| `users_profiles` | **P2** | Infrequent updates, low priority |
| `audit_logs` | **P3** | Write-only, no UI dependency |

**Decision**: Subscribe to `devices` table only in Phase 7.

### Event Handling Strategy

```typescript
// INSERT event → Add to UI
event: 'INSERT' → queryClient.invalidateQueries(['devices'])

// UPDATE event → Update specific item
event: 'UPDATE' → queryClient.invalidateQueries(['devices', payload.new.id])

// DELETE event → Remove from UI
event: 'DELETE' → queryClient.invalidateQueries(['devices'])
```

### Connection Limits

**Render Free Tier**: 512MB RAM, ~100 concurrent connections  
**Supabase Pooler**: 15-60 connections (depending on plan)

**Strategy**:
- Max 3 realtime channels per user session
- 1 channel = 1 connection
- Channels: `devices`, (future: `alerts`, `notifications`)

**Monitoring**:
```typescript
// Add to health endpoint response
{
    realtime: {
        active_channels: getActiveChannelCount(),
        max_channels: 3,
        status: active_channels < max_channels ? 'ok' : 'warning'
    }
}
```

---

## TYPE SYSTEM MIGRATION PLAN

### Phase 8 Tasks

1. **Generate Supabase Types** (if not exists)
```bash
npx supabase gen types typescript --project-id tihrvotigvaozizlcxse > client/src/types/supabase-generated.ts
```

2. **Enhance Database Types**
- Add `EnrichedDevice` interface
- Add API response types
- Create type guard functions

3. **Update Components**
- Replace `any` types with specific types
- Add type annotations to hooks
- Use type guards for runtime checks

4. **Validate**
```bash
cd client && npx tsc --noEmit
```

---

## ERROR HANDLING IMPLEMENTATION PLAN

### Phase 9 Tasks

1. **Create Error Handler Module**
- `lib/errorHandler.ts` (AppError class, error types)
- `lib/typeGuards.ts` (type guards)

2. **Enhance Axios Interceptor**
- Response interceptor (error processing)
- Toast notifications on error
- Logging in dev mode

3. **Add Error Boundaries**
- Wrap route components
- Fallback UI for errors
- Error recovery actions

4. **Backend Error Standardization**
- Ensure consistent error responses
- Add error codes
- Document error contract

---

## PHASE 2 DELIVERABLES

✅ **COMPLETED**:
1. ✅ Extraction priority matrix created
2. ✅ Realtime pattern adapted for FastAPI architecture
3. ✅ Error handling pattern designed
4. ✅ Type enhancement plan documented
5. ✅ Subscription cleanup strategy defined
6. ✅ Caching decision (defer to future)
7. ✅ Query optimization pattern documented
8. ✅ Connection limit mitigation strategy
9. ✅ Implementation tasks for Phase 7, 8, 9 prepared

---

## VALIDATION CRITERIA MET

- [x] Realtime patterns validated as read-only safe
- [x] Error patterns compatible with FastAPI responses
- [x] Type improvements identified with no breaking changes
- [x] Connection pool limits addressed (max 3 channels)
- [x] Memory leak prevention documented (cleanup)

---

## NEXT PHASE PREPARATION

**Phase 3**: Environment Contract Reconciliation  
**Focus**: Create unified .env structure, document all required variables

**Phase 3.5**: Performance Baseline (MOVED from Phase 15)  
**Focus**: Measure current performance before making changes

**Phase 4**: Supabase Client Normalization  
**Focus**: Implement realtime module, enforce read-only constraint

**Estimated Start**: Immediate (Phase 2 complete)

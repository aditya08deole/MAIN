/**
 * telemetryPipeline.ts — Central telemetry pipeline utilities
 *
 * Single source of truth for:
 *  - Offline/online threshold definitions per device type
 *  - Time-range → result-count mapping (shared by all history queries)
 *  - Normalized telemetry type + converters
 *  - Device status evaluation (Online / Offline)
 *
 * All analytics pages, hooks, and dashboard components must use
 * `computeOnlineStatus` and the time-range utilities from here.
 * Never compute thresholds or result counts inline in components.
 */

// ─── Time Range ──────────────────────────────────────────────────────────────

/** Canonical time range labels used across all analytics pages. */
export type TimeRange = '1H' | '6H' | '24H' | '7D' | '30D';

/**
 * Maps a TimeRange to the number of history entries to request from the backend.
 * Calibrated to ThingSpeak's per-device poll frequencies:
 *   - EvaraFlow  → 2-min interval  → ~30 rows/hour
 *   - EvaraTank  → 15-min interval → ~4 rows/hour
 *   - EvaraDeep  → 15-min interval → ~4 rows/hour
 * The result values are generous enough to cover all device types.
 * ThingSpeak hard-caps at 8000 rows per request; all values here are well under that.
 */
export function timeRangeToResults(range: TimeRange): number {
    const map: Record<TimeRange, number> = {
        '1H':  30,
        '6H':  72,
        '24H': 144,
        '7D':  336,
        '30D': 720,
    };
    return map[range] ?? 100;
}

// ─── Offline Thresholds ──────────────────────────────────────────────────────

/**
 * Maximum age (minutes) before a device is considered Offline.
 *   EvaraDeep  — borewell sensors, less-frequent transmission → 2h tolerance
 *   EvaraTank  — 30 min tolerance
 *   EvaraFlow  — 30 min tolerance
 */
export const OFFLINE_THRESHOLDS_MIN: Record<string, number> = {
    EvaraDeep: 120,
    EvaraTank:  30,
    EvaraFlow:  30,
};

const DEFAULT_OFFLINE_THRESHOLD_MIN = 30;

// ─── Status Evaluation ───────────────────────────────────────────────────────

/**
 * Determine online/offline from the latest telemetry timestamp.
 *
 * This is the **single authoritative status function** for the frontend.
 * Used by useTelemetryLatest, DeviceService.computeDeviceStatus, and
 * the backend _online_status helper all produce consistent results.
 *
 * @param lastTimestamp  ISO-8601 timestamp string, null, or undefined
 * @param deviceType     'EvaraTank' | 'EvaraFlow' | 'EvaraDeep'
 */
export function computeOnlineStatus(
    lastTimestamp: string | null | undefined,
    deviceType: string,
): 'Online' | 'Offline' {
    if (!lastTimestamp) return 'Offline';
    const ageMs = Date.now() - new Date(lastTimestamp).getTime();
    if (isNaN(ageMs)) return 'Offline';
    const threshold =
        (OFFLINE_THRESHOLDS_MIN[deviceType] ?? DEFAULT_OFFLINE_THRESHOLD_MIN) * 60_000;
    return ageMs < threshold ? 'Online' : 'Offline';
}

// ─── Snapshot Table Resolution ───────────────────────────────────────────────

/** Maps a device type string to its Supabase snapshot table name. */
export const SNAPSHOT_TABLES: Record<string, string> = {
    EvaraTank:  'evaratank_snapshots',
    EvaraFlow:  'evaraflow_snapshots',
    EvaraDeep:  'evaradeep_snapshots',
    tank:       'evaratank_snapshots',
    flow:       'evaraflow_snapshots',
    deep:       'evaradeep_snapshots',
    evaratank:  'evaratank_snapshots',
    evaraflow:  'evaraflow_snapshots',
    evaradeep:  'evaradeep_snapshots',
};

export function snapshotTableForType(deviceType: string): string {
    return SNAPSHOT_TABLES[deviceType] ?? 'evaratank_snapshots';
}

// ─── Normalized Telemetry ────────────────────────────────────────────────────

/**
 * Internal normalized representation.
 * Downstream components never interact with raw ThingSpeak fields directly;
 * they always consume a NormalizedTelemetry object produced by the converters below.
 */
export interface NormalizedTelemetry {
    timestamp: string;
    deviceId: string;
    level_percentage:  number | null;
    depth_value:       number | null;
    temperature_value: number | null;
    flow_rate:         number | null;
    total_liters:      number | null;
    /** Raw backend payload — available for analytics pages that need field-level access. */
    raw: Record<string, unknown>;
}

/**
 * Convert the backend's `/telemetry/devices/{id}/telemetry/latest` response
 * to a NormalizedTelemetry object.
 */
export function normalizeLatestResponse(
    apiResponse: Record<string, unknown>,
    deviceId: string,
): NormalizedTelemetry {
    return {
        timestamp:         (apiResponse.timestamp as string) ?? '',
        deviceId,
        level_percentage:  apiResponse.level_percentage  != null ? Number(apiResponse.level_percentage)  : null,
        depth_value:       apiResponse.depth_value        != null ? Number(apiResponse.depth_value)        : null,
        temperature_value: apiResponse.temperature_value  != null ? Number(apiResponse.temperature_value)  : null,
        flow_rate:         apiResponse.flow_rate          != null ? Number(apiResponse.flow_rate)          : null,
        total_liters:      apiResponse.total_liters       != null ? Number(apiResponse.total_liters)       : null,
        raw: (apiResponse.data as Record<string, unknown>) ?? {},
    };
}

/**
 * Convert a single history feed entry (from the history endpoint `feeds[]`)
 * to a NormalizedTelemetry object.
 */
export function normalizeHistoryFeed(
    feed: Record<string, unknown>,
    deviceId: string,
): NormalizedTelemetry {
    return {
        timestamp:         (feed.created_at as string) ?? '',
        deviceId,
        level_percentage:  feed.level_percentage  != null ? Number(feed.level_percentage)  : null,
        depth_value:       feed.depth_value        != null ? Number(feed.depth_value)        : null,
        temperature_value: feed.temperature_value  != null ? Number(feed.temperature_value)  : null,
        flow_rate:         feed.flow_rate          != null ? Number(feed.flow_rate)          : null,
        total_liters:      feed.total_liters       != null ? Number(feed.total_liters)       : null,
        raw: feed,
    };
}

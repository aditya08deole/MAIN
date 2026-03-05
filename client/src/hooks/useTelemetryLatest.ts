/**
 * useTelemetryLatest.ts
 *
 * Canonical hook for fetching the latest telemetry snapshot for any device.
 * This is the ONLY place in the frontend that constructs the
 * `['telemetry', deviceId, 'latest']` React Query cache key.
 *
 * Features:
 *  - Auto-refetch every 2 minutes (matches ingestion_service poll budget)
 *  - Exponential back-off retry (max 30 s)
 *  - Online/Offline status derived from timestamp via telemetryPipeline
 *  - Returns a strongly-typed TelemetryLatestResult
 */

import { useQuery } from '@tanstack/react-query';
import { telemetryService } from '../services/TelemetryService';
import type { TelemetryData } from '../services/TelemetryService';
import { computeOnlineStatus } from '../utils/telemetryPipeline';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * The shape returned by the backend `/telemetry/devices/{id}/telemetry/latest`
 * endpoint. Matches TelemetryService.TelemetryData.
 */
export interface TelemetryLatestPayload {
    timestamp: string;
    /** Raw ThingSpeak fields keyed by fieldN name. Also contains entry_id. */
    data: Record<string, unknown>;
    // Typed metrics (pre-computed by backend TelemetryMapper)
    level_percentage?: number | null;
    depth_value?: number | null;
    temperature_value?: number | null;
    flow_rate?: number | null;
    total_liters?: number | null;
    /** Backend-computed online flag (30-min freshness). Prefer this over timestamp-derived status. */
    online?: boolean | null;
}

export interface TelemetryLatestResult {
    /** The normalized snapshot. Null while loading or on error. */
    telemetryData: TelemetryLatestPayload | null;
    /** Derived from telemetryData?.timestamp via computeOnlineStatus. */
    onlineStatus: 'Online' | 'Offline';
    isLoading: boolean;
    isError: boolean;
    refetch: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * @param deviceId   UUID of the device node.
 * @param deviceType 'EvaraTank' | 'EvaraFlow' | 'EvaraDeep'
 *                   Used to pick the correct offline threshold.
 * @param refetchMs  Poll interval in milliseconds. Default 120 000 (2 min).
 */
export function useTelemetryLatest(
    deviceId: string | undefined | null,
    deviceType: string,
    refetchMs = 120_000,
): TelemetryLatestResult {
    const enabled = Boolean(deviceId);

    const {
        data,
        isLoading,
        isError,
        refetch,
    } = useQuery<TelemetryLatestPayload | null>({
        queryKey: ['telemetry', deviceId, 'latest'],
        queryFn: async () => {
            if (!deviceId) return null;

            // TelemetryService already handles errors gracefully (returns null)
            const result = await telemetryService.getLiveTelemetry(deviceId);
            if (!result) return null;

            // Remap values->{} as data->{} unification:
            // TelemetryService stores raw fields in result.values; analytics pages
            // need them under result.data — bridge both shapes here.
            return {
                timestamp:         result.timestamp,
                data:              (result as unknown as { data?: Record<string, unknown> }).data
                                   ?? (result.values as Record<string, unknown>)
                                   ?? {},
                level_percentage:  result.level_percentage  ?? null,
                depth_value:       result.depth_value        ?? null,
                temperature_value: result.temperature_value  ?? null,
                flow_rate:         result.flow_rate          ?? null,
                total_liters:      result.total_liters       ?? null,
                online:            (result as TelemetryData & { online?: boolean | null }).online ?? null,
            };
        },
        enabled,
        refetchInterval: refetchMs,
        refetchOnWindowFocus: false,
        staleTime: refetchMs / 2,
        gcTime: 5 * 60_000,
        retry: 3,
        retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 30_000),
    });

    const telemetryData = data ?? null;

    // Prefer the backend-computed `online` boolean (server applies 30-min rule correctly).
    // Fall back to client-side timestamp computation only when backend flag is unavailable.
    const onlineStatus: 'Online' | 'Offline' =
        telemetryData?.online === true
            ? 'Online'
            : telemetryData?.online === false
                ? 'Offline'
                : computeOnlineStatus(telemetryData?.timestamp ?? null, deviceType);

    return { telemetryData, onlineStatus, isLoading, isError, refetch };
}

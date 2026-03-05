import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

// ─── Typed interfaces for unified analytics response ──────────────────────────

export interface NodeInfoData {
    id: string;
    name: string;
    label?: string;
    node_key?: string;
    asset_type: string;
    analytics_template: 'EvaraTank' | 'EvaraFlow' | 'EvaraDeep';
    status: 'Online' | 'Offline';
    /** From device table — updated whenever device contacts backend */
    last_seen: string | null;
    /** From snapshot table — updated when ThingSpeak data is ingested */
    snapshot_timestamp?: string | null;
    latitude: number | null;
    longitude: number | null;
    community_id: string | null;
    zone_name?: string;
    community_name?: string;
}

export interface LatestTelemetry {
    timestamp: string;
    data: Record<string, string | number | null>;
    level_percentage?: number | null;
    depth_value?: number | null;
    flow_rate?: number | null;
    total_liters?: number | null;
    temperature_value?: number | null;
    online?: boolean | null;
}

export interface HistoryFeed {
    created_at: string;
    [key: string]: unknown;
}

export interface UnifiedAnalyticsData {
    info: { status: string; data: NodeInfoData } | { error: string; status_code?: number };
    config: { device_type: string; config: Record<string, unknown> } | { error: string };
    latest: LatestTelemetry | null | { error: string };
    history: { source: string; feeds: HistoryFeed[] } | { error: string };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Unified analytics hook — fetches device info, config, latest telemetry,
 * and 24H history in a single parallel backend call.
 *
 * Retries up to 2× with exponential back-off. Caches for 10 minutes after unmount.
 * Background-refreshes every 3 minutes so the analytics page stays live.
 */
export function useDeviceAnalytics(deviceId: string) {
    return useQuery<UnifiedAnalyticsData>({
        queryKey: ['analytics', 'full', deviceId],
        queryFn: async () => {
            const response = await api.get(`/analytics/device/${deviceId}`);
            return response.data;
        },
        enabled: !!deviceId,
        staleTime: 2 * 60_000,            // 2 min — data is considered fresh
        gcTime: 10 * 60_000,              // Keep in cache 10 min after unmount
        retry: 2,
        retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 15_000),
        refetchInterval: 3 * 60_000,      // Background refresh every 3 min
        refetchOnWindowFocus: false,
    });
}

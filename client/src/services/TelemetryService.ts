import api from './api';
import type { TimeRange } from '../utils/telemetryPipeline';
import { timeRangeToResults } from '../utils/telemetryPipeline';

export interface TelemetryData {
    timestamp: string;
    values: Record<string, number | string | null>;
    deviceId: string;

    // Typed Fields (Phase 1 Alignment)
    level_percentage?: number | null;
    depth_value?: number | null;
    temperature_value?: number | null;
    flow_rate?: number | null;
    total_liters?: number | null;
    /** Backend-computed online flag (30-min freshness rule). Use this first. */
    online?: boolean | null;
}

export interface DeviceMetadata {
    id: string;
    node_key: string | null;
    classification: string;
}

export interface ThingSpeakChannelInfo {
    channel_id: string;
    name: string;
    fields: Record<string, string>; // { field1: "Temperature", field2: "Distance" }
    last_entry_id: number | null;
    last_values: Record<string, string | null>;
    updated_at: string | null;
}

class TelemetryService {
    private static instance: TelemetryService;

    private constructor() { }

    public static getInstance(): TelemetryService {
        if (!TelemetryService.instance) {
            TelemetryService.instance = new TelemetryService();
        }
        return TelemetryService.instance;
    }

    /**
     * Fetches real-time telemetry via the FastAPI gateway.
     * Uses the shared api.ts Axios instance (auth, timeout, interceptors included).
     */
    public async getLiveTelemetry(deviceId: string): Promise<TelemetryData & { online?: boolean } | null> {
        try {
            const { data } = await api.get(`/devices/${deviceId}/telemetry/latest`);
            if (!data) return null;

            // The /telemetry/latest endpoint returns TelemetryResponse (Pydantic model):
            //   { timestamp, data: {field1, field2, ...raw_feed}, level_percentage,
            //     depth_value, temperature_value, flow_rate, total_liters }
            //
            // The Axios interceptor does NOT auto-unwrap this (no status+data envelope).
            // Typed metrics are at the TOP level; raw feed is under `data`.
            const response = data as Record<string, unknown>;
            const rawFeed = (response['data'] as Record<string, unknown>) ?? {};

            // Timestamp: prefer top-level `timestamp`, fall back to raw_feed.created_at
            const timestamp =
                (response['timestamp'] as string)
                ?? (rawFeed['created_at'] as string)
                ?? null;

            return {
                timestamp: timestamp ?? '',
                values: rawFeed as Record<string, number | string | null>,
                deviceId,
                level_percentage:  (response['level_percentage']  as number) ?? null,
                depth_value:       (response['depth_value']        as number) ?? null,
                temperature_value: (response['temperature_value']  as number) ?? null,
                flow_rate:         (response['flow_rate']          as number) ?? null,
                total_liters:      (response['total_liters']       as number) ?? null,
                // No online flag in TelemetryResponse — derived client-side from timestamp
                online: null,
            };
        } catch (err) {
            console.error('[TelemetryService] Live telemetry fetch failed for', deviceId, ':', err);
            return null;
        }
    }

    /**
     * Fetches historical telemetry via the FastAPI gateway.
     * Backend normalizes all feeds with TelemetryMapper.
     */
    public async getHistoryTelemetry(deviceId: string, results: number = 100): Promise<TelemetryData[] | null> {
        try {
            const { data: rawData } = await api.get(
                `/devices/${deviceId}/telemetry/history?results=${results}`
            );
            if (!rawData || !rawData.feeds) return null;
            return rawData.feeds.map((feed: Record<string, unknown>) => ({
                timestamp: feed.created_at as string,
                values: feed,
                deviceId,
                level_percentage: (feed.level_percentage as number) ?? null,
                depth_value: (feed.depth_value as number) ?? null,
                temperature_value: (feed.temperature_value as number) ?? null,
                flow_rate: (feed.flow_rate as number) ?? null,
                total_liters: (feed.total_liters as number) ?? null,
            }));
        } catch (err) {
            console.error('[TelemetryService] History fetch failed for', deviceId, ':', err);
            return null;
        }
    }

    /**
     * Tests a ThingSpeak channel connection.
     * Returns channel name, field labels, last values, and entry count.
     */
    public async testConnection(channelId: string, readKey: string): Promise<ThingSpeakChannelInfo | null> {
        try {
            const { data } = await api.post('/telemetry/test-connection', {
                channel_id: channelId,
                read_key: readKey,
            });
            return data as ThingSpeakChannelInfo;
        } catch (err) {
            console.error('[TelemetryService] Test connection failed:', err);
            return null;
        }
    }

    /**
     * Fetches channel metadata (field names) for the field-mapping dropdowns.
     */
    public async getChannelInfo(channelId: string, readKey: string): Promise<ThingSpeakChannelInfo | null> {
        try {
            const { data } = await api.get(
                `/telemetry/channel-info?channel_id=${channelId}&read_key=${encodeURIComponent(readKey)}`
            );
            return data as ThingSpeakChannelInfo;
        } catch (err) {
            console.error('[TelemetryService] Channel info failed:', err);
            return null;
        }
    }

    /**
     * Fetches historical telemetry by TimeRange label.
     * Uses timeRangeToResults() from telemetryPipeline for consistent result counts.
     */
    public async getHistoryByTimeRange(
        deviceId: string,
        range: TimeRange,
    ): Promise<{ feeds: Record<string, unknown>[] } | null> {
        const results = timeRangeToResults(range);
        try {
            const { data } = await api.get(
                `/devices/${deviceId}/telemetry/history?results=${results}`,
            );
            return data ?? null;
        } catch (err) {
            console.error('[TelemetryService] History by time range failed for', deviceId, ':', err);
            return null;
        }
    }

    /** No-op kept for API compatibility. React Query cache is the source of truth. */
    public clearCache(): void {
        console.info('[TelemetryService] clearCache() called — React Query cache is managed by hooks.');
    }
}

export const telemetryService = TelemetryService.getInstance();

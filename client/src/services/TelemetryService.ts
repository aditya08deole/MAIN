import { supabase } from '../lib/supabase';

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
}

export interface DeviceMetadata {
    id: string;
    node_key: string | null;
    classification: string;
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
     * Fetches real-time telemetry from the hardened FastAPI gateway.
     */
    public async getLiveTelemetry(deviceId: string): Promise<TelemetryData | null> {
        try {
            // Calling our centralized FastAPI Backend proxy
            // The backend handles coalescing, rate limits, and secure key retrieval
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/telemetry/devices/${deviceId}/latest`, {
                headers: {
                    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                }
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            if (!data || !data.data) return null;

            return {
                timestamp: data.timestamp,
                values: data.data,
                deviceId: deviceId,
                level_percentage: data.level_percentage,
                depth_value: data.depth_value,
                temperature_value: data.temperature_value,
                flow_rate: data.flow_rate,
                total_liters: data.total_liters
            };
        } catch (err) {
            console.error('[TelemetryService] Live telemetry fetch failed for', deviceId, ':', err);
            return null;
        }
    }

    /**
     * Fetches historical telemetry from the hardened FastAPI gateway.
     */
    public async getHistoryTelemetry(deviceId: string, results: number = 100): Promise<TelemetryData[] | null> {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/telemetry/devices/${deviceId}/telemetry/history?results=${results}`, {
                headers: {
                    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                }
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const rawData = await response.json();

            if (!rawData || !rawData.feeds) return null;

            // Simple map of feeds back to normalized UI telemetry records
            // Note: The history endpoint currently returns raw feeds; we might need to normalize them based on 
            // the same logic used in the backend's latest endpoint if we want absolute UI mapping parity.
            return rawData.feeds.map((feed: any) => ({
                timestamp: feed.created_at,
                values: feed, // Fallback to raw fields for history until backend-side normalization is added to history endpoint
                deviceId: deviceId
            }));
        } catch (err) {
            console.error('[TelemetryService] History fetch failed for', deviceId, ':', err);
            return null;
        }
    }

    /**
     * Clears local state.
     */
    public clearCache(): void {
        console.log('[TelemetryService] State cleared');
    }
}

export const telemetryService = TelemetryService.getInstance();

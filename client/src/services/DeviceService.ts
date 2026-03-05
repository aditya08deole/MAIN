import { supabase } from '../lib/supabase';
import api from './api';
import { computeOnlineStatus } from '../utils/telemetryPipeline';

// Unified device row — common fields across evaratank / evaraflow / evaradeep
export interface DeviceRow {
    id: string;
    name: string | null;
    node_key: string | null;
    analytics_template: string | null;
    asset_type: string | null;
    community_id: string | null;
    customer_id: string | null;
    latitude: number | null;
    longitude: number | null;
    status: string | null;
    is_active: boolean | null;
    thingspeak_channel_id: string | null;
    thingspeak_read_key: string | null;
    thingspeak_write_key: string | null;
    last_seen: string | null;
    created_at: string | null;
    updated_at: string | null;
    device_type?: string;
    [key: string]: unknown;
}

export interface DeviceDetails extends DeviceRow {
    calibration_factor?: number;
    last_maintenance_date?: string;
    firmware_version?: string;
    location_name?: string;
    shadow_state?: {
        desired?: { pump_status?: string };
        reported?: Record<string, unknown>;
    };
}

export interface TelemetrySnapshot {
    last_timestamp: string | null;
    level_percentage: number | null;
    depth_value: number | null;
    flow_rate: number | null;
    total_liters: number | null;
}

export interface MapDevice {
    id: string;
    name: string | null;
    label: string | null;
    node_key: string | null;
    asset_type: string | null;
    asset_category: string | null;
    analytics_template: string | null;
    latitude: number | null;
    longitude: number | null;
    capacity: string | null;
    specifications: string | null;
    status: string;
    last_seen: string | null;
    last_telemetry?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    telemetry_snapshot?: TelemetrySnapshot | null;
}

/**
 * Determine device online/offline status from telemetry timestamp freshness.
 * Uses the unified computeOnlineStatus from telemetryPipeline.
 */
export function computeDeviceStatus(
    analytics_template: string | null,
    lastTimestamp: string | null | undefined
): 'Online' | 'Offline' {
    return computeOnlineStatus(lastTimestamp, analytics_template || 'EvaraTank');
}

export interface ProvisioningResult {
    success: boolean;
    message: string;
    device?: {
        id: string;
        label: string;
    };
}

class DeviceService {
    private static instance: DeviceService;

    private constructor() { }

    public static getInstance(): DeviceService {
        if (!DeviceService.instance) {
            DeviceService.instance = new DeviceService();
        }
        return DeviceService.instance;
    }

    /**
     * Subscribe to real-time device updates (Supabase Realtime) across all device tables.
     */
    subscribeToDeviceUpdates(callback: (payload: any) => void, _filter?: string) {
        const tables = ['evaratank', 'evaraflow', 'evaradeep'];
        const channels = tables.map(table =>
            supabase
                .channel(`public:${table}:updates`)
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table }, callback)
                .subscribe()
        );
        return () => channels.forEach(ch => supabase.removeChannel(ch));
    }

    /**
     * Subscribe to new device registrations (Supabase Realtime) across all device tables.
     */
    subscribeToNewDevices(callback: (payload: any) => void, _filter?: string) {
        const tables = ['evaratank', 'evaraflow', 'evaradeep'];
        const channels = tables.map(table =>
            supabase
                .channel(`public:${table}:inserts`)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table }, callback)
                .subscribe()
        );
        return () => channels.forEach(ch => supabase.removeChannel(ch));
    }

    /**
     * Fetch a single device details — tries all 3 unified tables in order.
     */
    async getDeviceDetails(id: string): Promise<DeviceDetails> {
        for (const table of ['evaratank', 'evaraflow', 'evaradeep'] as const) {
            const { data, error } = await supabase
                .from(table as any)
                .select('*')
                .eq('id', id)
                .maybeSingle();
            if (!error && data) return { ...(data as any), device_type: table } as DeviceDetails;
        }
        throw new Error(`Device ${id} not found in any device table`);
    }

    /**
     * Fetch all devices for map display, joined with latest telemetry snapshot.
     * REDIRECTED: Now fetches from FastAPI backend (/nodes) for better performance and reliability.
     */
    async getMapDevices(): Promise<MapDevice[]> {
        try {
            const response = await api.get<MapDevice[]>('/nodes');
            return response.data || [];
        } catch (error) {
            console.error('[DeviceService] Failed to fetch map devices from backend, falling back to Supabase:', error);

            // Fallback: parallel queries across all 3 unified device tables
            const tableMap: Record<string, string> = {
                evaratank: 'EvaraTank',
                evaraflow: 'EvaraFlow',
                evaradeep: 'EvaraDeep',
            };
            const [tankRes, flowRes, deepRes] = await Promise.all(
                ['evaratank', 'evaraflow', 'evaradeep'].map(t =>
                    supabase.from(t as any)
                        .select('id, name, node_key, asset_type, analytics_template, latitude, longitude, last_seen')
                        .is('deleted_at', null)
                )
            );
            const rows = [
                ...(tankRes.data || []).map((d: any) => ({ ...d, _table: 'evaratank' })),
                ...(flowRes.data || []).map((d: any) => ({ ...d, _table: 'evaraflow' })),
                ...(deepRes.data || []).map((d: any) => ({ ...d, _table: 'evaradeep' })),
            ];
            if (tankRes.error && flowRes.error && deepRes.error) throw tankRes.error;

            return rows.map((d: any) => {
                const template: string = tableMap[d._table] || d.analytics_template || 'EvaraTank';
                const snap: TelemetrySnapshot | null = null;
                const status = computeDeviceStatus(template, d.last_seen);

                return {
                    id: d.id,
                    name: d.name || d.node_key || 'Unnamed Node',
                    label: d.name,
                    node_key: d.node_key,
                    asset_type: d.asset_type || (template === 'EvaraTank' ? 'tank' : template === 'EvaraFlow' ? 'flow_meter' : 'borewell'),
                    asset_category: null,
                    analytics_template: template,
                    latitude: d.latitude,
                    longitude: d.longitude,
                    capacity: null,
                    specifications: null,
                    status,
                    last_seen: (snap as any)?.last_timestamp ?? null,
                    telemetry_snapshot: snap,
                } satisfies MapDevice;
            });
        }
    }

    /**
     * Claim/Provision a new device.
     */
    async claimDevice(token: string, hardwareId: string, label: string): Promise<ProvisioningResult> {
        const response = await api.post<ProvisioningResult>('/devices/claim', {
            token,
            hardware_id: hardwareId,
            label
        });
        return response.data;
    }

    /**
     * Update device shadow (IoT control).
     */
    async updateDeviceShadow(id: string, payload: { pump_status: string }): Promise<void> {
        await api.patch(`/devices/${id}/shadow`, payload);
    }

    /**
     * Export device readings as CSV.
     */
    async exportDeviceReadings(id: string): Promise<void> {
        const response = await api.get(`/reports/node/${id}/export`, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `device-readings-${id}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    }
}

export const deviceService = DeviceService.getInstance();

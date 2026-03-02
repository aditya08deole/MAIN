import { supabase } from '../lib/supabase';
import api from './api';
import type { Database } from '../types/database';

type DeviceRow = Database['public']['Tables']['devices']['Row'];

export interface DeviceDetails extends DeviceRow {
    calibration_factor?: number;
    last_maintenance_date?: string;
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
 * EvaraDeep (borewell): offline if no data for > 2 hours.
 * EvaraTank / EvaraFlow: offline if no data for > 30 minutes.
 */
export function computeDeviceStatus(
    analytics_template: string | null,
    lastTimestamp: string | null | undefined
): 'Online' | 'Offline' {
    if (!lastTimestamp) return 'Offline';
    const ageMs = Date.now() - new Date(lastTimestamp).getTime();
    const thresholdMs =
        analytics_template === 'EvaraDeep'
            ? 2 * 60 * 60 * 1000   // 2 hours
            : 30 * 60 * 1000;      // 30 minutes
    return ageMs < thresholdMs ? 'Online' : 'Offline';
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
     * Subscribe to real-time device updates (Supabase Realtime)
     */
    subscribeToDeviceUpdates(callback: (payload: any) => void, filter?: string) {
        let channelName = 'public:devices';
        if (filter) channelName += `:${filter.replace(/[^a-zA-Z0-9=]/g, '_')}`;

        const channel = supabase
            .channel(channelName)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'devices', filter }, callback)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }

    /**
     * Subscribe to new device registrations (Supabase Realtime)
     */
    subscribeToNewDevices(callback: (payload: any) => void, filter?: string) {
        let channelName = 'public:devices:new';
        if (filter) channelName += `:${filter.replace(/[^a-zA-Z0-9=]/g, '_')}`;

        const channel = supabase
            .channel(channelName)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'devices', filter }, callback)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }

    /**
     * Fetch a single device details.
     */
    async getDeviceDetails(id: string): Promise<DeviceDetails> {
        const { data, error } = await supabase
            .from('devices')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as DeviceDetails;
    }

    /**
     * Fetch all devices for map display, joined with latest telemetry snapshot.
     * REDIRECTED: Now fetches from FastAPI backend (/nodes) for better performance and reliability.
     */
    async getMapDevices(): Promise<MapDevice[]> {
        try {
            console.log('[DeviceService] Fetching from backend /nodes...');
            // NOTE: api interceptor already unwraps { status, data } envelope,
            // so response.data is already the MapDevice[] array.
            const response = await api.get<MapDevice[]>('/nodes');
            console.log('[DeviceService] Backend response:', response.data);
            console.log('[DeviceService] Fetched devices from backend:', response.data?.length || 0);
            return response.data || [];
        } catch (error) {
            console.error('[DeviceService] Failed to fetch map devices from backend, falling back to Supabase:', error);

            // Fallback to Supabase direct in case backend is down
            const { data, error: sbError } = await supabase
                .from('devices')
                .select(
                    'id, label, node_key, asset_type, analytics_template, latitude, longitude,' +
                    'telemetry_snapshots(last_timestamp, level_percentage, depth_value, flow_rate, total_liters)'
                )
                .is('deleted_at', null);

            if (sbError) {
                console.error('[DeviceService] Supabase error:', sbError);
                throw sbError;
            }

            console.log('[DeviceService] Fetched devices from Supabase fallback:', data?.length || 0);
            console.log('[DeviceService] Supabase devices:', data);

            return (data || []).map((d: any) => {
                const snap: TelemetrySnapshot | null = Array.isArray(d.telemetry_snapshots)
                    ? (d.telemetry_snapshots[0] ?? null)
                    : (d.telemetry_snapshots ?? null);

                const template: string | null = d.analytics_template || null;
                const status = computeDeviceStatus(template, snap?.last_timestamp ?? d.last_seen);

                return {
                    id: d.id,
                    name: d.label || d.node_key || 'Unnamed Node',
                    label: d.label,
                    node_key: d.node_key,
                    asset_type: d.asset_type || (template === 'EvaraTank' ? 'tank' : template === 'EvaraFlow' ? 'flow_meter' : 'borewell'),
                    asset_category: null,
                    analytics_template: template,
                    latitude: d.latitude,
                    longitude: d.longitude,
                    capacity: null,
                    specifications: null,
                    status,
                    last_seen: snap?.last_timestamp ?? null,
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

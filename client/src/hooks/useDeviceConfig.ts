import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

interface TankConfig {
    thingspeak_channel_id?: string | null;
    tank_shape: string | null;
    height_m: number | null;
    radius_m: number | null;
    length_m: number | null;
    breadth_m: number | null;
    dimension_unit: string | null;
    // ── CORRECTED: matches backend response keys ──────────────────────────
    /** Capacity stored in DB (litres). Backend key: capacity_liters */
    capacity_liters: number | null;
    /** ThingSpeak field mapped to the water-level distance sensor. Backend key: water_level_field */
    water_level_field: string | null;
    /** ThingSpeak field mapped to the temperature sensor. Backend key: temperature_field */
    temperature_field: string | null;
}

/** Shape of the PUT /config request body (all optional) */
interface TankConfigInput {
    tank_shape?: string;
    height_m?: number;
    radius_m?: number;
    length_m?: number;
    breadth_m?: number;
    dimension_unit?: string;
    capacity_liters?: number | null;
    water_level_field?: string;
    temperature_field?: string;
}

interface FlowConfig {
    max_flow_rate: number | null;
    pipe_diameter: number | null;
    // ── CORRECTED: matches backend response keys ──────────────────────────
    /** ThingSpeak field mapped to cumulative volume reading. Backend key: meter_reading_field */
    meter_reading_field: string | null;
    /** ThingSpeak field mapped to instantaneous flow rate. Backend key: flow_rate_field */
    flow_rate_field: string | null;
    // NOTE: abnormal_threshold removed — no DB column exists for this field.
}

interface DeepConfig {
    // ── CORRECTED: matches backend response keys ──────────────────────────
    /** Total drilled depth of borewell (meters). Backend key: total_bore_depth */
    total_bore_depth: number | null;
    /** Static (rest) water level depth from surface (meters). Backend key: static_water_level */
    static_water_level: number | null;
    recharge_threshold: number | null;
    /** ThingSpeak field mapped to depth sensor. Backend key: depth_field */
    depth_field: string | null;
}

type DeviceConfig = TankConfig | FlowConfig | DeepConfig | Record<string, unknown>;

/**
 * Backend /telemetry/devices/{id}/config returns:
 *   { device_type: "EvaraTank", config: { thingspeak_channel_id, height_m, capacity_liters, ... } }
 * The Axios interceptor does NOT auto-unwrap this (no status+data envelope).
 * So resp.data = { device_type, config:{...} } and we read data.config directly.
 */
interface DeviceConfigResponse {
    device_type: string;
    config: DeviceConfig;
    // Legacy alias kept for backwards compat
    asset_type?: string;
}

/**
 * Phase 18+19 — Unified device config hook
 *
 * Fetches physical/hardware configuration for a device from the backend.
 * Data is stale-while-revalidate with a 10-minute TTL since config rarely changes.
 *
 * Usage:
 *   const { config, isLoading } = useDeviceConfig<TankConfig>(DEVICE_ID);
 *   const heightM = config?.height_m ?? FALLBACK_HEIGHT;
 */
export function useDeviceConfig<T extends DeviceConfig = DeviceConfig>(deviceId: string) {
    const { data, isLoading, error } = useQuery<DeviceConfigResponse>({
        queryKey: ['device-config', deviceId],
        queryFn: async () => {
            const { data } = await api.get<DeviceConfigResponse>(`/telemetry/devices/${deviceId}/config`);
            // data = { device_type: "EvaraTank", config: { height_m, capacity_liters, ... } }
            return data;
        },
        staleTime: 10 * 60 * 1000, // config changes rarely — 10 min TTL
        gcTime: 30 * 60 * 1000,
        retry: 2,
    });

    return {
        config: data?.config as T | undefined,
        assetType: data?.device_type ?? data?.asset_type,
        isLoading,
        error,
    };
}

export type { TankConfig, TankConfigInput, FlowConfig, DeepConfig };

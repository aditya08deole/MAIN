import { supabase } from '../lib/supabase';
import api from './api';
import {
    type ProfileRow as Profile,
    type RegionRow as Zone,
    type CommunityRow as Community,
    type AlertRule,
    type AlertHistory,
    type UserRole
} from '../types/database';

export type { Profile, Zone, Community, AlertRule, AlertHistory, UserRole };

export interface AdminStats {
    total_nodes: number;
    online_nodes: number;
    active_alerts: number;
    total_customers: number;
    total_regions: number;
    total_communities: number;
    weekly_growth: number;
    system_health: number;
}

export interface Customer {
    id: string;
    email: string;
    display_name: string;
    full_name?: string;
    phone_number?: string;
    status: string;
    role: string;
    community_id: string;
    zone?: string;
    password?: string;
}

// ─────────────────────────────────────────────────────────────
// Device interfaces for the three unified device types
// ─────────────────────────────────────────────────────────────

export interface DeviceBase {
    id: string;
    node_key: string;
    label: string;
    device_type: 'EvaraTank' | 'EvaraFlow' | 'EvaraDeep';
    latitude?: number | null;
    longitude?: number | null;
    community_id?: string | null;
    client_id?: string | null;
    thingspeak_channel_id?: string | null;
    thingspeak_read_key?: string | null;
    thingspeak_write_key?: string | null;
    is_active: boolean;
    last_seen?: string | null;
    created_at: string;
}

export interface EvaraTankDevice extends DeviceBase {
    device_type: 'EvaraTank';
    water_level_field?: string;
    temperature_field?: string;
    tank_shape?: string;
    height_m?: number | null;
    length_m?: number | null;
    breadth_m?: number | null;
    radius_m?: number | null;
    capacity_liters?: number | null;
}

export interface EvaraFlowDevice extends DeviceBase {
    device_type: 'EvaraFlow';
    meter_reading_field?: string;
    flow_rate_field?: string;
    pipe_diameter?: number | null;
    max_flow_rate?: number | null;
}

export interface EvaraDeepDevice extends DeviceBase {
    device_type: 'EvaraDeep';
    depth_field?: string;
    temperature_field?: string;
    total_bore_depth?: number | null;
    static_water_level?: number | null;
    dynamic_water_level?: number | null;
    recharge_threshold?: number | null;
}

export type AnyDevice = EvaraTankDevice | EvaraFlowDevice | EvaraDeepDevice;


class AdminService {
    private static instance: AdminService;
    private constructor() {}
    public static getInstance(): AdminService {
        if (!AdminService.instance) AdminService.instance = new AdminService();
        return AdminService.instance;
    }

    // ─── Hierarchy ───────────────────────────────────────────────────────────

    async getHierarchy(): Promise<any[]> {
        const { data, error } = await supabase
            .from('zones')
            .select(`*, communities(*, customers(*))`);
        if (error) throw error;
        return data || [];
    }

    // ─── Zones ───────────────────────────────────────────────────────────────

    async getRegions(): Promise<Zone[]> {
        const { data, error } = await supabase.from('zones').select('*');
        if (error) throw error;
        return (data || []) as Zone[];
    }

    async getRegion(id: string): Promise<Zone> {
        const { data, error } = await supabase.from('zones').select('*').eq('id', id).single();
        if (error) throw error;
        return data as Zone;
    }

    async getRegionStats(): Promise<any[]> {
        const { data, error } = await supabase.from('zone_detailed_stats').select('*');
        if (error) return this.getHierarchy();
        return data || [];
    }

    async createRegion(zone: Partial<Zone>): Promise<Zone> {
        const { data, error } = await (supabase.from('zones') as any)
            .insert({ ...zone, is_active: true })
            .select().single();
        if (error) throw error;
        return data as Zone;
    }

    // ─── Communities ─────────────────────────────────────────────────────────

    async getCommunities(zoneId?: string): Promise<Community[]> {
        let q = supabase.from('communities').select('*').order('name');
        if (zoneId) q = q.eq('zone_id', zoneId) as any;
        const { data, error } = await q;
        if (error) throw error;
        return (data || []) as any;
    }

    async createCommunity(community: Partial<Community>): Promise<Community> {
        const { data, error } = await (supabase.from('communities') as any)
            .insert(community).select().single();
        if (error) throw error;
        return data as Community;
    }

    // ─── Devices ─────────────────────────────────────────────────────────────

    /**
     * Get all devices as a flat list by querying all three unified tables.
     */
    async getDevices(communityId?: string): Promise<AnyDevice[]> {
        const [tanks, flows, deeps] = await Promise.all([
            this._getTypedDevices('evaratank', 'EvaraTank', communityId),
            this._getTypedDevices('evaraflow', 'EvaraFlow', communityId),
            this._getTypedDevices('evaradeep',  'EvaraDeep',  communityId),
        ]);
        return [...tanks, ...flows, ...deeps];
    }

    private async _getTypedDevices(tableName: string, deviceType: string, communityId?: string) {
        let q = (supabase.from(tableName) as any).select('*').is('deleted_at', null);
        if (communityId) q = q.eq('community_id', communityId);
        const { data, error } = await q;
        if (error) {
            console.error(`[getDevices] ${tableName} error:`, error.message);
            return [];
        }
        return (data || []).map((d: any) => ({ ...d, device_type: deviceType }));
    }

    /**
     * Create a new device in the appropriate unified table.
     * device_type must be 'EvaraTank' | 'EvaraFlow' | 'EvaraDeep'
     */
    async createDevice(device: any): Promise<any> {
        const dt = (device.analytics_template || device.device_type || '').toLowerCase();
        let tableName: string;
        let payload: Record<string, any>;

        const commonPayload = {
            node_key:              device.node_key,
            label:                 device.label || device.name,
            latitude:              device.latitude  ? Number(device.latitude)  : null,
            longitude:             device.longitude ? Number(device.longitude) : null,
            community_id:          device.community_id || null,
            client_id:             device.client_id || device.customer_id || null,
            thingspeak_channel_id: device.thingspeak_channel_id || null,
            thingspeak_read_key:   device.thingspeak_read_key   || null,
            thingspeak_write_key:  device.thingspeak_write_key  || null,
            is_active: true,
        };

        if (dt === 'evaratank' || dt === 'tank') {
            tableName = 'evaratank';
            payload = {
                ...commonPayload,
                water_level_field: device.water_level_field || 'field1',
                temperature_field: device.temperature_field || 'field2',
                tank_shape:        device.tank_shape        || 'rectangular',
                height_m:          device.height_m          != null ? Number(device.height_m)    : null,
                length_m:          device.length_m          != null ? Number(device.length_m)    : null,
                breadth_m:         device.breadth_m         != null ? Number(device.breadth_m)   : null,
                radius_m:          device.radius_m          != null ? Number(device.radius_m)    : null,
                capacity_liters:   device.capacity_liters   != null ? Number(device.capacity_liters) : null,
            };
        } else if (dt === 'evaraflow' || dt === 'flow') {
            tableName = 'evaraflow';
            payload = {
                ...commonPayload,
                meter_reading_field: device.meter_reading_field || 'field1',
                flow_rate_field:     device.flow_rate_field     || 'field2',
                pipe_diameter:       device.pipe_diameter   != null ? Number(device.pipe_diameter)  : null,
                max_flow_rate:       device.max_flow_rate    != null ? Number(device.max_flow_rate)   : null,
            };
        } else if (dt === 'evaradeep' || dt === 'deep') {
            tableName = 'evaradeep';
            payload = {
                ...commonPayload,
                depth_field:         device.depth_field       || 'field2',
                temperature_field:   device.temperature_field || 'field1',
                total_bore_depth:    device.total_bore_depth    != null ? Number(device.total_bore_depth)   : null,
                static_water_level:  device.static_water_level != null ? Number(device.static_water_level)  : null,
                dynamic_water_level: device.dynamic_water_level!= null ? Number(device.dynamic_water_level) : null,
                recharge_threshold:  device.recharge_threshold != null ? Number(device.recharge_threshold)  : 0,
            };
        } else {
            throw new Error(`Unknown device type: ${dt}. Must be 'EvaraTank', 'EvaraFlow', or 'EvaraDeep'.`);
        }

        // Route through backend (service-role, bypasses RLS)
        const response = await api.post('/admin/devices', { ...payload, device_type: tableName });
        const created = response.data?.data ?? response.data;
        return { ...created, device_type: tableName === 'evaratank' ? 'EvaraTank' : tableName === 'evaraflow' ? 'EvaraFlow' : 'EvaraDeep' };
    }

    /**
     * Update a device in its unified table.
     */
    async updateDevice(deviceId: string, deviceType: string, updates: Partial<AnyDevice>): Promise<any> {
        const tableMap: Record<string, string> = {
            EvaraTank: 'evaratank', EvaraFlow: 'evaraflow', EvaraDeep: 'evaradeep',
            evaratank: 'evaratank', evaraflow: 'evaraflow', evaradeep: 'evaradeep',
            tank: 'evaratank', flow: 'evaraflow', deep: 'evaradeep',
        };
        const table = tableMap[deviceType];
        if (!table) throw new Error(`Unknown device type: ${deviceType}`);

        const { data, error } = await (supabase.from(table) as any)
            .update(updates)
            .eq('id', deviceId)
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    // ─── Dashboard ────────────────────────────────────────────────────────────

    async getDashboardSummary(): Promise<any> {
        // Use 30-min threshold consistently with telemetry.py and frontend
        const threshold30m = new Date(Date.now() - 30 * 60 * 1000).toISOString();

        const [
            { count: tankCount },
            { count: flowCount },
            { count: deepCount },
            { count: totalCustomers },
            { count: totalCommunities },
            { count: tankOnline },
            { count: flowOnline },
            { count: deepOnline },
            { count: activeAlerts },
        ] = await Promise.all([
            (supabase.from('evaratank') as any).select('*', { count: 'exact', head: true }).is('deleted_at', null),
            (supabase.from('evaraflow') as any).select('*', { count: 'exact', head: true }).is('deleted_at', null),
            (supabase.from('evaradeep') as any).select('*', { count: 'exact', head: true }).is('deleted_at', null),
            supabase.from('customers').select('*', { count: 'exact', head: true }),
            supabase.from('communities').select('*', { count: 'exact', head: true }),
            (supabase.from('evaratank') as any).select('*', { count: 'exact', head: true }).is('deleted_at', null).gte('last_seen', threshold30m),
            (supabase.from('evaraflow') as any).select('*', { count: 'exact', head: true }).is('deleted_at', null).gte('last_seen', threshold30m),
            (supabase.from('evaradeep') as any).select('*', { count: 'exact', head: true }).is('deleted_at', null).gte('last_seen', threshold30m),
            (supabase.from('alert_events') as any).select('*', { count: 'exact', head: true }).eq('resolved', false),
        ]);

        const totalDevices = (tankCount || 0) + (flowCount || 0) + (deepCount || 0);
        const onlineDevices = (tankOnline || 0) + (flowOnline || 0) + (deepOnline || 0);
        const health = totalDevices ? Math.round(onlineDevices / totalDevices * 100) : 100;

        return {
            total_devices: totalDevices,
            online_devices: onlineDevices,
            alerts_active: activeAlerts || 0,
            alerts_critical: 0,
            alerts_warning: 0,
            total_customers: totalCustomers || 0,
            total_communities: totalCommunities || 0,
            product_tank: tankCount || 0,
            product_flow: flowCount || 0,
            product_deep: deepCount || 0,
            system_health: health,
            timestamp: new Date().toISOString(),
        };
    }

    async getStats(_distributorId?: string): Promise<any> {
        return this.getDashboardSummary();
    }

    // ─── Distributors ─────────────────────────────────────────────────────────

    async getDistributors(): Promise<any[]> {
        const { data, error } = await supabase.from('distributors').select('*').order('name');
        if (error) throw error;
        return data || [];
    }

    // ─── Clients (customers acting as device owners) ──────────────────────────

    /**
     * Get customers who own devices in a community.
     * Replaces the old `clients` table which has been removed.
     */
    async getClients(communityId?: string): Promise<any[]> {
        let q = (supabase.from('customers') as any)
            .select('*, communities(name, zone_id)')
            .neq('status', 'inactive')  // customers table has 'status' not 'is_active'
            .order('display_name');
        if (communityId) q = q.eq('community_id', communityId);
        const { data, error } = await q;
        if (error) throw error;
        return (data || []).map((c: any) => ({ ...c, name: c.display_name }));
    }

    async getClient(id: string): Promise<any> {
        const { data, error } = await (supabase.from('customers') as any)
            .select('*, communities(name, zone_id)')
            .eq('id', id)
            .single();
        if (error) throw error;
        return { ...data, name: data?.display_name };
    }

    async createClient(clientData: any): Promise<any> {
        // customers.id is auth.users FK — must go through backend to create auth user first.
        const email = (clientData.email || '').trim();
        if (!email) throw new Error('Email is required to create a customer account');
        const response = await api.post('/admin/customers', {
            email,
            password:     `Evara${Math.random().toString(36).slice(2, 8).toUpperCase()}@2026`,
            display_name: clientData.name || clientData.display_name || '',
            full_name:    clientData.name || clientData.full_name    || null,
            phone_number: clientData.phone || clientData.phone_number || null,
            community_id: clientData.community_id,
            role:         'customer',
        });
        return response.data;
    }

    async updateClient(id: string, updates: any): Promise<any> {
        const { data, error } = await (supabase.from('customers') as any)
            .update(updates).eq('id', id).select().single();
        if (error) throw error;
        return data;
    }

    async deleteClient(id: string): Promise<void> {
        const { error } = await (supabase.from('customers') as any)
            .update({ status: 'inactive' }).eq('id', id);
        if (error) throw error;
    }

    // ─── Customers ────────────────────────────────────────────────────────────

    async getCustomers(communityId?: string): Promise<Profile[]> {
        let q = supabase.from('customers').select('*, communities(*)');
        if (communityId) q = q.eq('community_id', communityId);
        const { data, error } = await q;
        if (error) throw error;
        return (data || []) as any;
    }

    async getCustomer(id: string): Promise<Profile | null> {
        const { data, error } = await supabase.from('customers').select('*').eq('id', id).single();
        if (error) throw error;
        return data as any;
    }

    async createCustomer(customerData: any): Promise<Customer> {
        // Use backend API — client-side signUp returns null id when email
        // confirmation is enabled, which causes a NOT NULL violation on insert.
        const response = await api.post('/admin/customers', {
            email:        customerData.email,
            password:     customerData.password || 'TemporaryPass123!',
            display_name: customerData.display_name,
            full_name:    customerData.full_name || customerData.display_name,
            phone_number: customerData.phone_number || null,
            role:         customerData.role || 'customer',
            community_id: customerData.community_id,
        });
        return response.data as Customer;
    }

    async updateProfileRole(id: string, role: string): Promise<Profile> {
        const { data, error } = await (supabase.from('customers') as any)
            .update({ role: role as UserRole }).eq('id', id).select().single();
        if (error) throw error;
        return data as Profile;
    }

    // ─── Alerts (stub) ────────────────────────────────────────────────────────

    async getAlertRules(): Promise<AlertRule[]> {
        const { data, error } = await (supabase.from('alert_rules') as any)
            .select('*')
            .order('created_at', { ascending: false });
        if (error) return [];
        return data || [];
    }

    async getActiveAlerts(): Promise<AlertHistory[]> {
        const { data, error } = await (supabase.from('alert_events') as any)
            .select('*')
            .eq('resolved', false)
            .order('created_at', { ascending: false })
            .limit(50);
        if (error) return [];
        return data || [];
    }

    async createAlertRule(_rule: Omit<AlertRule, 'id'>): Promise<AlertRule> {
        throw new Error('Alert rules not yet implemented');
    }
    async deleteAlertRule(_id: string): Promise<void> { return; }

    // ─── Audit logs ───────────────────────────────────────────────────────────

    async getAuditLogs(limit = 10, _distributorId?: string): Promise<any[]> {
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) return [];
        return data || [];
    }

    async updateSystemConfig(_config: any): Promise<any> {
        return { success: true, updated_at: new Date().toISOString() };
    }
}

export const adminService = AdminService.getInstance();

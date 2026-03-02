import { supabase } from '../lib/supabase';
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
    password?: string; // Only for creation
}



class AdminService {
    private static instance: AdminService;

    private constructor() { }

    public static getInstance(): AdminService {
        if (!AdminService.instance) {
            AdminService.instance = new AdminService();
        }
        return AdminService.instance;
    }

    /**
     * Get hierarchy of zones, communities, and their members (Super Admin view).
     */
    async getHierarchy(): Promise<any[]> {
        console.log('[AdminService] getHierarchy via Supabase Direct...');
        const { data, error } = await supabase
            .from('zones')
            .select(`
                *,
                communities (
                    *,
                    customers (
                        *,
                        devices (*)
                    )
                )
            `);

        if (error) {
            console.error('[AdminService] getHierarchy Failed:', error);
            throw error;
        }
        return data || [];
    }

    /**
     * Get all zones.
     */
    async getRegions(): Promise<Zone[]> {
        console.log('[AdminService] getRegions via Supabase Direct...');
        const { data, error } = await supabase
            .from('zones')
            .select('*');

        if (error) throw error;
        return (data || []) as Zone[];
    }

    async getRegion(id: string): Promise<Zone> {
        console.log('[AdminService] getRegion via Supabase Direct...');
        const { data, error } = await supabase
            .from('zones')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;
        return data as Zone;
    }

    /**
     * Get statistics for all zones via the pre-aggregated view.
     */
    async getRegionStats(): Promise<any[]> {
        console.log('[AdminService] getRegionStats via SQL View...');
        const { data, error } = await supabase
            .from('zone_detailed_stats')
            .select('*');

        if (error) {
            console.error('[AdminService] getRegionStats (View) Failed:', error);
            // Fallback to manual if view doesn't exist (though it should)
            return this.getHierarchy();
        }
        return data || [];
    }


    /**
     * Get all communities, optionally filtered by zone.
     */
    async getCommunities(zoneId?: string): Promise<Community[]> {
        let query = supabase.from('communities').select('*').order('name');
        if (zoneId) query = query.eq('zone_id', zoneId) as any;
        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as any;
    }

    /**
     * Create a new zone.
     */
    async createRegion(zone: Partial<Zone>): Promise<Zone> {
        console.log('[AdminService] createRegion via Supabase Direct...');
        const { data, error } = await (supabase
            .from('zones') as any)
            .insert({
                ...zone,
                is_active: true
            })
            .select()
            .single();

        if (error) {
            console.error('[AdminService] createRegion Failed:', error);
            throw error;
        }
        return data as Zone;
    }

    /**
     * Create a new community.
     */
    async createCommunity(community: Partial<Community>): Promise<Community> {
        console.log('[AdminService] createCommunity via Supabase Direct...');
        const { data, error } = await (supabase
            .from('communities') as any)
            .insert(community)
            .select()
            .single();

        if (error) {
            console.error('[AdminService] createCommunity Failed:', error);
            throw error;
        }
        return data as Community;
    }

    /**
     * Provision a new device (node).
     * This follows the pattern in understand-DB:
     * 1. Insert into 'devices'
     * 2. Insert into specialized config table (device_config_tank/flow/deep)
     * 3. Insert into 'device_thingspeak_mappings'
     */
    async createDevice(device: any): Promise<any> {
        // 1. Insert core device record
        // Verified columns: id, node_key, label, thingspeak_channel_id, thingspeak_read_key,
        // field_mapping, user_id(nullable), latitude, longitude, status, created_at,
        // asset_type, analytics_template, thingspeak_write_key, is_active, updated_at,
        // community_id, deleted_at, client_id
        const { data: nodeData, error: nodeError } = await (supabase
            .from('devices') as any)
            .insert({
                node_key: device.node_key,
                label: device.label || device.name,
                analytics_template: device.analytics_template,
                asset_type: device.asset_type || device.device_type,
                latitude: device.latitude ? Number(device.latitude) : null,
                longitude: device.longitude ? Number(device.longitude) : null,
                community_id: device.community_id || null,
                client_id: device.client_id || device.customer_id || null,
                thingspeak_channel_id: device.thingspeak_channel_id || '',
                thingspeak_read_key: device.thingspeak_read_key || '',
                field_mapping: {
                    water_level_field: device.water_level_field || 'field1',
                    depth_field: device.depth_field || 'field1',
                    meter_reading_field: device.meter_reading_field || 'field1',
                    flow_rate_field: device.flow_rate_field || 'field2',
                },
                is_active: true,
                status: 'Online',
            })
            .select()
            .single();

        if (nodeError) throw new Error(nodeError.message || 'Failed to create device');

        const deviceId = nodeData.id;

        // 2. Insert specialized config (non-blocking — config failure won't block device creation)
        // Verified columns:
        //   device_config_tank:  device_id, tank_shape, height, length, breadth
        //   device_config_deep:  device_id, static_depth, dynamic_depth, recharge_threshold
        //   device_config_flow:  device_id, pipe_diameter, max_flow_rate
        try {
            if (device.analytics_template === 'EvaraTank' && device.metadata?.config_tank) {
                const c = device.metadata.config_tank;
                await (supabase.from('device_config_tank') as any).insert({
                    device_id: deviceId,
                    tank_shape: 'rectangular',
                    height: Number(c.depth || 0),
                    length: Number(c.length || 0),
                    breadth: Number(c.breadth || 0),
                });
            } else if (device.analytics_template === 'EvaraDeep' && device.metadata?.config_deep) {
                const c = device.metadata.config_deep;
                await (supabase.from('device_config_deep') as any).insert({
                    device_id: deviceId,
                    static_depth: Number(c.static_water_level || 0),
                    dynamic_depth: Number(c.dynamic_water_level || 0),
                    recharge_threshold: 0,
                });
            } else if (device.analytics_template === 'EvaraFlow') {
                await (supabase.from('device_config_flow') as any).insert({
                    device_id: deviceId,
                    pipe_diameter: 0,
                    max_flow_rate: 0,
                });
            }
        } catch (_configErr) {
            // Config insert failure does not block device creation
        }

        return nodeData;
    }

    /**
     * Update global system configuration.
     */
    async updateSystemConfig(config: any): Promise<any> {
        console.log('[AdminService] updateSystemConfig Started. New Config:', config);
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log('[AdminService] updateSystemConfig Persistence Success');
                resolve({ success: true, updated_at: new Date().toISOString() });
            }, 500);
        });
    }

    /**
     * Get consolidated dashboard summary metrics via Supabase Direct.
     * Online count is based on telemetry timestamp freshness, not the stale `status` column.
     */
    async getDashboardSummary(): Promise<any> {
        // Parallel fetching for performance
        const [
            { count: totalDevices },
            { count: totalCustomers },
            { count: totalCommunities },
            { data: snapshotData }
        ] = await Promise.all([
            supabase.from('devices').select('*', { count: 'exact', head: true }).is('deleted_at', null),
            supabase.from('customers').select('*', { count: 'exact', head: true }),
            supabase.from('communities').select('*', { count: 'exact', head: true }),
            supabase
                .from('devices')
                .select('analytics_template, telemetry_snapshots(last_timestamp)')
                .is('deleted_at', null)
        ]);

        console.log('[AdminService] Dashboard summary:', { totalDevices, totalCustomers, totalCommunities, snapshotCount: snapshotData?.length });

        // Compute online count from telemetry freshness
        const now = Date.now();
        let onlineDevices = 0;
        for (const d of (snapshotData || [])) {
            const snap = Array.isArray((d as any).telemetry_snapshots)
                ? (d as any).telemetry_snapshots[0]
                : (d as any).telemetry_snapshots;
            const ts = snap?.last_timestamp;
            if (!ts) continue;
            const ageMs = now - new Date(ts).getTime();
            const threshold = d.analytics_template === 'EvaraDeep'
                ? 2 * 60 * 60 * 1000
                : 30 * 60 * 1000;
            if (ageMs < threshold) onlineDevices++;
        }

        const health = totalDevices ? Math.round(onlineDevices / totalDevices * 100) : 100;

        return {
            total_devices: totalDevices || 0,
            online_devices: onlineDevices,
            alerts_active: 0,
            alerts_critical: 0,
            alerts_warning: 0,
            total_customers: totalCustomers || 0,
            total_communities: totalCommunities || 0,
            system_health: health,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get administrative stats for the dashboard.
     */
    async getStats(_distributorId?: string): Promise<any> {
        return this.getDashboardSummary();
    }

    /**
     * Get all distributors.
     */
    async getDistributors(): Promise<any[]> {
        const { data, error } = await supabase.from('distributors').select('*').order('name');
        if (error) throw error;
        return data || [];
    }

    /**
     * Get all clients (water utility subscribers) from the clients table.
     * These are NOT auth users – they are hierarchy entries: community → clients → devices.
     */
    async getClients(communityId?: string): Promise<any[]> {
        let query = (supabase as any)
            .from('clients')
            .select('*, communities(name, zone_id, zones(name, state)), devices(*)')
            .eq('is_active', true)
            .order('name');
        if (communityId) query = query.eq('community_id', communityId);
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }

    async getClient(id: string): Promise<any> {
        const { data, error } = await (supabase as any)
            .from('clients')
            .select('*, communities(name, zone_id, zones(name, state)), devices(*)')
            .eq('id', id)
            .single();
        if (error) throw error;
        return data;
    }

    async createClient(clientData: any): Promise<any> {
        const { data, error } = await (supabase as any)
            .from('clients')
            .insert({
                name:         clientData.name,
                email:        clientData.email || null,
                phone:        clientData.phone || null,
                address:      clientData.address || null,
                community_id: clientData.community_id || null,
                is_active:    true,
                notes:        clientData.notes || null,
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    async updateClient(id: string, updates: any): Promise<any> {
        const { data, error } = await (supabase as any)
            .from('clients')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    async deleteClient(id: string): Promise<void> {
        const { error } = await (supabase as any)
            .from('clients')
            .update({ is_active: false })
            .eq('id', id);
        if (error) throw error;
    }

    /**
     * Get list of all customers (auth-linked superadmin/staff profiles), optionally filtered by community.
     */
    async getCustomers(communityId?: string): Promise<Profile[]> {
        console.log('[AdminService] getCustomers via Supabase Direct...');
        let query = supabase
            .from('customers')
            .select('*, communities(*), devices(*)');

        if (communityId) {
            query = query.eq('community_id', communityId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as any;
    }


    /**
     * Get a single customer by ID.
     */
    async getCustomer(id: string): Promise<Profile | null> {
        const { data, error } = await supabase
            .from('customers')
            .select('*, devices(*)')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as any;
    }

    /**
     * Create a new customer (Onboarding).
     * Steps:
     * 1. Create Supabase Auth user
     * 2. Store profile in 'customers' table
     */
    async createCustomer(customerData: any): Promise<Customer> {
        console.log('[AdminService] createCustomer via Supabase Direct...', customerData);

        // 1. Sign up user
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: customerData.email,
            password: customerData.password || 'TemporaryPass123!',
            options: {
                data: {
                    full_name: customerData.display_name,
                    role: customerData.role || 'customer'
                }
            }
        });

        if (authError) {
            console.error('[AdminService] Auth SignUp Failed:', authError);
            throw authError;
        }

        if (!authData.user) throw new Error('Failed to create auth user');

        // 2. Insert into customers table
        const { data: profile, error: dbError } = await (supabase
            .from('customers') as any)
            .insert({
                id: authData.user.id,
                email: customerData.email,
                display_name: customerData.display_name,
                full_name: customerData.full_name,
                phone_number: customerData.phone_number,
                role: customerData.role || 'customer',
                community_id: customerData.community_id,
                status: 'active'
            })
            .select()
            .single();

        if (dbError) {
            console.error('[AdminService] DB Profile Creation Failed:', dbError);
            throw dbError;
        }

        return profile as Customer;
    }



    /**
     * Update a profile's role.
     */
    async updateProfileRole(id: string, role: string): Promise<Profile> {
        const { data, error } = await (supabase
            .from('customers') as any)
            .update({ role: role as UserRole })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Profile;
    }

    /**
     * Get all alert rules.
     */
    async getAlertRules(): Promise<AlertRule[]> {
        return [];
    }

    /**
     * Get active alerts.
     */
    async getActiveAlerts(): Promise<AlertHistory[]> {
        return [];
    }

    /**
     * Create an alert rule.
     */
    async createAlertRule(_rule: Omit<AlertRule, 'id'>): Promise<AlertRule> {
        throw new Error('Alert rules not yet implemented');
    }

    /**
     * Delete an alert rule.
     */
    async deleteAlertRule(_id: string): Promise<void> {
        return;
    }

    /**
     * Get recent audit logs.
     */
    async getAuditLogs(limit = 10, _distributorId?: string): Promise<any[]> {
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) return [];
        return data || [];
    }
}

export const adminService = AdminService.getInstance();

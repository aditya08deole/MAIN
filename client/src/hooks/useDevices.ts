import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export interface Device {
    id: string;
    name: string;
    asset_type: string;  // pump, sump, tank, bore, govt
    asset_category?: string;
    device_type?: string;  // tank, deep, flow - determines analytics page
    physical_category?: string;
    analytics_template?: string;  // EvaraTank, EvaraDeep, EvaraFlow
    latitude: number;
    longitude: number;
    capacity?: string;
    specifications?: string;
    status: string;
    device_status: string;
    is_active: string;
    community_id?: string;
    last_seen?: string;
    is_stale?: boolean;
    created_at?: string;
    updated_at?: string;
}

/**
 * Hook to fetch all devices for the current user
 * Uses Supabase Direct for user-scoped data (replaces public map endpoint)
 */
export const useDevices = (searchQuery: string = '', enableRealtime: boolean = true) => {
    const { user } = useAuth();

    const { data: devices = [], isLoading, error, refetch } = useQuery<Device[]>({
        queryKey: ['user_devices', user?.id, searchQuery],
        queryFn: async () => {
            if (!user?.id) return [];

            try {
                // Fetch from all 3 unified device tables in parallel
                const [tankRes, flowRes, deepRes] = await Promise.all([
                    supabase.from('evaratank' as any).select('*'),
                    supabase.from('evaraflow' as any).select('*'),
                    supabase.from('evaradeep' as any).select('*'),
                ]);

                const fetchError = tankRes.error || flowRes.error || deepRes.error;
                if (fetchError && !tankRes.data && !flowRes.data && !deepRes.data)
                    throw fetchError || new Error('No devices found');

                const result = [
                    ...(tankRes.data || []).map((d: any) => ({ ...d, _device_type: 'EvaraTank' })),
                    ...(flowRes.data || []).map((d: any) => ({ ...d, _device_type: 'EvaraFlow' })),
                    ...(deepRes.data || []).map((d: any) => ({ ...d, _device_type: 'EvaraDeep' })),
                ];

                if (!result.length) throw new Error('No devices found');

                // Map the DB rows to Device type
                let mappedResult: Device[] = result.map((d: any) => {
                    const lastSeen = d.last_seen;
                    const lastSeenDate = lastSeen ? new Date(lastSeen) : null;
                    const isStale = lastSeenDate
                        ? (new Date().getTime() - lastSeenDate.getTime()) > 10 * 60 * 1000
                        : true;

                    return {
                        id: d.id,
                        name: d.label || d.name || 'Unknown Device',
                        asset_type: d.asset_type || 'Unknown',
                        asset_category: d.asset_category || undefined,
                        device_type: d.device_type || undefined,
                        physical_category: d.physical_category || undefined,
                        analytics_template: d.analytics_template || undefined,
                        latitude: d.latitude || 0,
                        longitude: d.longitude || 0,
                        capacity: d.capacity || undefined,
                        specifications: d.specifications || undefined,
                        status: d.status || 'active',
                        device_status: isStale ? 'offline' : (d.device_status || 'online'),
                        is_active: d.is_active ? 'true' : 'false',
                        community_id: d.community_id || undefined,
                        last_seen: lastSeen,
                        is_stale: isStale,
                        created_at: d.created_at || undefined,
                        updated_at: d.updated_at || undefined
                    };
                });

                // Apply search filter if provided
                if (searchQuery && mappedResult.length > 0) {
                    const query = searchQuery.toLowerCase();
                    mappedResult = mappedResult.filter(device =>
                        device.name.toLowerCase().includes(query) ||
                        device.asset_type.toLowerCase().includes(query) ||
                        device.asset_category?.toLowerCase().includes(query) ||
                        device.status.toLowerCase().includes(query)
                    );
                }

                return mappedResult;
            } catch (err) {
                console.error('[useDevices] Failed to fetch user devices:', err);
                throw err;
            }
        },
        staleTime: 1000 * 60,
        refetchInterval: enableRealtime ? 60000 : false,
        refetchIntervalInBackground: false,
        retry: 2,
        enabled: !!user?.id,
        placeholderData: keepPreviousData
    });

    return {
        devices,
        loading: isLoading,
        error: error instanceof Error ? error.message : (error ? String(error) : null),
        refresh: refetch
    };
};

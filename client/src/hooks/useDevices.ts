import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export interface Device {
    id: string;
    name: string;
    asset_type: string;  // pump, sump, tank, bore, govt
    asset_category?: string;
    latitude: number;
    longitude: number;
    capacity?: string;
    specifications?: string;
    status: string;
    is_active: string;
    created_at?: string;
    updated_at?: string;
}

/**
 * Hook to fetch all devices with full details
 * For dashboard and detailed views
 * Endpoint: GET /devices/map/all (reusing map endpoint for consistency)
 */
export const useDevices = (searchQuery: string = '') => {
    const { data: devices = [], isLoading, error, refetch } = useQuery<Device[]>({
        queryKey: ['devices', searchQuery],
        queryFn: async () => {
            try {
                const response = await api.get<Device[]>('/devices/map/all');
                let result = response.data;
                
                // Apply search filter if provided
                if (searchQuery) {
                    const query = searchQuery.toLowerCase();
                    result = result.filter(device => 
                        device.name.toLowerCase().includes(query) ||
                        device.asset_type.toLowerCase().includes(query) ||
                        device.asset_category?.toLowerCase().includes(query) ||
                        device.status.toLowerCase().includes(query)
                    );
                }
                
                return result;
            } catch (error: any) {
                console.error('[useDevices] Failed to fetch devices:', error);
                throw error;
            }
        },
        staleTime: 1000 * 60 * 2, // 2 minutes stale time
        retry: 2,
    });

    return {
        devices,
        loading: isLoading,
        error: error instanceof Error ? error.message : (error ? String(error) : null),
        refresh: refetch
    };
};

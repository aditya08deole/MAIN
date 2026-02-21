import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export interface MapDevice {
    id: string;
    name: string;
    asset_type: string;  // pump, sump, tank, bore, govt
    asset_category?: string;
    latitude: number;
    longitude: number;
    capacity?: string;
    specifications?: string;
    status: string;
}

/**
 * Hook to fetch devices optimized for map rendering
 * No authentication required - public map display
 * Endpoint: GET /devices/map/all
 */
export const useMapDevices = () => {
    const { data: devices = [], isLoading, error, refetch } = useQuery<MapDevice[]>({
        queryKey: ['map_devices'],
        queryFn: async () => {
            try {
                const response = await api.get<MapDevice[]>('/devices/map/all');
                return response.data;
            } catch (error: any) {
                console.error('[useMapDevices] Failed to fetch devices:', error);
                throw error;
            }
        },
        staleTime: 1000 * 60 * 5, // 5 minutes stale time (map data doesn't change often)
        retry: 2,
    });

    return {
        devices,
        loading: isLoading,
        error: error instanceof Error ? error.message : (error ? String(error) : null),
        refresh: refetch
    };
};

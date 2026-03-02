import { useQuery } from '@tanstack/react-query';
import { adminService } from '../services/admin';

export interface ZoneStats {
    zone_id: string;
    zone_name: string;
    state: string | null;
    country: string;
    community_count: number;
    customer_count: number;
    device_count: number;
    online_devices: number;
    offline_devices: number;
    health_percent: number;
}

/**
 * Hook to fetch pre-aggregated statistics for all geographic zones.
 * Powered by public.zone_detailed_stats view for high performance.
 */
export const useZoneStats = () => {
    const { data: stats = [], isLoading, error, refetch } = useQuery<ZoneStats[]>({
        queryKey: ['zone_detailed_stats'],
        queryFn: async () => {
            try {
                return await adminService.getRegionStats();
            } catch (err: any) {
                console.error('[useZoneStats] Fetch failed:', err);
                throw err;
            }
        },
        staleTime: 1000 * 30, // 30 seconds
        refetchInterval: 1000 * 10, // Refetch every 10 seconds for live feel
    });

    return {
        stats,
        isLoading,
        error,
        refetch
    };
};

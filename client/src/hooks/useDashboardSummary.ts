import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { adminService } from '../services/admin';
import { useAuth } from '../context/AuthContext';

export interface DashboardSummary {
    total_devices: number;
    online_devices: number;
    deployed_active: number;
    deployed_inactive: number;
    health_working: number;
    health_not_working: number;
    product_tank: number;
    product_flow: number;
    product_deep: number;
    alerts_active: number;
    alerts_critical: number;
    alerts_warning: number;
    tanks_full: number;
    tanks_not_full: number;
    system_health: number;
    timestamp: string;
}

export const useDashboardSummary = () => {
    const { isAuthenticated } = useAuth();

    return useQuery<DashboardSummary>({
        queryKey: ['dashboard_summary'],
        queryFn: async () => {
            if (!isAuthenticated) {
                throw new Error('Not authenticated');
            }
            return await adminService.getDashboardSummary();
        },
        staleTime: 1000 * 30,              // 30 seconds stale
        gcTime: 5 * 60_000,                // P28: keep data in cache 5 min after unmount
        refetchInterval: 5000,             // background refresh every 5 seconds for "instant" feel
        retry: 1,                          // P28: retry once instead of failing permanently
        retryDelay: 2000,                  // P28: 2s delay before retry
        refetchOnWindowFocus: true,        // P28: immediately refresh when user tabs back
        enabled: isAuthenticated,
        placeholderData: keepPreviousData, // show last known data immediately while refetching
    });
};

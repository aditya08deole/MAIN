import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { adminService } from '../services/admin';
import { useAuth } from '../context/AuthContext';

export interface DashboardSummary {
    total_devices: number;
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
        staleTime: 1000 * 30,         // 30 seconds stale
        refetchInterval: 5000,        // background refresh every 5 seconds for "instant" feel
        retry: 0,                       // fail fast, don't retry & delay
        enabled: isAuthenticated,
        placeholderData: keepPreviousData, // show last known data immediately while refetching
    });
};

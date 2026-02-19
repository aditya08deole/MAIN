import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export interface DashboardStats {
    total_nodes: number;
    online_nodes: number;
    active_alerts: number;
    system_health: string;
}

export const useDashboardStats = () => {
    return useQuery({
        queryKey: ['dashboard_stats'],
        queryFn: async () => {
            const { data } = await api.get<DashboardStats>('/dashboard/stats');
            return data;
        },
        staleTime: 1000 * 60 * 2, // 2 minutes
        refetchInterval: 1000 * 60 * 5, // Auto-refresh every 5 mins
        retry: 1
    });
};

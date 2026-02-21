import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import type { AlertHistory } from '../services/alerts';

export interface DashboardStats {
    total_nodes: number;
    online_nodes: number;
    active_alerts: number;
    system_health: string;
}

export interface SystemHealth {
    status: string;
    services: {
        database: string;
        thingspeak: string;
    };
}

export const useDashboardStats = () => {
    return useQuery({
        queryKey: ['dashboard_stats'],
        queryFn: async () => {
            // Check if user is authenticated before making request
            const stored = localStorage.getItem('evara_session');
            if (!stored) {
                console.warn('[useDashboardStats] No authentication found, returning zeros');
                return {
                    total_nodes: 0,
                    online_nodes: 0,
                    active_alerts: 0,
                    system_health: 'Unknown'
                };
            }

            try {
                const { data } = await api.get<DashboardStats>('/dashboard/stats');
                return data;
            } catch (error: any) {
                // Return zeros if endpoint fails (graceful degradation)
                if (error.response?.status === 401 || error.response?.status === 403) {
                    console.warn('[useDashboardStats] Authentication failed, returning zeros');
                } else {
                    console.warn('[useDashboardStats] Request failed:', error.message);
                }
                return {
                    total_nodes: 0,
                    online_nodes: 0,
                    active_alerts: 0,
                    system_health: 'Unknown'
                };
            }
        },
        staleTime: 1000 * 60 * 2, // 2 minutes
        refetchInterval: 1000 * 60 * 5, // Auto-refresh every 5 mins
        retry: false // Don't retry auth failures
    });
};

export const useSystemHealth = () => {
    return useQuery({
        queryKey: ['system_health'],
        queryFn: async () => {
            // Health endpoint is at root level, not under /api/v1
            const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
            const healthUrl = backendUrl.replace('/api/v1', '/health');
            const response = await fetch(healthUrl);
            if (!response.ok) {
                throw new Error(`Health check failed: ${response.status}`);
            }
            const data = await response.json();
            return data as SystemHealth;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: 1
    });
};

export const useActiveAlerts = () => {
    return useQuery({
        queryKey: ['active_alerts'],
        queryFn: async () => {
            // Check if user is authenticated before making request
            const stored = localStorage.getItem('evara_session');
            if (!stored) {
                console.warn('[useActiveAlerts] No authentication found, returning empty array');
                return [];
            }

            try {
                const { data } = await api.get<AlertHistory[]>('/dashboard/alerts');
                return data; // Backend returns List[Dict] which matches AlertHistory[]
            } catch (error: any) {
                // Return empty array if endpoint fails
                if (error.response?.status === 401 || error.response?.status === 403) {
                    console.warn('[useActiveAlerts] Authentication failed, returning empty array');
                } else {
                    console.warn('[useActiveAlerts] Request failed:', error.message);
                }
                return [];
            }
        },
        staleTime: 1000 * 30, // 30 seconds
        refetchInterval: 1000 * 60, // Auto-refresh every 1 min
        retry: false // Don't retry auth failures
    });
};

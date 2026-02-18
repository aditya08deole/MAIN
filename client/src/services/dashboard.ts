import api from './api';

export interface DashboardStats {
    total_nodes: number;
    online_nodes: number;
    active_alerts: number;
}

export interface SystemHealth {
    status: string;
    services: {
        database: string;
        thingspeak: string;
    };
}

export const getDashboardStats = async (): Promise<DashboardStats> => {
    const response = await api.get<DashboardStats>('/dashboard/stats');
    return response.data;
};

export const getSystemHealth = async (): Promise<SystemHealth> => {
    const response = await api.get<SystemHealth>('/health');
    return response.data;
};

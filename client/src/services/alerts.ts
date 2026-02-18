import api from './api';

export interface AlertRule {
    id: string;
    name: string;
    node_id: string;
    metric: string;
    condition: '>' | '<' | '==';
    threshold: number;
    enabled: boolean;
}

export interface AlertHistory {
    id: string;
    rule_id: string;
    node_id: string;
    triggered_at: string;
    value_at_time: number;
    resolved_at?: string;
    rule: AlertRule;
}

export const getAlertRules = async (): Promise<AlertRule[]> => {
    const response = await api.get<AlertRule[]>('/alerts/rules');
    return response.data;
};

export const createAlertRule = async (rule: Omit<AlertRule, 'id'>): Promise<AlertRule> => {
    const response = await api.post<AlertRule>('/alerts/rules', rule);
    return response.data;
};

export const deleteAlertRule = async (id: string): Promise<void> => {
    await api.delete(`/alerts/rules/${id}`);
};

export const getActiveAlerts = async (): Promise<AlertHistory[]> => {
    const response = await api.get<AlertHistory[]>('/dashboard/alerts');
    return response.data;
};

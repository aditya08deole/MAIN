import api from './api';

export interface AuditLog {
    id: string;
    actor_id: string;
    action: string;
    resource_type: string;
    resource_id?: string;
    details?: Record<string, string | number | boolean>;
    timestamp: string;
    user?: {
        full_name: string;
        email: string;
    };
}

export const getAuditLogs = async (limit = 100): Promise<AuditLog[]> => {
    const response = await api.get<AuditLog[]>(`/admin/audit-logs`, {
        params: { limit }
    });
    return response.data;
};

export const exportAuditLogs = async (): Promise<void> => {
    const response = await api.get(`/reports/audit-logs/export`, {
        responseType: 'blob',
    });

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'audit_logs.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
};

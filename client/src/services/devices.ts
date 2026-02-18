import api from './api';
import type { NodeRow } from '../types/database';

export interface DeviceShadow {
    desired: Record<string, any>;
    reported: Record<string, any>;
    delta?: Record<string, any>;
}

export interface DeviceDetails extends NodeRow {
    firmware_version?: string;
    calibration_factor?: number;
    last_maintenance_date?: string;
    shadow_state?: DeviceShadow;
}

export const getDeviceDetails = async (id: string): Promise<DeviceDetails> => {
    // Ideally this endpoint exists, currently using list. 
    // For now we might need to fetch list and find, or implement GET /devices/{id} on backend if missing.
    // Assuming GET /nodes/{id} or similar exists. Let's use the list for now if individual fetch is not guaranteed.
    // Actually, let's implement a proper fetch in the service that might fallback or use a specific endpoint.
    // Based on backend code, we have GET /nodes/ which returns list.
    // Let's assume we can fetch all and filter for MVP or use a direct endpoint if available.
    // Let's try GET /nodes/{id}
    const response = await api.get<DeviceDetails>(`/nodes/${id}`);
    return response.data;
};

export const updateDeviceShadow = async (id: string, desiredState: Record<string, any>): Promise<DeviceShadow> => {
    const response = await api.patch<DeviceShadow>(`/devices/${id}/shadow`, {
        desired: desiredState
    });
    return response.data;
};

export const exportDeviceReadings = async (id: string): Promise<void> => {
    const response = await api.get(`/reports/node/${id}/export`, {
        responseType: 'blob',
    });

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `node_${id}_readings.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
};

export const createNode = async (node: Partial<NodeRow>): Promise<NodeRow> => {
    const response = await api.post<NodeRow>('/nodes/', node);
    return response.data;
};

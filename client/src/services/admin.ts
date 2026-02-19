import api from './api';

export const adminService = {
    async createCommunity(data: { name: string; region: string }) {
        const response = await api.post('/communities', data);
        return response.data;
    },

    async createCustomer(data: { name: string; email: string; community_id: string }) {
        const response = await api.post('/customers', data);
        return response.data;
    },

    async createDevice(data: { hardware_id: string; type: string }) {
        const response = await api.post('/devices', data);
        return response.data;
    },

    async updateSystemConfig(data: { rate: number; firmware: string }) {
        const response = await api.put('/system/config', data);
        return response.data;
    }
};

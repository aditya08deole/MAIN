import api from './api';

export const adminService = {
    async getCommunities() {
        const response = await api.get('/communities');
        return response.data;
    },

    async getCustomers() {
        const response = await api.get('/customers');
        return response.data;
    },

    async getCustomer(id: string) {
        const response = await api.get(`/customers/${id}`);
        return response.data;
    },

    async getDistributors() {
        const response = await api.get('/distributors');
        return response.data;
    },

    async createCommunity(data: { name: string; region: string; city?: string }) {
        const response = await api.post('/communities', data);
        return response.data;
    },

    async createCustomer(data: { name: string; email: string; community_id: string; password?: string; contact_number?: string }) {
        const response = await api.post('/customers/onboard', data);
        return response.data;
    },

    async createDevice(data: { hardware_id: string; type: string }) {
        const response = await api.post('/nodes/', data);
        return response.data;
    },

    async updateSystemConfig(data: { rate: number; firmware: string }) {
        const response = await api.put('/system/config', data);
        return response.data;
    },

    async getStats() {
        const response = await api.get('/stats');
        return response.data;
    },

    async getAuditLogs(skip = 0, limit = 50) {
        const response = await api.get(`/audit?skip=${skip}&limit=${limit}`);
        return response.data;
    }
};

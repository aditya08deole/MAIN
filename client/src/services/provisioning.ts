import api from './api';

export interface ProvisioningResult {
    success: boolean;
    message: string;
    device?: {
        id: string;
        label: string;
    };
}

export const claimDevice = async (token: string, hardwareId: string, label: string): Promise<ProvisioningResult> => {
    const response = await api.post<ProvisioningResult>('/devices/claim', {
        token,
        hardware_id: hardwareId,
        label
    });
    return response.data;
};

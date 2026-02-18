import api from './api';

export interface UserProfile {
    id: string;
    email: string;
    full_name?: string;
    role: string;
    is_active: boolean;
}

export const getUsers = async (): Promise<UserProfile[]> => {
    const response = await api.get<UserProfile[]>('/users');
    return response.data;
};

export const updateUserRole = async (userId: string, role: string): Promise<UserProfile> => {
    const response = await api.put<UserProfile>(`/users/${userId}/role`, { role });
    return response.data;
};

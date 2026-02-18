// import api from './api';

export interface UserPreferences {
    email_notifications: boolean;
    sms_notifications: boolean;
    theme: 'light' | 'dark' | 'system';
}

export const getUserPreferences = async (): Promise<UserPreferences> => {
    // Mock response for now as backend endpoint might need specific implementation
    // Or assume GET /users/me/preferences
    // For MVP, returning default or fetching via user profile
    return {
        email_notifications: true,
        sms_notifications: false,
        theme: 'light'
    };
};

export const updateUserPreferences = async (prefs: Partial<UserPreferences>): Promise<UserPreferences> => {
    // Mock update
    // await api.patch('/users/me/preferences', prefs);
    return {
        email_notifications: prefs.email_notifications ?? true,
        sms_notifications: prefs.sms_notifications ?? false,
        theme: prefs.theme ?? 'light'
    };
};

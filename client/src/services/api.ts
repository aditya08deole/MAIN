import axios, { type InternalAxiosRequestConfig, type AxiosResponse, type AxiosError } from 'axios';

// Create Axios Instance
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor: Attach Supabase Token
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        // More robust way to find the Supabase auth token
        let token: string | null = null;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
                try {
                    const session = JSON.parse(localStorage.getItem(key) || '{}');
                    token = session.access_token || null;
                } catch (e) {
                    console.error('Failed to parse Supabase session:', e);
                }
                break;
            }
        }

        if (token) {
            config.headers.set('Authorization', `Bearer ${token}`);
        }
        return config;
    },
    (error: AxiosError) => Promise.reject(error)
);

// Response Interceptor: Handle 401 (Optional)
api.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError) => {
        if (error.response && error.response.status === 401) {
            // Redirect to login or refresh token
            // window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;

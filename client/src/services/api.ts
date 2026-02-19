import axios, { type InternalAxiosRequestConfig, type AxiosResponse, type AxiosError } from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
console.log('Backend API Base URL:', baseURL);

// Create Axios Instance
const api = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 15000, // 15 seconds timeout
});

// Request Interceptor: Attach Supabase Token or Dev-Bypass Token
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        let token: string | null = null;

        // 1. Try Supabase auth token (real login)
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

        // 2. Fallback: dev-bypass session (no Supabase token; backend accepts Bearer dev-bypass-*)
        if (!token) {
            try {
                const stored = localStorage.getItem('evara_session');
                if (stored) {
                    const { user } = JSON.parse(stored);
                    if (user?.id && typeof user.id === 'string' && user.id.startsWith('dev-bypass-')) {
                        token = user.id;
                    }
                }
            } catch {
                // ignore
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

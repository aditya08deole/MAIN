import axios, { type InternalAxiosRequestConfig, type AxiosResponse, type AxiosError } from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
console.log('Backend API Base URL:', baseURL);

// Create Axios Instance
const api = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 10000, // 10 seconds global timeout
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

// Response Interceptor: Auto-unwrap StandardResponse & Handle Errors
api.interceptors.response.use(
    (response: AxiosResponse) => {
        // Standard Response Unwrapping (Envelope Pattern)
        // If the backend returns { status: "success", data: ... }, we return the inner data
        // to keep the rest of the app working with direct data access.
        if (response.data && typeof response.data === 'object' && 'status' in response.data && 'data' in response.data) {
            return { ...response, data: response.data.data, meta: response.data.meta };
        }
        return response;
    },
    (error: AxiosError) => {
        if (error.response && error.response.status === 401) {
            // Redirect to login or refresh token
            // window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;

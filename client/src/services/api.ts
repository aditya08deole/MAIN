import axios, { type AxiosResponse, type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { supabase } from '../lib/supabase';

// Use relative path so requests go through the Vite dev-server proxy (→ backend)
// In production, nginx handles /api routing. Absolute localhost:8000 bypasses the proxy.
const baseURL = import.meta.env.VITE_API_URL || '/api/v1';

// Create Axios Instance
const api = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 10000, // 10 seconds — fail fast, show error instead of hanging
});

// Request Interceptor: Inject Supabase Session Token
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
            config.headers.Authorization = `Bearer ${session.access_token}`;
        }
    } catch (error) {
        console.error('[API Interceptor] Failed to get session:', error);
    }
    return config;
});

// Response Interceptor: Auto-unwrap StandardResponse & Handle Errors
api.interceptors.response.use(
    (response: AxiosResponse) => {
        // Standard Response Unwrapping (Envelope Pattern)
        if (response.data && typeof response.data === 'object' && 'status' in response.data && 'data' in response.data) {
            return { ...response, data: response.data.data, meta: response.data.meta };
        }
        return response;
    },
    (error: AxiosError) => {
        return Promise.reject(error);
    }
);

export default api;

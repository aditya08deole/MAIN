import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import type { NodeRow } from '../types/database';

export const useNodes = (searchQuery: string = '') => {
    const queryClient = useQueryClient();

    const { data: nodes = [], isLoading, error, refetch } = useQuery<NodeRow[]>({
        queryKey: ['nodes', searchQuery],
        queryFn: async () => {
            // Check if user is authenticated before making request
            const stored = localStorage.getItem('evara_session');
            if (!stored) {
                console.warn('[useNodes] No authentication found, returning empty array');
                return [];
            }

            try {
                const params = searchQuery ? { q: searchQuery } : {};
                const response = await api.get<NodeRow[]>('/nodes/', { params });
                return response.data;
            } catch (error: any) {
                // Gracefully handle auth errors
                if (error.response?.status === 401 || error.response?.status === 403) {
                    console.warn('[useNodes] Authentication failed, returning empty array');
                    return [];
                }
                throw error; // Re-throw other errors
            }
        },
        staleTime: 1000 * 60, // 1 minute stale time (background updates after this)
        retry: false, // Don't retry auth failures
        placeholderData: (prev) => prev, // Keep showing old data while filtering (replaces keepPreviousData)
    });

    // ─── WebSocket Reactive Listener ───
    useEffect(() => {
        const wsBase = import.meta.env.VITE_API_URL
            ? import.meta.env.VITE_API_URL.replace('http', 'ws')
            : 'ws://localhost:8000/api/v1';

        const wsUrl = `${wsBase}/ws/ws`;
        console.log("Connecting to WebSocket:", wsUrl);

        let socket: WebSocket | null = null;
        let retryTimeout: ReturnType<typeof setTimeout> | null = null;

        const connect = () => {
            socket = new WebSocket(wsUrl);

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.event === "NODE_PROVISIONED" || data.event === "STATUS_UPDATE") {
                        console.log(`🚀 ${data.event} received! Invalidating cache...`);
                        queryClient.invalidateQueries({ queryKey: ['nodes'] });
                        // Also invalidate dashboard stats
                        queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
                    }
                } catch { }
            };

            socket.onclose = () => {
                console.log("WS Closed. Retrying...");
                retryTimeout = setTimeout(connect, 3000);
            }
        };

        connect();

        return () => {
            if (socket) socket.close();
            if (retryTimeout) clearTimeout(retryTimeout);
        };
    }, [queryClient]);

    return {
        nodes,
        loading: isLoading,
        error: error instanceof Error ? error.message : (error ? String(error) : null),
        refresh: refetch
    };
};

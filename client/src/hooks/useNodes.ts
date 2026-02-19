import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import type { NodeRow } from '../types/database';

export const useNodes = (searchQuery: string = '') => {
    const queryClient = useQueryClient();

    const { data: nodes = [], isLoading, error, refetch } = useQuery<NodeRow[]>({
        queryKey: ['nodes', searchQuery],
        queryFn: async () => {
            const params = searchQuery ? { q: searchQuery } : {};
            const response = await api.get<NodeRow[]>('/nodes/', { params });
            return response.data;
        },
        staleTime: 1000 * 60, // 1 minute stale time (background updates after this)
        retry: 1, // Fail fast on error
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
        let retryTimeout: any = null;

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

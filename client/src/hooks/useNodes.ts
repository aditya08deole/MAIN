import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import type { NodeRow } from '../types/database';

export const useNodes = () => {
    const [nodes, setNodes] = useState<NodeRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchNodes = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get<NodeRow[]>('/nodes/');
            setNodes(response.data);
            setError(null);
        } catch (err: any) {
            const status = err.response?.status;
            const detail = err.response?.data?.detail;
            if (status === 401) {
                const msg = typeof detail === "string" && detail.includes("not synchronized")
                    ? "Your account is not synced with the backend. Please log out and log in again."
                    : "Please log in again to view nodes.";
                setError(msg);
            } else {
                setError(typeof detail === "string" ? detail : "Failed to fetch nodes");
            }
            console.error("Error fetching nodes:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNodes();
    }, [fetchNodes]);

    return { nodes, loading, error, refresh: fetchNodes };
};

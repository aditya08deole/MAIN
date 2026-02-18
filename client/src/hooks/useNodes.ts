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
            setError(err.response?.data?.detail || "Failed to fetch nodes");
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

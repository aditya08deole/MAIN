import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import type { PipelineRow, PipelineInsert } from '../types/database';

interface UsePipelinesResult {
    pipelines: PipelineRow[];
    loading: boolean;
    error: string | null;
    addPipeline: (p: Omit<PipelineInsert, 'created_by'>) => Promise<PipelineRow | null>;
    updatePipeline: (id: string, p: Partial<Omit<PipelineInsert, 'created_by'>>) => Promise<void>;
    deletePipeline: (id: string) => Promise<void>;
}

export function usePipelines(): UsePipelinesResult {
    const [pipelines, setPipelines] = useState<PipelineRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPipelines = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get<PipelineRow[]>('/pipelines/');
            setPipelines(response.data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to fetch pipelines");
            console.error("Error fetching pipelines:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPipelines();
    }, [fetchPipelines]);

    const addPipeline = useCallback(async (
        p: Omit<PipelineInsert, 'created_by'>
    ): Promise<PipelineRow | null> => {
        try {
            const response = await api.post<PipelineRow>('/pipelines/', p);
            const row = response.data;
            setPipelines(prev => [...prev, row]);
            return row;
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to add pipeline");
            return null;
        }
    }, []);

    const updatePipeline = useCallback(async (
        id: string,
        p: Partial<Omit<PipelineInsert, 'created_by'>>
    ): Promise<void> => {
        try {
            await api.patch(`/pipelines/${id}`, p);
            setPipelines(prev => prev.map(pl => pl.id === id ? { ...pl, ...p } : pl));
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to update pipeline");
        }
    }, []);

    const deletePipeline = useCallback(async (id: string): Promise<void> => {
        try {
            await api.delete(`/pipelines/${id}`);
            setPipelines(prev => prev.filter(pl => pl.id !== id));
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to delete pipeline");
        }
    }, []);

    return { pipelines, loading, error, addPipeline, updatePipeline, deletePipeline };
}

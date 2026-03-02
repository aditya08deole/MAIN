import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
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
            const { data, error } = await supabase.from('pipelines').select('*');
            if (error) throw error;
            setPipelines((data || []) as PipelineRow[]);
            setError(null);
        } catch (err: any) {
            setError(err.message || "Failed to fetch pipelines");
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
            const { data, error } = await supabase.from('pipelines').insert(p as any).select().single();
            if (error) throw error;
            setPipelines(prev => [...prev, data as unknown as PipelineRow]);
            return data;
        } catch (err: any) {
            setError(err.message || "Failed to add pipeline");
            return null;
        }
    }, []);

    const updatePipeline = useCallback(async (
        id: string,
        p: Partial<Omit<PipelineInsert, 'created_by'>>
    ): Promise<void> => {
        try {
            const { error } = await (supabase.from('pipelines') as any).update(p).eq('id', id);
            if (error) throw error;
            setPipelines(prev => prev.map(pl => pl.id === id ? { ...pl, ...(p as any) } : pl));
        } catch (err: any) {
            setError(err.message || "Failed to update pipeline");
        }
    }, []);

    const deletePipeline = useCallback(async (id: string): Promise<void> => {
        try {
            const { error } = await supabase.from('pipelines').delete().eq('id', id);
            if (error) throw error;
            setPipelines(prev => prev.filter(pl => pl.id !== id));
        } catch (err: any) {
            setError(err.message || "Failed to delete pipeline");
        }
    }, []);

    return { pipelines, loading, error, addPipeline, updatePipeline, deletePipeline };
}

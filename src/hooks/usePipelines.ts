import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { PipelineRow, PipelineInsert } from '../types/database';
import { STATIC_PIPELINES } from '../data/staticData';

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
        // Imitate a very short delay
        setTimeout(() => {
            setPipelines(STATIC_PIPELINES);
            setLoading(false);
        }, 100);
    }, []);

    useEffect(() => { fetchPipelines(); }, [fetchPipelines]);

    const addPipeline = useCallback(async (
        p: Omit<PipelineInsert, 'created_by'>
    ): Promise<PipelineRow | null> => {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error: err } = await supabase
            .from('pipelines')
            // @ts-ignore
            .insert({ ...p, created_by: user?.id ?? null })
            .select()
            .single();
        if (err) { setError(err.message); return null; }
        const row = data as PipelineRow;
        setPipelines(prev => [...prev, row]);
        return row;
    }, []);

    const updatePipeline = useCallback(async (
        id: string,
        p: Partial<Omit<PipelineInsert, 'created_by'>>
    ): Promise<void> => {
        const { error: err } = await supabase
            .from('pipelines')
            // @ts-ignore
            .update({ ...p, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (err) { setError(err.message); return; }
        setPipelines(prev => prev.map(pl => pl.id === id ? { ...pl, ...p } : pl));
    }, []);

    const deletePipeline = useCallback(async (id: string): Promise<void> => {
        const { error: err } = await supabase
            .from('pipelines')
            .delete()
            .eq('id', id);
        if (err) { setError(err.message); return; }
        setPipelines(prev => prev.filter(pl => pl.id !== id));
    }, []);

    return { pipelines, loading, error, addPipeline, updatePipeline, deletePipeline };
}

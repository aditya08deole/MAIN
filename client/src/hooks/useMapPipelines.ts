import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface MapPipeline {
    id: string;
    name: string;
    positions: [number, number][];  // [[lat, lng], [lat, lng], ...]
    color: string;
    status: string;
}

/**
 * Hook to fetch pipelines optimized for map rendering via Supabase Direct.
 */
export const useMapPipelines = () => {
    const { data: pipelines = [], isLoading, error, refetch } = useQuery<MapPipeline[]>({
        queryKey: ['map_pipelines'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('pipelines')
                .select('*');

            if (error) {
                console.error('[useMapPipelines] Failed to fetch pipelines:', error);
                throw error;
            }

            // Map to positions format if needed (assuming DB stores GeoJSON or similar)
            return (data || []).map((p: any) => ({
                ...p,
                positions: p.coordinates || []
            }));
        },
        staleTime: 1000 * 60 * 5,
        retry: 2,
    });

    return {
        pipelines,
        loading: isLoading,
        error: error instanceof Error ? error.message : (error ? String(error) : null),
        refresh: refetch
    };
};

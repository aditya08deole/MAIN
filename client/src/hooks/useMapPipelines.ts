import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export interface MapPipeline {
    id: string;
    name: string;
    positions: [number, number][];  // [[lat, lng], [lat, lng], ...]
    color: string;
}

/**
 * Hook to fetch pipelines optimized for map rendering
 * No authentication required - public map display
 * Endpoint: GET /pipelines
 */
export const useMapPipelines = () => {
    const { data: pipelines = [], isLoading, error, refetch } = useQuery<MapPipeline[]>({
        queryKey: ['map_pipelines'],
        queryFn: async () => {
            try {
                const response = await api.get<MapPipeline[]>('/pipelines');
                return response.data;
            } catch (error: any) {
                console.error('[useMapPipelines] Failed to fetch pipelines:', error);
                throw error;
            }
        },
        staleTime: 1000 * 60 * 5, // 5 minutes stale time (pipeline data doesn't change often)
        retry: 2,
    });

    return {
        pipelines,
        loading: isLoading,
        error: error instanceof Error ? error.message : (error ? String(error) : null),
        refresh: refetch
    };
};

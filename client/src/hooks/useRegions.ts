import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export interface Region {
    id: string;
    name: string;
    state: string | null;
    created_at: string;
    updated_at: string;
}

/**
 * Hook to fetch all regions (cities)
 * No authentication required - public data
 * Endpoint: GET /api/v1/regions
 */
export const useRegions = () => {
    const { data: regions = [], isLoading, error, refetch } = useQuery<Region[]>({
        queryKey: ['regions'],
        queryFn: async () => {
            try {
                const response = await api.get<Region[]>('/regions');
                return response.data;
            } catch (error: any) {
                console.error('[useRegions] Failed to fetch regions:', error);
                throw error;
            }
        },
        staleTime: 1000 * 60 * 10, // 10 minutes - regions don't change often
        retry: 2,
    });

    return {
        regions,
        isLoading,
        error,
        refetch
    };
};

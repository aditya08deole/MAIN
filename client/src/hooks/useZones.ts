import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface Zone {
    id: string;
    name: string;
    state: string | null;
    created_at: string;
    updated_at: string;
}

/**
 * Hook to fetch all zones (cities)
 * No authentication required - public data
 * Endpoint: GET /api/v1/zones
 */
export const useZones = () => {
    const { data: zones = [], isLoading, error, refetch } = useQuery<Zone[]>({
        queryKey: ['zones'],
        queryFn: async () => {
            try {
                const { data, error } = await supabase.from('zones').select('*');
                if (error) throw error;
                return data || [];
            } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
                console.error('[useZones] Failed to fetch zones:', error);
                throw error;
            }
        },
        staleTime: 1000 * 60 * 10, // 10 minutes - zones don't change often
        retry: 2,
    });

    return {
        zones,
        isLoading,
        error,
        refetch
    };
};

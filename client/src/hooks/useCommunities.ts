import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface Community {
    id: string;
    name: string;
    zone_id: string;
    address: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    created_at: string;
    updated_at: string;
}

export interface CommunityCreate {
    name: string;
    zone_id: string;
    address?: string;
    contact_email?: string;
    contact_phone?: string;
}

/**
 * Hook to fetch communities, optionally filtered by zone
 * No authentication required - public data
 * Endpoint: GET /api/v1/communities
 */
export const useCommunities = (regionId?: string) => {
    const { data: communities = [], isLoading, error, refetch } = useQuery<Community[]>({
        queryKey: ['communities', regionId],
        queryFn: async () => {
            try {
                let query = supabase.from('communities').select('*');
                if (regionId) query = query.eq('zone_id', regionId);
                const { data, error } = await query;
                if (error) throw error;
                return data || [];
            } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
                console.error('[useCommunities] Failed to fetch communities:', error);
                throw error;
            }
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: 2,
    });

    return {
        communities,
        isLoading,
        error,
        refetch
    };
};

/**
 * Hook to create a new community
 * Requires authentication (superadmin only)
 * Endpoint: POST /api/v1/communities
 */
export const useCreateCommunity = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (communityData: CommunityCreate) => {
            try {
                const { data, error } = await supabase.from('communities').insert(communityData as any).select().single();
                if (error) throw error;
                return data;
            } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
                console.error('[useCreateCommunity] Failed to create community:', error);
                throw error;
            }
        },
        onSuccess: () => {
            // Invalidate communities query to refetch the list
            queryClient.invalidateQueries({ queryKey: ['communities'] });
        },
    });
};

/**
 * Hook to fetch a single community by ID
 * No authentication required - public data
 * Endpoint: GET /api/v1/communities/:id
 */
export const useCommunity = (communityId: string) => {
    const { data: community, isLoading, error } = useQuery<Community>({
        queryKey: ['community', communityId],
        queryFn: async () => {
            try {
                const { data, error } = await supabase.from('communities').select('*').eq('id', communityId).single();
                if (error) throw error;
                return data;
            } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
                console.error('[useCommunity] Failed to fetch community:', error);
                throw error;
            }
        },
        enabled: !!communityId, // Only run if communityId is provided
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: 2,
    });

    return {
        community,
        isLoading,
        error
    };
};

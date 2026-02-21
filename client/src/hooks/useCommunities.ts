import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

export interface Community {
    id: string;
    name: string;
    region_id: string;
    address: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    created_at: string;
    updated_at: string;
}

export interface CommunityCreate {
    name: string;
    region_id: string;
    address?: string;
    contact_email?: string;
    contact_phone?: string;
}

/**
 * Hook to fetch communities, optionally filtered by region
 * No authentication required - public data
 * Endpoint: GET /api/v1/communities
 */
export const useCommunities = (regionId?: string) => {
    const { data: communities = [], isLoading, error, refetch } = useQuery<Community[]>({
        queryKey: ['communities', regionId],
        queryFn: async () => {
            try {
                const params = regionId ? { region_id: regionId } : {};
                const response = await api.get<Community[]>('/communities', { params });
                return response.data;
            } catch (error: any) {
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
                const response = await api.post<Community>('/communities', communityData);
                return response.data;
            } catch (error: any) {
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
                const response = await api.get<Community>(`/communities/${communityId}`);
                return response.data;
            } catch (error: any) {
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

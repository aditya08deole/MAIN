import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// Map DB asset_type → NodeCategory for AllNodes display
function mapCategory(assetType: string | null, template: string | null): string {
    if (assetType === 'sump') return 'Sump';
    if (assetType === 'tank' || assetType === 'oht') return 'OHT';
    if (assetType === 'borewell' || assetType === 'well') return 'Borewell';
    if (assetType === 'flow_meter') return 'FlowMeter';
    if (assetType === 'pumphouse') return 'PumpHouse';
    // Fallback: derive from analytics_template
    if (template === 'EvaraTank') return 'OHT';
    if (template === 'EvaraDeep') return 'Borewell';
    if (template === 'EvaraFlow') return 'FlowMeter';
    return 'OHT';
}

export const useNodes = (searchQuery: string = '') => {
    const queryClient = useQueryClient();

    const { data: nodes = [], isLoading, error, refetch } = useQuery({
        queryKey: ['nodes', searchQuery],
        queryFn: async () => {
            console.log('[useNodes] Fetching devices with search:', searchQuery);
            let query = supabase
                .from('devices')
                .select('*, communities(name, zones(name))')
                .is('deleted_at', null)
                .order('created_at', { ascending: false });

            if (searchQuery) {
                query = query.or(`label.ilike.%${searchQuery}%,node_key.ilike.%${searchQuery}%`);
            }

            const { data, error } = await query;
            if (error) {
                console.error('[useNodes] Query error:', error);
                throw new Error(error.message);
            }

            console.log('[useNodes] Fetched', data?.length || 0, 'devices');

            return (data || []).map((d: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
                id: d.id,
                node_key: d.node_key,
                label: d.label || d.node_key || 'Unnamed Node',
                name: d.label || d.node_key || 'Unnamed Node',
                analytics_template: d.analytics_template || 'EvaraTank',
                asset_type: d.asset_type || 'tank',
                category: mapCategory(d.asset_type, d.analytics_template),
                status: d.status || 'Offline',
                latitude: d.latitude,
                longitude: d.longitude,
                is_active: d.is_active,
                capacity: null as string | null,
                location_name: (d.communities as any)?.name || '',
                community_id: d.community_id,
                created_at: d.created_at,
                updated_at: d.updated_at,
            }));
        },
        staleTime: 1000 * 30, // 30 seconds - reduced from 60s for fresher data
        cacheTime: 1000 * 60 * 5, // Keep in cache for 5 minutes
        retry: 2,
        retryDelay: 1000,
        placeholderData: (prev: any) => prev, // eslint-disable-line @typescript-eslint/no-explicit-any
    });

    // ─── Supabase Real-time Listener (Faster than WebSocket) ───
    useEffect(() => {
        console.log('[useNodes] Setting up Supabase real-time subscriptions');
        
        const channel = supabase
            .channel('devices-changes')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'devices' },
                (payload) => {
                    console.log('[useNodes] Device change detected:', payload.eventType);
                    queryClient.invalidateQueries({ queryKey: ['nodes'] });
                    queryClient.invalidateQueries({ queryKey: ['map_devices'] });
                    queryClient.invalidateQueries({ queryKey: ['dashboard_summary'] });
                }
            )
            .subscribe();

        return () => {
            console.log('[useNodes] Cleaning up Supabase subscriptions');
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    return {
        nodes,
        loading: isLoading,
        error: error instanceof Error ? error.message : (error ? String(error) : null),
        refresh: refetch
    };
};

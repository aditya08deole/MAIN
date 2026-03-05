import { useEffect } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { computeOnlineStatus } from '../utils/telemetryPipeline';

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
            // Fetch only the columns that actually exist in the unified device tables
            const cols = 'id, label, node_key, last_seen, latitude, longitude, is_active, community_id, created_at, updated_at, communities(name)';
            const [tankRes, flowRes, deepRes] = await Promise.all([
                supabase.from('evaratank' as any).select(cols).is('deleted_at', null),
                supabase.from('evaraflow' as any).select(cols).is('deleted_at', null),
                supabase.from('evaradeep' as any).select(cols).is('deleted_at', null),
            ]);

            const firstError = tankRes.error || flowRes.error || deepRes.error;
            if (firstError) throw new Error(firstError.message);

            const allRows = [
                ...(tankRes.data || []).map((d: any) => ({ ...d, _device_type: 'EvaraTank' })),
                ...(flowRes.data || []).map((d: any) => ({ ...d, _device_type: 'EvaraFlow' })),
                ...(deepRes.data || []).map((d: any) => ({ ...d, _device_type: 'EvaraDeep' })),
            ].sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());

            return allRows
                .filter(d => !searchQuery ||
                    (d.label || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (d.node_key || '').toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((d: any) => {
                    const template = d._device_type as 'EvaraTank' | 'EvaraFlow' | 'EvaraDeep';
                    const isStale = computeOnlineStatus(d.last_seen, template) === 'Offline';
                    // Derive asset_type from device template (no asset_type column in unified tables)
                    const assetType = template === 'EvaraTank' ? 'tank'
                        : template === 'EvaraFlow' ? 'flow_meter'
                            : 'borewell';
                    const displayName = d.label || d.node_key || 'Unnamed Node';
                    return {
                        id: d.id,
                        node_key: d.node_key,
                        label: displayName,
                        name: displayName,
                        analytics_template: template,
                        asset_type: assetType,
                        category: mapCategory(assetType, template),
                        status: isStale ? 'Offline' : 'Online',
                        last_seen: d.last_seen ?? null,
                        latitude: d.latitude,
                        longitude: d.longitude,
                        is_active: d.is_active,
                        capacity: null as string | null,
                        location_name: (d.communities as any)?.name || '',
                        community_id: d.community_id,
                        created_at: d.created_at,
                        updated_at: d.updated_at,
                    };
                });
        },
        staleTime: 2 * 60_000,  // 2 min — Realtime handles live updates, no aggressive poll needed
        gcTime: 5 * 60_000,     // Keep in cache 5 minutes after unmount
        retry: 2,
        retryDelay: 1000,
        placeholderData: keepPreviousData,
    });

    // ─── Supabase Real-time Listener (Faster than WebSocket) ───
    useEffect(() => {
        const channel = supabase
            .channel('device-tables-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'evaratank' }, () => {
                queryClient.invalidateQueries({ queryKey: ['nodes'] });
                queryClient.invalidateQueries({ queryKey: ['map_devices'] });
                queryClient.invalidateQueries({ queryKey: ['dashboard_summary'] });
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'evaraflow' }, () => {
                queryClient.invalidateQueries({ queryKey: ['nodes'] });
                queryClient.invalidateQueries({ queryKey: ['map_devices'] });
                queryClient.invalidateQueries({ queryKey: ['dashboard_summary'] });
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'evaradeep' }, () => {
                queryClient.invalidateQueries({ queryKey: ['nodes'] });
                queryClient.invalidateQueries({ queryKey: ['map_devices'] });
                queryClient.invalidateQueries({ queryKey: ['dashboard_summary'] });
            })
            .subscribe();

        return () => {
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

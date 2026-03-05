import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useEffect } from 'react';
import { deviceService, type MapDevice } from '../services/DeviceService';

export type { MapDevice };

/**
 * Hook to fetch all devices for map display with real-time updates
 */
export const useMapDevices = () => {
    const queryClient = useQueryClient();

    useEffect(() => {
        const unsubUpdate = deviceService.subscribeToDeviceUpdates(() => {
            queryClient.invalidateQueries({ queryKey: ['map_devices'] });
        });
        const unsubNew = deviceService.subscribeToNewDevices(() => {
            queryClient.invalidateQueries({ queryKey: ['map_devices'] });
        });
        return () => { unsubUpdate(); unsubNew(); };
    }, [queryClient]);

    return useQuery<MapDevice[]>({
        queryKey: ['map_devices'],
        queryFn: () => deviceService.getMapDevices(),
        staleTime: 2 * 60_000,             // 2 min — Realtime subscription handles live deltas
        gcTime: 5 * 60_000,                // P29: keep in cache 5 min after unmount
        refetchInterval: 60_000,            // P29: reduced from 30s → 60s (Realtime is faster)
        retry: 2,
        retryDelay: 2000,
        refetchOnWindowFocus: true,         // P29: immediately refresh when user tabs back
        placeholderData: keepPreviousData,
    });
};

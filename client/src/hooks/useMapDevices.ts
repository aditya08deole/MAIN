import { useQuery, useQueryClient } from '@tanstack/react-query';
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
        refetchInterval: 30000,
        retry: 2
    });
};

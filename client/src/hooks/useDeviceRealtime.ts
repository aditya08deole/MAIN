import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createRealtimeChannelWithCache } from '../lib/supabaseRealtime';
import type { NodeRow } from '../types/database';

/**
 * Hook: Subscribe to real-time device changes via Supabase
 * 
 * Pattern extracted from TDS-app_main with improvements:
 * - Direct cache updates (no invalidation)
 * - Automatic cleanup on unmount
 * - Connection limit enforcement
 * - TypeScript type safety
 * 
 * NOTE: This is an OPTIONAL alternative to WebSocket.
 * Only enable if VITE_ENABLE_REALTIME=true
 * 
 * Usage in DevicesPage:
 * ```tsx
 * import { useDeviceRealtime } from '@/hooks/useDeviceRealtime';
 * 
 * function DevicesPage() {
 *   const { nodes } = useNodes();
 *   useDeviceRealtime(); // Enable realtime updates
 *   // ... rest of component
 * }
 * ```
 */
export function useDeviceRealtime(enabled: boolean = true) {
    const queryClient = useQueryClient();
    
    useEffect(() => {
        // Check if realtime is enabled via environment variable
        const realtimeEnabled = import.meta.env.VITE_ENABLE_REALTIME === 'true';
        
        if (!enabled || !realtimeEnabled) return;
        
        // Subscribe to devices table changes
        const unsubscribe = createRealtimeChannelWithCache<NodeRow>(
            'devices_realtime',
            'devices',
            queryClient,
            ['devices'], // React Query cache key
            (oldDevices, payload) => {
                if (!oldDevices) return oldDevices;
                
                switch (payload.eventType) {
                    case 'INSERT':
                        return [payload.new, ...oldDevices];
                        
                    case 'UPDATE':
                        return oldDevices.map(device =>
                            device.id === payload.new.id ? payload.new : device
                        );
                        
                    case 'DELETE':
                        return oldDevices.filter(device => device.id !== payload.old.id);
                        
                    default:
                        return oldDevices;
                }
            }
        );
        
        return () => { unsubscribe(); };
    }, [queryClient, enabled]);
}

/**
 * Hook: Subscribe to real-time node changes (alias for devices)
 * 
 * Usage in NodesPage:
 * ```tsx
 * import { useNodeRealtime } from '@/hooks/useDeviceRealtime';
 * 
 * function NodesPage() {
 *   const { nodes } = useNodes();
 *   useNodeRealtime(); // Enable realtime updates
 *   // ... rest of component
 * }
 * ```
 */
export function useNodeRealtime(enabled: boolean = true) {
    return useDeviceRealtime(enabled);
}

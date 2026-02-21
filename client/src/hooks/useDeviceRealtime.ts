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
        
        if (!enabled || !realtimeEnabled) {
            console.log('[Realtime] Disabled via config or prop');
            return;
        }
        
        console.log('[Realtime] 🔌 Setting up device subscription');
        
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
                        // Add new device to cache
                        console.log('[Realtime] ➕ Device added:', payload.new);
                        return [payload.new, ...oldDevices];
                        
                    case 'UPDATE':
                        // Update existing device in cache
                        console.log('[Realtime] ✏️ Device updated:', payload.new);
                        return oldDevices.map(device =>
                            device.id === payload.new.id ? payload.new : device
                        );
                        
                    case 'DELETE':
                        // Remove device from cache
                        console.log('[Realtime] 🗑️ Device deleted:', payload.old);
                        return oldDevices.filter(device => device.id !== payload.old.id);
                        
                    default:
                        return oldDevices;
                }
            }
        );
        
        // Cleanup on unmount
        return () => {
            console.log('[Realtime] 🔌 Cleaning up device subscription');
            unsubscribe();
        };
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

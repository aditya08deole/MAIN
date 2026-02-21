import { supabase } from './supabase';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

/**
 * Realtime Subscription Manager
 * 
 * Extracted pattern from TDS-app_main with enhancements:
 * - Connection limit enforcement (max 3 channels)
 * - Automatic cleanup on limit exceeded
 * - Channel state tracking
 * - Memory leak prevention
 * 
 * Usage:
 * ```ts
 * const unsubscribe = createRealtimeChannel(
 *   'devices_realtime',
 *   'devices',
 *   (payload) => { ... }
 * );
 * // Later: unsubscribe();
 * ```
 */

const MAX_CHANNELS = 3;
const activeChannels = new Map<string, RealtimeChannel>();

/**
 * Get current subscription info (for debugging)
 */
export function getSubscriptionInfo() {
    return {
        activeCount: activeChannels.size,
        maxAllowed: MAX_CHANNELS,
        channels: Array.from(activeChannels.keys())
    };
}

/**
 * Create a realtime subscription channel with automatic cleanup
 * 
 * @param channelName - Unique channel identifier (e.g., 'devices_realtime')
 * @param tableName - Database table to watch
 * @param callback - Handler for postgres_changes events
 * @returns Cleanup function to unsubscribe
 */
export function createRealtimeChannel<T extends Record<string, any> = any>(
    channelName: string,
    tableName: string,
    callback: (payload: RealtimePostgresChangesPayload<T>) => void
): () => void {
    // Check if channel already exists
    if (activeChannels.has(channelName)) {
        console.warn(`[Realtime] Channel '${channelName}' already exists, cleaning up old subscription`);
        unsubscribeChannel(channelName);
    }
    
    // Enforce connection limit
    if (activeChannels.size >= MAX_CHANNELS) {
        const oldestChannel = Array.from(activeChannels.keys())[0];
        console.warn(
            `[Realtime] Connection limit reached (${MAX_CHANNELS}), ` +
            `removing oldest channel: ${oldestChannel}`
        );
        unsubscribeChannel(oldestChannel);
    }
    
    console.log(`[Realtime] 🔌 Creating subscription: ${channelName} (table: ${tableName})`);
    
    // Create channel with postgres_changes listener
    const channel = supabase
        .channel(channelName)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: tableName
            },
            (payload) => {
                console.log(
                    `[Realtime] 🔄 ${channelName} - ${payload.eventType} on ${tableName}`,
                    payload.new || payload.old
                );
                callback(payload as RealtimePostgresChangesPayload<T>);
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log(`[Realtime] ✅ ${channelName} - Active`);
            } else if (status === 'CHANNEL_ERROR') {
                console.error(`[Realtime] ❌ ${channelName} - Error`);
            } else if (status === 'CLOSED') {
                console.log(`[Realtime] 🔌 ${channelName} - Closed`);
            }
        });
    
    // Track channel
    activeChannels.set(channelName, channel);
    
    // Return cleanup function
    return () => unsubscribeChannel(channelName);
}

/**
 * Unsubscribe from a specific channel
 */
export function unsubscribeChannel(channelName: string): void {
    const channel = activeChannels.get(channelName);
    if (channel) {
        console.log(`[Realtime] 🔌 Unsubscribing: ${channelName}`);
        supabase.removeChannel(channel);
        activeChannels.delete(channelName);
    }
}

/**
 * Unsubscribe from all active channels (for cleanup on app unmount)
 */
export function unsubscribeAll(): void {
    console.log(`[Realtime] 🔌 Cleaning up ${activeChannels.size} active channels`);
    activeChannels.forEach((channel, name) => {
        console.log(`[Realtime] 🔌 Unsubscribing: ${name}`);
        supabase.removeChannel(channel);
    });
    activeChannels.clear();
}

/**
 * Type-safe realtime channel creator with React Query integration
 * 
 * Example for devices table:
 * ```tsx
 * useEffect(() => {
 *   const unsubscribe = createRealtimeChannelWithCache(
 *     'devices_realtime',
 *     'devices',
 *     queryClient,
 *     ['devices'],
 *     (oldData, payload) => {
 *       if (!oldData) return oldData;
 *       switch (payload.eventType) {
 *         case 'INSERT': return [payload.new, ...oldData];
 *         case 'UPDATE': return oldData.map(d => d.id === payload.new.id ? payload.new : d);
 *         case 'DELETE': return oldData.filter(d => d.id !== payload.old.id);
 *         default: return oldData;
 *       }
 *     }
 *   );
 *   return unsubscribe;
 * }, [queryClient]);
 * ```
 */
export function createRealtimeChannelWithCache<T extends Record<string, any> = any>(
    channelName: string,
    tableName: string,
    queryClient: any, // QueryClient from @tanstack/react-query
    queryKey: any[],
    updateCache: (oldData: T[] | undefined, payload: RealtimePostgresChangesPayload<T>) => T[] | undefined
): () => void {
    return createRealtimeChannel<T>(channelName, tableName, (payload) => {
        // Update React Query cache directly (no invalidation = faster UX)
        queryClient.setQueryData(queryKey, (oldData: T[] | undefined) => {
            return updateCache(oldData, payload);
        });
    });
}

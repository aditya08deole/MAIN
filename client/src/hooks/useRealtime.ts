/**
 * Custom React Hook for Real-time Device Updates
 * Hybrid Approach: Direct Supabase subscriptions with backend fallback
 */
import { useEffect, useState, useCallback } from 'react';
import { deviceService } from '../services/DeviceService';
import { useAuth } from '../context/AuthContext';

/**
 * Hook to subscribe to real-time device status changes
 * Updates every ~5 seconds (Supabase real-time latency)
 * 
 * Usage:
 * ```tsx
 * const { onlineCount, offlineCount,lastUpdate } = useDeviceRealtime();
 * ```
 */
export const useDeviceRealtime = () => {
    const { user } = useAuth();
    const [updateCount, setUpdateCount] = useState(0);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [recentUpdates, setRecentUpdates] = useState<unknown[]>([]);


    useEffect(() => {
        console.log('[Real-time Hook] Subscribing to device updates...');

        let filter = undefined;
        if (user && user.role !== 'superadmin' && user.community_id) {
            filter = `community_id=eq.${user.community_id}`;
        }

        // Subscribe to device updates
        const unsubscribeUpdates = deviceService.subscribeToDeviceUpdates((payload: any) => {
            setUpdateCount((prev) => prev + 1);
            setLastUpdate(new Date());
            setRecentUpdates((prev) => [payload, ...prev.slice(0, 9)]); // Keep last 10
        }, filter);

        // Subscribe to new devices
        const unsubscribeInserts = deviceService.subscribeToNewDevices((payload: any) => {
            setUpdateCount((prev) => prev + 1);
            setLastUpdate(new Date());
            setRecentUpdates((prev) => [payload, ...prev.slice(0, 9)]);
        }, filter);

        return () => {
            console.log('[Real-time Hook] Unsubscribing from device updates...');
            unsubscribeUpdates();
            unsubscribeInserts();
        };
    }, [user?.community_id, user?.role]);

    return {
        updateCount,
        lastUpdate,
        recentUpdates,
        isConnected: updateCount > 0 || lastUpdate !== null,
    };
};

/**
 * Hook to refetch data with smart polling (5-second intervals)
 * Falls back if real-time not available
 * 
 * Usage:
 * ```tsx
 * const { data, refetch } = usePollingRefetch(fetchDevices, 5000);
 * ```
 */
export const usePollingRefetch = <T,>(
    fetchFn: () => Promise<T>,
    intervalMs: number = 5000
) => {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refetch = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const result = await fetchFn();
            setData(result);
        } catch (err) {
            setError(err as Error);
            console.error('[Polling] Fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [fetchFn]);

    useEffect(() => {
        // Initial fetch
        refetch();

        // Set up polling
        const interval = setInterval(refetch, intervalMs);

        return () => clearInterval(interval);
    }, [refetch, intervalMs]);

    return { data, loading, error, refetch };
};

/**
 * Hook for hybrid data fetching (Supabase first, backend fallback)
 * 
 * Usage:
 * ```tsx
 * const { data, loading } = useHybridFetch(
 *   () => getMapDevicesDirectly(),
 *   () => getMapDevices()
 * );
 * ```
 */
export const useHybridFetch = <T,>(
    supabaseFn: () => Promise<T | null>,
    backendFn: () => Promise<T>
) => {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [source, setSource] = useState<'supabase' | 'backend' | null>(null);

    useEffect(() => {
        let mounted = true;

        const fetchData = async () => {
            try {
                setLoading(true);
                setError(null);

                // Try Supabase first (fast path)
                const supabaseResult = await supabaseFn();

                if (supabaseResult !== null && mounted) {
                    setData(supabaseResult);
                    setSource('supabase');
                    setLoading(false);
                    return;
                }

                // Fallback to backend (reliable path)
                const backendResult = await backendFn();
                if (mounted) {
                    setData(backendResult);
                    setSource('backend');
                }
            } catch (err) {
                if (mounted) {
                    setError(err as Error);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        fetchData();

        return () => {
            mounted = false;
        };
    }, [supabaseFn, backendFn]);

    return { data, loading, error, source };
};

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected';

/** Valid Supabase snapshot table names for the three device types. */
export type SnapshotTableName =
    | 'evaratank_snapshots'
    | 'evaraflow_snapshots'
    | 'evaradeep_snapshots';

interface UseTelemetryRealtimeOptions {
    /** Device UUID to subscribe to. */
    deviceId: string;
    /** React Query key for the latest-snapshot query. */
    latestQueryKey: QueryKey;
    /** React Query key for the history query (will be invalidated). */
    historyQueryKey: QueryKey;
    /**
     * Given the old cached value and the raw Supabase Realtime snapshot
     * payload, return the merged value that should replace the cache.
     */
    snapshotMerger: (old: any, snapshot: any) => any;
    /**
     * The Supabase table to subscribe to.
     * Must be one of the three typed snapshot tables.
     * Defaults to 'evaratank_snapshots' with a console warning if omitted.
     */
    snapshotTable?: SnapshotTableName;
}

/**
 * Phase 16 — Shared useTelemetryRealtime hook
 *
 * Encapsulates the Supabase Realtime subscription for a single device.
 * On every UPDATE to the device's snapshot table it:
 *   1. Calls `queryClient.setQueryData` with the merged snapshot (zero RTT).
 *   2. Invalidates the history query so it re-fetches in the background.
 *
 * P7 Fix: snapshotMerger is stored in a ref so the latest closure is always
 * called inside the subscription (no stale closure bug). Query key strings
 * are used as stable effect dependencies, removing exhaustive-deps suppression.
 */
export function useTelemetryRealtime({
    deviceId,
    latestQueryKey,
    historyQueryKey,
    snapshotMerger,
    snapshotTable,
}: UseTelemetryRealtimeOptions): RealtimeStatus {
    const queryClient = useQueryClient();
    const [status, setStatus] = useState<RealtimeStatus>('connecting');

    // P7: always call the latest merger without stale closure
    const mergerRef = useRef(snapshotMerger);
    useEffect(() => { mergerRef.current = snapshotMerger; });

    // Stable string representations for dependency array
    const latestKeyStr = JSON.stringify(latestQueryKey);
    const historyKeyStr = JSON.stringify(historyQueryKey);

    const resolvedTable: SnapshotTableName = (snapshotTable ?? (() => {
        console.warn(
            '[useTelemetryRealtime] snapshotTable not provided — defaulting to evaratank_snapshots. '
            + 'Pass snapshotTable="evaraflow_snapshots" or "evaradeep_snapshots" for non-tank devices.',
        );
        return 'evaratank_snapshots' as SnapshotTableName;
    })()) as SnapshotTableName;

    useEffect(() => {
        if (!deviceId) return;

        setStatus('connecting');

        const channel = supabase
            .channel(`realtime:${resolvedTable}:${deviceId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: resolvedTable,
                    filter: `device_id=eq.${deviceId}`,
                },
                (payload) => {
                    const snap = payload.new as any;
                    // P7: use ref so we always call the latest merger closure
                    queryClient.setQueryData(
                        JSON.parse(latestKeyStr),
                        (old: any) => mergerRef.current(old, snap),
                    );
                    queryClient.invalidateQueries({ queryKey: JSON.parse(historyKeyStr) });
                }
            )
            .subscribe((state) => {
                if (state === 'SUBSCRIBED') setStatus('connected');
                else if (state === 'CLOSED' || state === 'CHANNEL_ERROR')
                    setStatus('disconnected');
            });

        return () => {
            supabase.removeChannel(channel);
            setStatus('disconnected');
        };
    }, [deviceId, resolvedTable, latestKeyStr, historyKeyStr]); // no suppression needed

    return status;
}

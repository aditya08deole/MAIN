import React from 'react';
import type { RealtimeStatus } from '../hooks/useTelemetryRealtime';

interface RealtimeStatusDotProps {
    status: RealtimeStatus;
    className?: string;
}

const LABEL: Record<RealtimeStatus, string> = {
    connecting:   'Connecting…',
    connected:    'Live',
    disconnected: 'Disconnected',
};

const DOT_CLASS: Record<RealtimeStatus, string> = {
    connecting:   'bg-yellow-400 animate-pulse',
    connected:    'bg-emerald-500 animate-pulse',
    disconnected: 'bg-red-400',
};

const TEXT_CLASS: Record<RealtimeStatus, string> = {
    connecting:   'text-yellow-600',
    connected:    'text-emerald-600',
    disconnected: 'text-red-500',
};

const RING_CLASS: Record<RealtimeStatus, string> = {
    connecting:   'bg-yellow-50   border-yellow-200',
    connected:    'bg-emerald-50  border-emerald-200',
    disconnected: 'bg-red-50      border-red-200',
};

/**
 * Phase 17 — Realtime connection status dot
 * Renders a small colour-coded pill indicating the Supabase Realtime
 * subscription state returned by `useTelemetryRealtime`.
 */
const RealtimeStatusDot: React.FC<RealtimeStatusDotProps> = ({
    status,
    className = '',
}) => (
    <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${RING_CLASS[status]} ${className}`}
    >
        <span className={`w-1.5 h-1.5 rounded-full ${DOT_CLASS[status]}`} />
        <span className={TEXT_CLASS[status]}>{LABEL[status]}</span>
    </span>
);

export default RealtimeStatusDot;

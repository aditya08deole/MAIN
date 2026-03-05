import { useEffect, useState } from 'react';

export type StalenessLevel = 'fresh' | 'warn' | 'stale' | 'unknown';

interface StaleDataAge {
    ageMinutes: number | null;
    label: string;
    level: StalenessLevel;
}

/**
 * Phase 15 — Stale Data Age Hook
 * Derives the age of a data timestamp and re-evaluates every 30 s.
 * fresh  < 3 min (green)
 * warn   3 – 10 min (yellow)
 * stale  > 10 min (red)
 */
export function useStaleDataAge(timestamp: string | null | undefined): StaleDataAge {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 30_000);
        return () => clearInterval(id);
    }, []);

    if (!timestamp) {
        return { ageMinutes: null, label: 'No data', level: 'unknown' };
    }

    const ms = now - new Date(timestamp).getTime();
    if (isNaN(ms)) {
        return { ageMinutes: null, label: 'No data', level: 'unknown' };
    }

    const ageMinutes = Math.floor(ms / 60_000);

    if (ageMinutes < 3) {
        return { ageMinutes, label: ageMinutes < 1 ? 'Just now' : `${ageMinutes} min ago`, level: 'fresh' };
    }
    if (ageMinutes < 10) {
        return { ageMinutes, label: `${ageMinutes} min ago`, level: 'warn' };
    }
    return { ageMinutes, label: `${ageMinutes} min ago`, level: 'stale' };
}

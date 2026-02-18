
import { useEffect, useState } from 'react';
import { fetchFeeds, buildFilterParams } from '../lib/thingspeak';
import type { ThingSpeakFeed } from '../lib/thingspeak';

interface UseThingSpeakConfig {
    channelId:  string | null;
    readApiKey: string | null;
    filter:     string;
    intervalMs?: number;
}

interface UseThingSpeakResult {
    feeds:    ThingSpeakFeed[];
    loading:  boolean;
    error:    string | null;
    noConfig: boolean;
}

export function useThingSpeak({
    channelId,
    readApiKey,
    filter,
    intervalMs = 15000,
}: UseThingSpeakConfig): UseThingSpeakResult {
    const [feeds, setFeeds]     = useState<ThingSpeakFeed[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState<string | null>(null);

    const noConfig = !channelId || !readApiKey;

    useEffect(() => {
        if (noConfig) return;
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            try {
                const params  = buildFilterParams(filter);
                const result  = await fetchFeeds(channelId!, readApiKey!, params);
                if (!cancelled) {
                    setFeeds(result.feeds);
                    setError(null);
                }
            } catch (e: any) {
                if (!cancelled) setError(e.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        const id = setInterval(load, intervalMs);
        return () => { cancelled = true; clearInterval(id); };
    }, [channelId, readApiKey, filter, intervalMs, noConfig]);

    return { feeds, loading, error, noConfig };
}

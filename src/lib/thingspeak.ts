export interface ThingSpeakFeed {
    created_at: string; entry_id: number;
    field1: string | null; field2: string | null; field3: string | null; field4: string | null;
    field5: string | null; field6: string | null; field7: string | null; field8: string | null;
}

export interface ThingSpeakChannel {
    id: number; name: string; description: string; field1: string | null; field2: string | null;
    created_at: string; updated_at: string;
}

export interface ThingSpeakResponse {
    channel: ThingSpeakChannel; feeds: ThingSpeakFeed[];
}

export async function fetchFeeds(
    channelId: string, apiKey: string, params: Record<string, string | number> = {}
): Promise<ThingSpeakResponse> {
    const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
    const url = `https://api.thingspeak.com/channels/${channelId}/feeds.json` + `?api_key=${apiKey}&` + query.toString();
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ThingSpeak error: ${res.status}`);
    return res.json();
}

export function buildFilterParams(filter: string): Record<string, string | number> {
    if (filter === '1h') return { minutes: 60 };
    if (filter === '6h') return { minutes: 360 };
    if (filter === '24h') return { minutes: 1440 };
    return { results: 15 };
}

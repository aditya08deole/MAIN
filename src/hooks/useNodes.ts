import { useEffect, useState, useCallback } from 'react';
// import { supabase } from '../lib/supabase'; // Unused in static mode
import type { NodeRow } from '../types/database';
// import { useAuth } from '../context/AuthContext'; // Unused in static mode
import { STATIC_NODES } from '../data/staticData';

export const useNodes = () => {
    // const { user } = useAuth(); // Unused
    const [nodes, setNodes] = useState<NodeRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error] = useState<string | null>(null); // setError unused

    const fetchNodes = useCallback(async () => {
        // Imitate a very short delay to simulate an API call, but return static data
        setLoading(true);
        setTimeout(() => {
            setNodes(STATIC_NODES);
            setLoading(false);
        }, 100);
    }, []);

    useEffect(() => {
        fetchNodes();
    }, [fetchNodes]);

    return { nodes, loading, error, refresh: fetchNodes };
};

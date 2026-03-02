import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Database } from '../types/database';

type ProfileRow = Database['public']['Tables']['customers']['Row'];

export const useProfile = () => {
    const { user } = useAuth();

    const { data: profile, isLoading, error } = useQuery<ProfileRow | null>({
        queryKey: ['user_profile', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) throw error;
            return data;
        },
        enabled: !!user?.id,
        staleTime: 1000 * 60 * 15, // Cache profile for 15 mins
    });

    return {
        profile,
        loading: isLoading,
        error
    };
};



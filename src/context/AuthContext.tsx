import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { UserRole, UserPlan } from '../types/database';

// Re-export so existing imports from AuthContext continue to work
export type { UserRole, UserPlan };

export interface User {
    id: string;
    email: string;
    displayName: string;
    role: UserRole;
    plan: UserPlan;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    loading: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signup: (email: string, password: string, displayName: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const buildUser = async (uid: string): Promise<User | null> => {
    const { data: profile, error } = await supabase
        .from('users_profiles')
        .select('id, email, display_name, role, plan')
        .eq('id', uid)
        .single();
    if (error || !profile) return null;
    const p = profile as any;
    return {
        id: p.id,
        email: p.email,
        displayName: p.display_name,
        role: p.role,
        plan: p.plan,
    };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        let mounted = true;

        // Safety timeout: if Supabase takes too long, stop loading
        const timer = setTimeout(() => {
            if (mounted) setLoading(false);
        }, 5000);

        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (session?.user) {
                try {
                    const u = await buildUser(session.user.id);
                    if (mounted) setUser(u);
                } catch (err) {
                    console.error("Error building user:", err);
                }
            }
            if (mounted) setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                if (session?.user) {
                    const u = await buildUser(session.user.id);
                    if (mounted) setUser(u);
                } else {
                    if (mounted) setUser(null);
                }
                if (mounted) setLoading(false);
            }
        );

        return () => {
            mounted = false;
            clearTimeout(timer);
            subscription.unsubscribe();
        };
    }, []);

    const login = useCallback(async (
        email: string, password: string
    ): Promise<{ success: boolean; error?: string }> => {
        // ─── DEV BYPASS ───
        const DEV_ADMINS = ['ritik@evaratech.com', 'yasha@evaratech.com', 'aditya@evaratech.com', 'admin@evara.com'];
        if (DEV_ADMINS.includes(email) && password === 'evaratech@1010') {
            const mockUser: User = {
                id: 'dev-bypass-id-' + email,
                email,
                displayName: 'Dev SuperAdmin',
                role: 'superadmin',
                plan: 'pro'
            };
            setUser(mockUser);
            return { success: true };
        }

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error || !data.user) return { success: false, error: error?.message ?? 'Sign-in failed' };
        return { success: true };
    }, []);

    const signup = useCallback(async (
        email: string, password: string, displayName: string
    ): Promise<{ success: boolean; error?: string }> => {
        const { data, error } = await supabase.auth.signUp({
            email, password,
            options: { data: { display_name: displayName } },
        });
        if (error || !data.user) return { success: false, error: error?.message ?? 'Sign-up failed' };
        return { success: true };
    }, []);

    const logout = useCallback(async (): Promise<void> => {
        await supabase.auth.signOut();
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, loading, login, signup, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};

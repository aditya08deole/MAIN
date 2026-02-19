import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import api from '../services/api';
import type { UserRole, UserPlan } from '../types/database';

/** Ensure backend has this user (creates/updates users_profiles). Call after login or session restore. */
const syncWithBackend = async (): Promise<void> => {
    try {
        await api.post('/auth/sync');
    } catch (err) {
        console.warn('Backend sync failed (user may still work):', err);
    }
};

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

    // ─── SESSION PERSISTENCE CONSTANTS ───
    const SESSION_KEY = 'evara_session';
    const SESSION_DURATION = 12 * 60 * 60 * 1000; // 12 hours

    useEffect(() => {
        let mounted = true;

        // 1. Check LocalStorage first for instant restore
        const tryRestoreSession = () => {
            try {
                const stored = localStorage.getItem(SESSION_KEY);
                if (stored) {
                    const { user: storedUser, timestamp } = JSON.parse(stored);
                    const age = Date.now() - timestamp;
                    if (age < SESSION_DURATION) {
                        console.log('Restoring session from localStorage');
                        setUser(storedUser);
                        setLoading(false);
                        return true; // Session restored
                    } else {
                        console.log('Session expired, clearing localStorage');
                        localStorage.removeItem(SESSION_KEY);
                    }
                }
            } catch (e) {
                console.error('Failed to restore session:', e);
                localStorage.removeItem(SESSION_KEY);
            }
            return false;
        };

        // Attempt restore
        const restored = tryRestoreSession();

        // Safety timeout: if Supabase takes too long and we haven't restored, stop loading
        const timer = setTimeout(() => {
            if (mounted) setLoading(false);
        }, 5000);

        // 2. If not restored, listen to Supabase
        if (!restored) {
            supabase.auth.getSession().then(async ({ data: { session } }) => {
                if (session?.user) {
                    try {
                        const u = await buildUser(session.user.id);
                        if (mounted && u) {
                            setUser(u);
                            localStorage.setItem(SESSION_KEY, JSON.stringify({
                                user: u,
                                timestamp: Date.now()
                            }));
                            await syncWithBackend();
                        }
                    } catch (err) {
                        console.error("Error building user:", err);
                    }
                }
                if (mounted) setLoading(false);
            });
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                if (session?.user) {
                    const u = await buildUser(session.user.id);
                    if (mounted && u) {
                        setUser(u);
                        localStorage.setItem(SESSION_KEY, JSON.stringify({
                            user: u,
                            timestamp: Date.now()
                        }));
                        await syncWithBackend();
                    }
                } else {
                    // Only clear if we don't have a valid custom session (handled by logout)
                    // But for strict supabase sync, we might want to clear. 
                    // However, we want to persist "Dev Bypass" sessions which Supabase doesn't know about.
                    // So we'll rely on explicit logout to clear the global state/storage.
                }
                if (mounted && !restored) setLoading(false);
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
            localStorage.setItem(SESSION_KEY, JSON.stringify({
                user: mockUser,
                timestamp: Date.now()
            }));
            await syncWithBackend();
            return { success: true };
        }

        // ─── DISTRIBUTOR 1 BYPASS ───
        if (email === 'distributor@evara.com' && password === 'evaratech@1010') {
            const mockUser: User = {
                id: 'dev-bypass-distributor',
                email,
                displayName: 'Distributor One',
                role: 'distributor',
                plan: 'pro'
            };
            setUser(mockUser);
            localStorage.setItem(SESSION_KEY, JSON.stringify({ user: mockUser, timestamp: Date.now() }));
            await syncWithBackend();
            return { success: true };
        }

        // ─── DISTRIBUTOR 2 BYPASS ───
        if (email === 'distributor2@evara.com' && password === 'evaratech@1010') {
            const mockUser: User = {
                id: 'dev-bypass-distributor-2',
                email,
                displayName: 'Distributor Two',
                role: 'distributor',
                plan: 'pro'
            };
            setUser(mockUser);
            localStorage.setItem(SESSION_KEY, JSON.stringify({ user: mockUser, timestamp: Date.now() }));
            await syncWithBackend();
            return { success: true };
        }

        // ─── CUSTOMER PLAN BYPASS ───
        if (email.startsWith('customer.') && email.endsWith('@evara.com') && password === 'evaratech@1010') {
            const plan = email.split('.')[1].split('@')[0] as UserPlan; // Extract 'base', 'plus', 'pro'
            const mockUser: User = {
                id: 'dev-bypass-' + plan,
                email,
                displayName: `Dev Customer (${plan.toUpperCase()})`,
                role: 'customer',
                plan: plan
            };
            setUser(mockUser);
            localStorage.setItem(SESSION_KEY, JSON.stringify({ user: mockUser, timestamp: Date.now() }));
            await syncWithBackend();
            return { success: true };
        }

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error || !data.user) return { success: false, error: error?.message ?? 'Sign-in failed' };

        // Ensure backend has this user (Supabase stores session in localStorage; api interceptor will send it)
        await syncWithBackend();
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
        localStorage.removeItem(SESSION_KEY);
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

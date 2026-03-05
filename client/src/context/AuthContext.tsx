import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { UserRole, UserPlan } from '../types/database';

// Re-export types
export type { UserRole, UserPlan };

export interface User {
    id: string;
    email: string;
    displayName: string;
    role: UserRole;
    plan: UserPlan;
    community_id?: string;
    distributor_id?: string;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    loading: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; user?: User; error?: string }>;
    signup: (email: string, password: string, displayName: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    // Extract user metadata from Supabase session
    const extractUser = useCallback((supabaseUser: SupabaseUser, profile?: Record<string, unknown>): User => {
        const metadata = supabaseUser.user_metadata || {};
        const profileRole = profile?.role as UserRole;
        const metadataRole = metadata.role as UserRole;

        // Normalize to lowercase to prevent case-mismatch on role comparisons (e.g. 'SuperAdmin' vs 'superadmin')
        const rawRole = profileRole || metadataRole || 'customer';
        const finalRole = (typeof rawRole === 'string' ? rawRole.toLowerCase() : rawRole) as UserRole;

        return {
            id: supabaseUser.id,
            email: supabaseUser.email || '',
            displayName: profile?.full_name || metadata.display_name || metadata.displayName || supabaseUser.email?.split('@')[0] || 'User',
            role: finalRole,
            plan: (metadata.plan as UserPlan) || 'pro',
            community_id: profile?.community_id || metadata.community_id,
            distributor_id: profile?.distributor_id || metadata.distributor_id,
        };
    }, []);

    const fetchProfile = useCallback(async (supabaseUser: SupabaseUser) => {
        try {
            const { data: profile, error } = await supabase
                .from('customers')
                .select('*')
                .eq('id', supabaseUser.id)
                .single();

            if (error) {
                setUser(extractUser(supabaseUser));
            } else {
                setUser(extractUser(supabaseUser, profile));
            }
        } catch {
            setUser(extractUser(supabaseUser));
        } finally {
            setLoading(false);
        }
    }, [extractUser]);

    useEffect(() => {
        let mounted = true;

        const initializeAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (mounted) {
                if (session?.user) {
                    await fetchProfile(session.user);
                } else {
                    setUser(null);
                    setLoading(false);
                }
            }
        };

        initializeAuth();

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (mounted) {
                if (session?.user) {
                    await fetchProfile(session.user);
                } else {
                    setUser(null);
                    setLoading(false);
                }
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [fetchProfile]);

    const login = useCallback(async (
        email: string, password: string
    ): Promise<{ success: boolean; user?: User; error?: string }> => {
        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                setLoading(false);
                return { success: false, error: error.message };
            }

            if (data.user) {
                // fetchProfile updates state, but we also want to return the data immediately
                const { data: profile } = await supabase
                    .from('customers')
                    .select('*')
                    .eq('id', data.user.id)
                    .single();

                const finalUser = extractUser(data.user, profile ?? undefined);

                setUser(finalUser);
                setLoading(false);
                return { success: true, user: finalUser };
            }

            setLoading(false);
            return { success: false, error: 'Login failed' };
        } catch (err: unknown) {
            setLoading(false);
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Login failed'
            };
        }
    }, [extractUser]);

    const signup = useCallback(async (
        email: string, password: string, displayName: string
    ): Promise<{ success: boolean; error?: string }> => {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        display_name: displayName,
                        role: 'customer',
                        plan: 'pro',
                    },
                },
            });

            if (error) {
                return { success: false, error: error.message };
            }

            if (data.user) {
                await fetchProfile(data.user);
                return { success: true };
            }

            return { success: false, error: 'Signup failed' };
        } catch (err: unknown) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Signup failed'
            };
        }
    }, [fetchProfile]);

    const logout = useCallback(async (): Promise<void> => {
        await supabase.auth.signOut();
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            loading,
            login,
            signup,
            logout
        }}>
            {children}
        </AuthContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};

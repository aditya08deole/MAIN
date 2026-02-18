import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'superadmin' | 'distributor' | 'customer';
export type UserPlan = 'base' | 'plus' | 'pro' | null;

export interface User {
    displayName: string;
    role: UserRole;
    plan: UserPlan;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    loading: boolean;
    login: (username: string, password: string, role: UserRole) => boolean;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);

    // Load user from storage on mount
    useEffect(() => {
        try {
            const storedUser = localStorage.getItem('evara_user');
            if (storedUser) {
                const parsed = JSON.parse(storedUser);
                if (parsed && typeof parsed === 'object') {
                    setUser(parsed);
                    setIsAuthenticated(true);
                }
            }
        } catch (error) {
            console.error('Failed to parse stored user:', error);
            localStorage.removeItem('evara_user');
        } finally {
            setLoading(false);
        }
    }, []);

    const login = (username: string, password: string, role: UserRole): boolean => {
        // Simple mock authentication
        let plan: UserPlan = null;
        let success = false;

        if (role === 'superadmin' && username === 'admin' && password === 'admin123') {
            success = true;
        } else if (role === 'distributor' && username === 'distributor' && password === 'dist123') {
            success = true;
        } else if (role === 'customer') {
            if (username === 'customer' && password === 'base123') {
                success = true;
                plan = 'base';
            } else if (username === 'customer_plus' && password === 'plus123') {
                success = true;
                plan = 'plus';
            } else if (username === 'customer_pro' && password === 'pro123') {
                success = true;
                plan = 'pro';
            }
        }

        if (success) {
            const newUser: User = {
                displayName: username.charAt(0).toUpperCase() + username.slice(1).replace('_', ' '),
                role: role,
                plan: plan
            };
            setUser(newUser);
            setIsAuthenticated(true);
            setLoading(false);
            localStorage.setItem('evara_user', JSON.stringify(newUser));
            return true;
        }

        return false;
    };

    const logout = () => {
        setUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem('evara_user');
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};


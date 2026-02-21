import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth, type UserRole, type UserPlan } from '../context/AuthContext';

interface ProtectedRouteProps {
    allowedRoles?: UserRole[];
    allowedPlans?: UserPlan[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, allowedPlans }) => {
    const { user, loading, isAuthenticated } = useAuth();
    const queryClient = useQueryClient();

    // Invalidate queries when authentication state changes
    useEffect(() => {
        if (isAuthenticated && user) {
            console.log('[ProtectedRoute] User authenticated, invalidating queries');
            queryClient.invalidateQueries({ queryKey: ['nodes'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
            queryClient.invalidateQueries({ queryKey: ['active_alerts'] });
        }
    }, [isAuthenticated, user, queryClient]);

    if (loading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!isAuthenticated || !user) {
        console.log('[ProtectedRoute] User not authenticated, redirecting to login');
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to="/dashboard" replace />;
    }

    if (allowedPlans && !allowedPlans.includes(user.plan)) {
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;

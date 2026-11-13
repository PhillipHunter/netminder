import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
    children: ReactNode;
    requireAdmin?: boolean;
    allowPasswordChange?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false, allowPasswordChange = false }: ProtectedRouteProps) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className='flex min-h-screen items-center justify-center bg-slate-950'>
                <div className='text-center'>
                    <div className='inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-sky-500 border-r-transparent'></div>
                    <p className='mt-4 text-slate-400'>Loading...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to='/login' replace />;
    }

    if (user.must_change_password) {
        if (!allowPasswordChange) {
            return <Navigate to='/change-password' replace />;
        }
    } else if (allowPasswordChange) {
        return <Navigate to='/' replace />;
    }

    if (requireAdmin && !user.is_admin) {
        return <Navigate to='/' replace />;
    }

    return <>{children}</>;
}
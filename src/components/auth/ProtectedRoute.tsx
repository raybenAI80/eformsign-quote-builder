import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LoginPage } from './LoginPage';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--forcs-blue)] border-t-transparent"></div>
            </div>
        );
    }

    if (!user) {
        return <LoginPage />;
    }

    return <>{children}</>;
};

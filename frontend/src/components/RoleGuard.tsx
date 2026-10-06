import React from 'react';
import { Navigate } from 'react-router-dom';

interface RoleGuardProps {
    children: React.ReactNode;
    allowedRoles: string[];
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
    const roleStr = localStorage.getItem('user_role');
    const token = localStorage.getItem('token');

    if (!token) return <Navigate to="/login" replace />;

    if (!roleStr || !allowedRoles.includes(roleStr)) {
        // Fallback redirects
        if (roleStr === 'doctor') return <Navigate to="/doctor/dashboard" replace />;
        if (roleStr === 'patient') return <Navigate to="/patient/dashboard" replace />;
        return <Navigate to="/admin/dashboard" replace />;
    }

    return <>{children}</>;
}

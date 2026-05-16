import { createContext, useContext, ReactNode, useMemo } from 'react';
import { useAuth, User } from './AuthContext';

interface PermissionContextType {
    permissions: string[];
    roleName: string;
    hasPermission: (permission: string) => boolean;
    hasAnyPermission: (permissions: string[]) => boolean;
    isSuperAdmin: boolean;
    user: any; // Keep it as any here or import User from AuthContext
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export function PermissionProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();

    const roleName = useMemo(() => {
        if (!user) return '';
        if (typeof user.role === 'string') return user.role;
        return user.role?.name || user.userType || '';
    }, [user]);

    const isSuperAdmin = useMemo(() => {
        return roleName === 'Super Admin' || roleName === 'Admin';
    }, [roleName]);

    const permissions = useMemo(() => {
        if (isSuperAdmin) return [];
        if (!user || typeof user.role === 'string' || !user.role?.permissions) return [];
        return user.role.permissions;
    }, [user, isSuperAdmin]);

    const hasPermission = (permission: string) => {
        if (isSuperAdmin) return true;
        return permissions.includes(permission);
    };

    const hasAnyPermission = (requiredPermissions: string[]) => {
        if (isSuperAdmin) return true;
        return requiredPermissions.some(p => permissions.includes(p));
    };

    const value = {
        permissions,
        roleName,
        hasPermission,
        hasAnyPermission,
        isSuperAdmin,
        user
    };

    return (
        <PermissionContext.Provider value={value}>
            {children}
        </PermissionContext.Provider>
    );
}

export function usePermission() {
    const context = useContext(PermissionContext);
    if (context === undefined) {
        throw new Error('usePermission must be used within a PermissionProvider');
    }
    return context;
}

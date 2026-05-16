import React, { ReactNode } from 'react';
import { usePermission } from '../context/PermissionContext';
import AccessDenied from './AccessDenied';

interface ProtectedAdminRouteProps {
    children: ReactNode;
    permission?: string;
    permissions?: string[];
}

const ProtectedAdminRoute: React.FC<ProtectedAdminRouteProps> = ({
    children,
    permission,
    permissions,
}) => {
    const { hasPermission, hasAnyPermission } = usePermission();

    let hasAccess = true;

    if (permission) {
        hasAccess = hasPermission(permission);
    } else if (permissions && permissions.length > 0) {
        hasAccess = hasAnyPermission(permissions);
    }

    if (!hasAccess) {
        return <AccessDenied />;
    }

    return <>{children}</>;
};

export default ProtectedAdminRoute;

import React, { ReactNode } from 'react';
import { usePermission } from '../context/PermissionContext';

interface PermissionGateProps {
    children: ReactNode;
    permission?: string;
    permissions?: string[];
    requireAll?: boolean;
    fallback?: ReactNode;
}

const PermissionGate: React.FC<PermissionGateProps> = ({
    children,
    permission,
    permissions,
    requireAll = false,
    fallback = null,
}) => {
    const { hasPermission, hasAnyPermission, permissions: userPermissions } = usePermission();

    if (permission) {
        if (hasPermission(permission)) {
            return <>{children}</>;
        }
    } else if (permissions && permissions.length > 0) {
        if (requireAll) {
            const hasAll = permissions.every((p) => hasPermission(p));
            if (hasAll) return <>{children}</>;
        } else {
            if (hasAnyPermission(permissions)) {
                return <>{children}</>;
            }
        }
    } else {
        // If no permission specified, just allow it
        return <>{children}</>;
    }

    return <>{fallback}</>;
};

export default PermissionGate;

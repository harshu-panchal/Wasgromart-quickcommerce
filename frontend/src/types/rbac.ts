export interface Permission {
    label: string;
    value: string;
}

export interface PermissionGroup {
    group: string;
    permissions: Permission[];
}

export interface Role {
    _id: string;
    name: string;
    permissions: string[];
    type?: "System" | "Custom";
    description?: string;
}

// For backward compatibility during migration if needed
export interface RoleLegacy {
    id: string;
    name: string;
    permissions: string[];
}

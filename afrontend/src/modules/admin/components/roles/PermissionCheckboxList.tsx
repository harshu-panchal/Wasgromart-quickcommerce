import React from 'react';
import { PERMISSION_GROUPS } from '../../constants/permissions';

interface PermissionCheckboxListProps {
    selectedPermissions: string[];
    onChange: (permissions: string[]) => void;
}

const PermissionCheckboxList: React.FC<PermissionCheckboxListProps> = ({
    selectedPermissions,
    onChange,
}) => {
    const handleTogglePermission = (permissionValue: string) => {
        if (selectedPermissions.includes(permissionValue)) {
            onChange(selectedPermissions.filter((p) => p !== permissionValue));
        } else {
            onChange([...selectedPermissions, permissionValue]);
        }
    };

    const handleToggleGroup = (groupPermissions: string[], isAllSelected: boolean) => {
        if (isAllSelected) {
            // Unselect all in this group
            onChange(selectedPermissions.filter((p) => !groupPermissions.includes(p)));
        } else {
            // Select all in this group (avoid duplicates)
            const newPermissions = [...selectedPermissions];
            groupPermissions.forEach((p) => {
                if (!newPermissions.includes(p)) {
                    newPermissions.push(p);
                }
            });
            onChange(newPermissions);
        }
    };

    const handleSelectAll = (isAllSelected: boolean) => {
        if (isAllSelected) {
            onChange([]);
        } else {
            const allPerms = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.value));
            onChange(allPerms);
        }
    };

    const totalPermissionsCount = PERMISSION_GROUPS.reduce(
        (acc, group) => acc + group.permissions.length,
        0
    );
    const isGlobalAllSelected = selectedPermissions.length === totalPermissionsCount;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700">Assign Permissions</h3>
                <button
                    type="button"
                    onClick={() => handleSelectAll(isGlobalAllSelected)}
                    className="text-xs font-medium text-teal-700 hover:text-teal-800 transition-colors"
                >
                    {isGlobalAllSelected ? 'Unselect All' : 'Select All Permissions'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {PERMISSION_GROUPS.map((group) => {
                    const groupPermValues = group.permissions.map((p) => p.value);
                    const selectedInGroup = groupPermValues.filter((p) => selectedPermissions.includes(p));
                    const isGroupAllSelected = selectedInGroup.length === groupPermValues.length;
                    const isSomeSelected = selectedInGroup.length > 0 && !isGroupAllSelected;

                    return (
                        <div key={group.group} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                                    {group.group}
                                </span>
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                                        checked={isGroupAllSelected}
                                        ref={(el) => {
                                            if (el) el.indeterminate = isSomeSelected;
                                        }}
                                        onChange={() => handleToggleGroup(groupPermValues, isGroupAllSelected)}
                                    />
                                    <span className="text-xs text-gray-600">All</span>
                                </label>
                            </div>

                            <div className="space-y-2">
                                {group.permissions.map((permission) => (
                                    <label
                                        key={permission.value}
                                        className="flex items-center space-x-3 cursor-pointer group"
                                    >
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                                            checked={selectedPermissions.includes(permission.value)}
                                            onChange={() => handleTogglePermission(permission.value)}
                                        />
                                        <span className="text-sm text-gray-700 group-hover:text-teal-700 transition-colors">
                                            {permission.label}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default PermissionCheckboxList;

import React, { useState, useEffect } from 'react';
import PermissionCheckboxList from './PermissionCheckboxList';
import { Role } from "../../../../types/rbac";

interface EditRoleModalProps {
    isOpen: boolean;
    role: Role | null;
    onClose: () => void;
    onSave: (id: string, roleName: string, permissions: string[]) => void;
}

const EditRoleModal: React.FC<EditRoleModalProps> = ({ isOpen, role, onClose, onSave }) => {
    const [roleName, setRoleName] = useState('');
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        if (role) {
            setRoleName(role.name);
            setSelectedPermissions(role.permissions);
        }
    }, [role]);

    if (!isOpen || !role) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!roleName.trim()) {
            setError('Role name is required');
            return;
        }
        if (selectedPermissions.length === 0) {
            setError('At least one permission must be selected');
            return;
        }

        onSave(role._id, roleName, selectedPermissions);
        setError('');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-teal-700 text-white">
                    <h2 className="text-xl font-bold">Edit Role: {role.name}</h2>
                    <button onClick={onClose} className="text-white hover:text-gray-200 transition-colors">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                {/* Form Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    <form id="edit-role-form" onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="edit-role-name" className="block text-sm font-medium text-gray-700 mb-1">
                                Role Name
                            </label>
                            <input
                                id="edit-role-name"
                                type="text"
                                value={roleName}
                                onChange={(e) => {
                                    setRoleName(e.target.value);
                                    if (error) setError('');
                                }}
                                disabled={role.name === 'Super Admin'} // Protect Super Admin role name
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                            />
                            {role.name === 'Super Admin' && (
                                <p className="mt-1 text-xs text-amber-600">Super Admin name cannot be changed.</p>
                            )}
                            {error && error.includes('name') && (
                                <p className="mt-1 text-xs text-red-500">{error}</p>
                            )}
                        </div>

                        <PermissionCheckboxList
                            selectedPermissions={selectedPermissions}
                            onChange={(perms) => {
                                setSelectedPermissions(perms);
                                if (error) setError('');
                            }}
                        />

                        {error && error.includes('permission') && (
                            <p className="mt-2 text-sm text-red-500 text-center">{error}</p>
                        )}
                    </form>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end space-x-3 bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="edit-role-form"
                        className="px-6 py-2 bg-teal-700 text-white text-sm font-semibold rounded-lg hover:bg-teal-800 transition-all shadow-md active:scale-95"
                    >
                        Update Role
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditRoleModal;

import React, { useState, useEffect } from 'react';
import RoleList from '../components/roles/RoleList';
import CreateRoleModal from '../components/roles/CreateRoleModal';
import EditRoleModal from '../components/roles/EditRoleModal';
import { Role } from "../../../types/rbac";
import * as roleService from "../../../services/api/admin/adminRoleService";

const AdminRoles: React.FC = () => {
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);

    // Load roles from API on mount
    const fetchRoles = async () => {
        try {
            setLoading(true);
            const response = await roleService.getRoles();
            if (response.success) {
                setRoles(response.data);
            }
        } catch (error) {
            console.error("Failed to fetch roles:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRoles();
    }, []);

    const handleCreateRole = async (name: string, permissions: string[]) => {
        try {
            const response = await roleService.createRole({ name, permissions });
            if (response.success) {
                fetchRoles();
                setIsCreateModalOpen(false);
            }
        } catch (error) {
            console.error("Failed to create role:", error);
            alert("Failed to create role. It might already exist.");
        }
    };

    const handleEditRole = async (id: string, name: string, permissions: string[]) => {
        try {
            const response = await roleService.updateRole(id, { name, permissions });
            if (response.success) {
                fetchRoles();
                setIsEditModalOpen(false);
                setSelectedRole(null);
            }
        } catch (error) {
            console.error("Failed to update role:", error);
            alert("Failed to update role.");
        }
    };

    const handleDeleteRole = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this role? Users assigned to this role may lose access.')) {
            try {
                const response = await roleService.deleteRole(id);
                if (response.success) {
                    fetchRoles();
                }
            } catch (error) {
                console.error("Failed to delete role:", error);
                alert("Failed to delete role. System roles cannot be deleted.");
            }
        }
    };

    const openEditModal = (role: Role) => {
        setSelectedRole(role);
        setIsEditModalOpen(true);
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Role Management</h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Define and manage access permissions for different administrative roles.
                    </p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center justify-center px-5 py-2.5 bg-teal-700 text-white font-semibold rounded-lg hover:bg-teal-800 transition-all shadow-md active:scale-95 whitespace-nowrap"
                >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Create New Role
                </button>
            </div>

            {/* Main Content */}
            {loading ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-700 rounded-full animate-spin"></div>
                    <p className="mt-4 text-gray-500 font-medium">Loading roles...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    <RoleList
                        roles={roles}
                        onEdit={openEditModal}
                        onDelete={handleDeleteRole}
                    />
                </div>
            )}

            {/* Info Card */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start space-x-3">
                <div className="text-blue-500 mt-0.5">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                </div>
                <div className="text-sm text-blue-800">
                    <p className="font-semibold">System Note:</p>
                    <p className="mt-1">
                        Permissions are enforced across the sidebar, pages, and action buttons.
                        Super Admin and Admin roles are system roles and have restricted modifications.
                    </p>
                </div>
            </div>

            {/* Modals */}
            <CreateRoleModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSave={handleCreateRole}
            />

            <EditRoleModal
                isOpen={isEditModalOpen}
                role={selectedRole}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setSelectedRole(null);
                }}
                onSave={handleEditRole}
            />
        </div>
    );
};

export default AdminRoles;

'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Shield, User, Stethoscope, Lock, Search, ToggleLeft, ToggleRight, Building2, Check } from 'lucide-react';
import {
    User as UserType,
    UserRole,
    UsersStore,
    AssignedScope,
    DESIGNATIONS_BY_DEPARTMENT,
    ALL_DESIGNATIONS,
    DEPARTMENTS,
    CLINICS,
} from '@/lib/users-store';
import { Doctor } from '@/lib/data';

interface UserFormState {
    name: string;
    username: string;
    password?: string;
    role: UserRole;
    designation: string;
    department: string;
    clinicIds: string[];
    isActive: boolean;
    scopeDoctorId?: string;
}

const EMPTY_FORM: UserFormState = {
    name: '',
    username: '',
    password: '',
    role: 'STAFF',
    designation: '',
    department: 'Clinical',
    clinicIds: ['clinic-1'],
    isActive: true,
    scopeDoctorId: '',
};

export default function StaffPage() {
    const [users, setUsers] = useState<UserType[]>([]);
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<UserType | null>(null);
    const [currentUser, setCurrentUser] = useState<UserType | null>(null);
    const [formData, setFormData] = useState<UserFormState>({ ...EMPTY_FORM });
    const [searchQuery, setSearchQuery] = useState('');
    const [filterDept, setFilterDept] = useState('');
    const [filterRole, setFilterRole] = useState('');

    useEffect(() => {
        const stored = sessionStorage.getItem('adminUser');
        if (stored) {
            const user = JSON.parse(stored);
            if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
                window.location.href = '/admin';
                return;
            }
            setCurrentUser(user);
        }
        loadData();
    }, []);

    const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

    const loadData = async () => {
        setUsers(UsersStore.getUsers());
        try {
            const res = await fetch('/api/admin/doctors');
            if (res.ok) {
                const data = await res.json();
                const allDoctors: Doctor[] = [];
                data.forEach((c: any) => {
                    c.departments.forEach((d: any) => {
                        allDoctors.push(...d.doctors);
                    });
                });
                setDoctors(allDoctors);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const canManage = (targetUser: UserType) => {
        if (isSuperAdmin) return true;
        if (targetUser.role === 'SUPER_ADMIN' || targetUser.role === 'ADMIN') return false;
        return true;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const scope: AssignedScope = {};
        if (formData.role === 'DOCTOR' && formData.scopeDoctorId) {
            scope.doctorId = formData.scopeDoctorId;
        }

        if (editingUser) {
            UsersStore.updateUser(editingUser.id, {
                name: formData.name,
                username: formData.username,
                role: formData.role,
                designation: formData.designation,
                department: formData.department,
                clinicIds: formData.clinicIds,
                isActive: formData.isActive,
                scope,
                ...(formData.password ? { password: formData.password } : {}),
            });
        } else {
            if (!formData.password) {
                alert('Password is required for new users');
                return;
            }
            UsersStore.addUser({
                name: formData.name,
                username: formData.username,
                password: formData.password,
                role: formData.role,
                designation: formData.designation,
                department: formData.department,
                clinicIds: formData.clinicIds,
                isActive: formData.isActive,
                scope,
            });
        }

        setIsModalOpen(false);
        setEditingUser(null);
        setFormData({ ...EMPTY_FORM });
        loadData();
    };

    const handleEdit = (user: UserType) => {
        setEditingUser(user);
        setFormData({
            name: user.name,
            username: user.username,
            role: user.role,
            designation: user.designation || '',
            department: user.department || 'Clinical',
            clinicIds: user.clinicIds || [],
            isActive: user.isActive,
            scopeDoctorId: user.scope?.doctorId || '',
            password: '',
        });
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        if (confirm('Are you sure you want to delete this user?')) {
            UsersStore.deleteUser(id);
            loadData();
        }
    };

    const handleToggleActive = (user: UserType) => {
        UsersStore.updateUser(user.id, { isActive: !user.isActive });
        loadData();
    };

    const toggleClinicId = (cId: string) => {
        setFormData(prev => {
            const ids = prev.clinicIds.includes(cId)
                ? prev.clinicIds.filter(id => id !== cId)
                : [...prev.clinicIds, cId];
            return { ...prev, clinicIds: ids };
        });
    };

    const selectAllClinics = () => {
        setFormData(prev => ({
            ...prev,
            clinicIds: CLINICS.map(c => c.id),
        }));
    };

    const getRoleIcon = (role: UserRole) => {
        if (role === 'SUPER_ADMIN') return <Shield className="w-4 h-4 text-purple-600" />;
        if (role === 'ADMIN') return <Shield className="w-4 h-4 text-indigo-600" />;
        if (role === 'DOCTOR') return <Stethoscope className="w-4 h-4 text-green-600" />;
        return <User className="w-4 h-4 text-gray-600" />;
    };

    const getRoleBadgeColor = (role: UserRole) => {
        if (role === 'SUPER_ADMIN') return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
        if (role === 'ADMIN') return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
        if (role === 'DOCTOR') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    };

    const getClinicNames = (ids: string[]) => {
        if (!ids || ids.length === 0) return '-';
        return ids.map(id => {
            const c = CLINICS.find(cl => cl.id === id);
            return c?.name || id;
        });
    };

    const filteredDesignations = formData.department
        ? DESIGNATIONS_BY_DEPARTMENT[formData.department] || []
        : ALL_DESIGNATIONS;

    const filteredUsers = users.filter(u => {
        const matchesSearch =
            !searchQuery ||
            u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (u.designation || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesDept = !filterDept || u.department === filterDept;
        const matchesRole = !filterRole || u.role === filterRole;
        return matchesSearch && matchesDept && matchesRole;
    });

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <Lock className="w-7 h-7 text-indigo-600" />
                        Staff Access
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Manage user accounts, designations, and access roles.</p>
                </div>
                <button
                    onClick={() => {
                        setEditingUser(null);
                        setFormData({ ...EMPTY_FORM });
                        setIsModalOpen(true);
                    }}
                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Add New User
                </button>
            </header>

            {/* Filters */}
            <div className="mb-6 flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name, username, or designation..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
                <select
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                    value={filterDept}
                    onChange={e => setFilterDept(e.target.value)}
                >
                    <option value="">All Departments</option>
                    {DEPARTMENTS.map(d => (
                        <option key={d} value={d}>{d}</option>
                    ))}
                </select>
                <select
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                    value={filterRole}
                    onChange={e => setFilterRole(e.target.value)}
                >
                    <option value="">All Roles</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                    <option value="ADMIN">Admin</option>
                    <option value="DOCTOR">Doctor</option>
                    <option value="STAFF">Staff</option>
                </select>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-500 uppercase font-medium">Total Users</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{users.length}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-500 uppercase font-medium">Active</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">{users.filter(u => u.isActive).length}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-500 uppercase font-medium">Inactive</p>
                    <p className="text-2xl font-bold text-red-500 mt-1">{users.filter(u => !u.isActive).length}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-500 uppercase font-medium">Doctors</p>
                    <p className="text-2xl font-bold text-indigo-600 mt-1">{users.filter(u => u.role === 'DOCTOR').length}</p>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 uppercase">
                                <th className="px-5 py-3">User</th>
                                <th className="px-5 py-3">Role</th>
                                <th className="px-5 py-3">Designation</th>
                                <th className="px-5 py-3">Department</th>
                                <th className="px-5 py-3">Branches</th>
                                <th className="px-5 py-3">Status</th>
                                <th className="px-5 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {filteredUsers.map(user => {
                                const branchNames = getClinicNames(user.clinicIds);
                                return (
                                    <tr key={user.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${!user.isActive ? 'opacity-60' : ''}`}>
                                        <td className="px-5 py-4">
                                            <div>
                                                <div className="font-medium text-gray-900 dark:text-white text-sm">{user.name}</div>
                                                <div className="text-xs text-gray-500">@{user.username}</div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                                                {getRoleIcon(user.role)}
                                                {user.role.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">
                                            {user.designation || <span className="text-gray-400">-</span>}
                                        </td>
                                        <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-400">
                                            {user.department || <span className="text-gray-400">-</span>}
                                        </td>
                                        <td className="px-5 py-4">
                                            {Array.isArray(branchNames) ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {branchNames.map((name, i) => (
                                                        <span key={i} className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                                            <Building2 className="w-2.5 h-2.5" />
                                                            {name}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 text-sm">-</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            {user.isActive ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                                    Inactive
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            {canManage(user) ? (
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => handleToggleActive(user)}
                                                        title={user.isActive ? 'Deactivate' : 'Activate'}
                                                        className={`p-1.5 rounded-md transition-colors ${user.isActive ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20' : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'}`}
                                                    >
                                                        {user.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                                                    </button>
                                                    <button
                                                        onClick={() => handleEdit(user)}
                                                        title="Edit"
                                                        className="text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 p-1.5 rounded-md transition-colors"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(user.id)}
                                                        title="Delete"
                                                        className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-md transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-400 italic">No access</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredUsers.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-5 py-12 text-center text-gray-400">
                                        No users found matching your filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add / Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-5 text-gray-900 dark:text-white">
                            {editingUser ? 'Edit User' : 'Add New User'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Row 1: Name + Username */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Full Name</label>
                                    <input
                                        required
                                        className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Username</label>
                                    <input
                                        required
                                        className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={formData.username}
                                        onChange={e => setFormData({ ...formData, username: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Password</label>
                                <input
                                    type="password"
                                    required={!editingUser}
                                    placeholder={editingUser ? "Leave blank to keep current" : ""}
                                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>

                            {/* Row 2: Role + Department */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Role</label>
                                    <select
                                        className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                                    >
                                        <option value="STAFF">Staff</option>
                                        <option value="DOCTOR">Doctor</option>
                                        <option value="ADMIN">Admin</option>
                                        {isSuperAdmin && <option value="SUPER_ADMIN">Super Admin</option>}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Department</label>
                                    <select
                                        className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={formData.department}
                                        onChange={e => setFormData({ ...formData, department: e.target.value, designation: '' })}
                                    >
                                        {DEPARTMENTS.map(d => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Designation */}
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Designation</label>
                                <select
                                    required
                                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={formData.designation}
                                    onChange={e => setFormData({ ...formData, designation: e.target.value })}
                                >
                                    <option value="">Select Designation</option>
                                    {filteredDesignations.map(d => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Branches — Multi-select checkboxes */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Assigned Branches
                                    </label>
                                    <button
                                        type="button"
                                        onClick={selectAllClinics}
                                        className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 font-medium"
                                    >
                                        Select All
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {CLINICS.map(clinic => {
                                        const isSelected = formData.clinicIds.includes(clinic.id);
                                        return (
                                            <button
                                                key={clinic.id}
                                                type="button"
                                                onClick={() => toggleClinicId(clinic.id)}
                                                className={`flex items-center gap-2 p-2.5 rounded-lg border-2 text-left text-sm transition-all ${isSelected
                                                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                                                        : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                                                    }`}
                                            >
                                                <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${isSelected
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'border border-gray-300 dark:border-gray-500'
                                                    }`}>
                                                    {isSelected && <Check className="w-3 h-3" />}
                                                </div>
                                                <span className="text-xs font-medium">{clinic.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                {formData.clinicIds.length === 0 && (
                                    <p className="text-xs text-red-500 mt-1">Please select at least one branch.</p>
                                )}
                            </div>

                            {/* Doctor Profile Link */}
                            {formData.role === 'DOCTOR' && (
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Assigned Doctor Profile</label>
                                    <select
                                        className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={formData.scopeDoctorId}
                                        onChange={e => setFormData({ ...formData, scopeDoctorId: e.target.value })}
                                    >
                                        <option value="">Select Doctor</option>
                                        {doctors.map(d => (
                                            <option key={d.id} value={d.id}>{d.name} ({d.specialty})</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Active Toggle */}
                            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.isActive ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {formData.isActive ? 'Account Active' : 'Account Inactive'}
                                </span>
                            </div>

                            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={formData.clinicIds.length === 0}
                                    className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors disabled:opacity-50"
                                >
                                    {editingUser ? 'Save Changes' : 'Create User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

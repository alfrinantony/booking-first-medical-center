'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Shield, User, Stethoscope, Lock } from 'lucide-react';
import { User as UserType, UserRole, UsersStore, AssignedScope } from '@/lib/users-store';
import { Doctor } from '@/lib/data';

interface UserFormState {
    name: string;
    username: string;
    password?: string;
    role: UserRole;
    scopeClinicId?: string;
    scopeDoctorId?: string;
}

export default function StaffPage() {
    const [users, setUsers] = useState<UserType[]>([]);
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<UserType | null>(null);
    const [formData, setFormData] = useState<UserFormState>({
        name: '',
        username: '',
        role: 'STAFF',
        scopeClinicId: 'clinic-1', // Default
        scopeDoctorId: ''
    });

    useEffect(() => {
        const stored = sessionStorage.getItem('adminUser');
        if (stored) {
            const user = JSON.parse(stored);
            if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
                // effective permission check
                window.location.href = '/admin'; // Redirect unauthorized users
                return;
            }
        }
        loadData();
    }, []);

    const loadData = async () => {
        setUsers(UsersStore.getUsers());
        // In a real app we'd fetch clinics/doctors here. 
        // For now we'll fetch doctors from our api/admin/doctors route or just use the mock if accessible, 
        // but since we are client side, we should fetch.
        try {
            const res = await fetch('/api/admin/doctors');
            if (res.ok) {
                const data = await res.json();
                // Flatten doctors from clinics
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const scope: AssignedScope = {};
        if (formData.role === 'DOCTOR' && formData.scopeDoctorId) {
            scope.doctorId = formData.scopeDoctorId;
        }
        if ((formData.role === 'ADMIN' || formData.role === 'STAFF') && formData.scopeClinicId) {
            scope.clinicId = formData.scopeClinicId;
        }

        if (editingUser) {
            UsersStore.updateUser(editingUser.id, {
                name: formData.name,
                username: formData.username,
                role: formData.role,
                scope,
                ...(formData.password ? { password: formData.password } : {})
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
                scope
            });
        }

        setIsModalOpen(false);
        setEditingUser(null);
        setFormData({ name: '', username: '', role: 'STAFF', scopeClinicId: 'clinic-1', scopeDoctorId: '', password: '' });
        loadData();
    };

    const handleEdit = (user: UserType) => {
        setEditingUser(user);
        setFormData({
            name: user.name,
            username: user.username,
            role: user.role,
            scopeClinicId: user.scope?.clinicId || 'clinic-1',
            scopeDoctorId: user.scope?.doctorId || '',
            password: '' // Don't show password
        });
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        if (confirm('Are you sure you want to delete this user?')) {
            UsersStore.deleteUser(id);
            loadData();
        }
    };

    const getRoleIcon = (role: UserRole) => {
        if (role === 'SUPER_ADMIN') return <Shield className="w-4 h-4 text-purple-600" />;
        if (role === 'ADMIN') return <Shield className="w-4 h-4 text-indigo-600" />;
        if (role === 'DOCTOR') return <Stethoscope className="w-4 h-4 text-green-600" />;
        return <User className="w-4 h-4 text-gray-600" />;
    };

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Staff Management</h1>
                    <p className="text-gray-600 dark:text-gray-400">Manage user accounts and access roles.</p>
                </div>
                <button
                    onClick={() => {
                        setEditingUser(null);
                        setFormData({ name: '', username: '', role: 'STAFF', scopeClinicId: 'clinic-1', scopeDoctorId: '', password: '' });
                        setIsModalOpen(true);
                    }}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Add New User
                </button>
            </header>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 uppercase">
                            <th className="px-6 py-3">User</th>
                            <th className="px-6 py-3">Role</th>
                            <th className="px-6 py-3">Assigned Scope</th>
                            <th className="px-6 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {users.map(user => (
                            <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-6 py-4">
                                    <div>
                                        <div className="font-medium text-gray-900 dark:text-white">{user.name}</div>
                                        <div className="text-sm text-gray-500">@{user.username}</div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                                        {getRoleIcon(user.role)}
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                                    {user.role === 'DOCTOR' && user.scope?.doctorId ? (
                                        <span className="flex items-center gap-1 text-green-600">
                                            <Stethoscope className="w-3 h-3" />
                                            Linked to Dr. Profile
                                        </span>
                                    ) : user.scope?.clinicId ? (
                                        <span>Clinic ID: {user.scope.clinicId}</span>
                                    ) : (
                                        <span className="text-gray-400">-</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleEdit(user)}
                                            className="text-indigo-600 hover:text-indigo-800 p-1"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(user.id)}
                                            className="text-red-600 hover:text-red-800 p-1"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-xl">
                        <h2 className="text-xl font-bold mb-4">{editingUser ? 'Edit User' : 'Add New User'}</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Full Name</label>
                                <input
                                    required
                                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Username</label>
                                <input
                                    required
                                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Password</label>
                                <input
                                    type="password"
                                    required={!editingUser}
                                    placeholder={editingUser ? "Leave blank to keep current" : ""}
                                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Role</label>
                                <select
                                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                                >
                                    <option value="STAFF">Staff</option>
                                    <option value="DOCTOR">Doctor</option>
                                    <option value="ADMIN">Admin</option>
                                    <option value="SUPER_ADMIN">Super Admin</option>
                                </select>
                            </div>

                            {formData.role === 'DOCTOR' && (
                                <div>
                                    <label className="block text-sm font-medium mb-1">Assigned Doctor Profile</label>
                                    <select
                                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
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

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                >
                                    Save User
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

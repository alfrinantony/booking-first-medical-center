'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Archive, Activity, CalendarClock, ShieldCheck, Hash } from 'lucide-react';
import { Resource, Clinic } from '@/lib/data';

interface ResourceFormState {
    name: string;
    type: string;
    clinicId: string;
    totalQuantity: number;
    serialNumber: string;
    calibrationExpiryDate: string;
    warrantyEndDate: string;
}

export default function ResourcesPage() {
    const [resources, setResources] = useState<Resource[]>([]);
    const [clinics, setClinics] = useState<Clinic[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingResource, setEditingResource] = useState<Resource | null>(null);

    const [newResource, setNewResource] = useState<ResourceFormState>({
        name: '',
        type: 'Equipment',
        clinicId: '',
        totalQuantity: 1,
        serialNumber: '',
        calibrationExpiryDate: '',
        warrantyEndDate: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [resResources, resClinics] = await Promise.all([
                fetch(`/api/admin/resources?_t=${Date.now()}`),
                fetch(`/api/admin/services?_t=${Date.now()}`) // Assuming this returns clinics structure
            ]);

            const resourcesData = await resResources.json();
            const clinicsData = await resClinics.json();

            setResources(resourcesData);
            setClinics(clinicsData);

            if (clinicsData.length > 0 && !newResource.clinicId) {
                setNewResource(prev => ({ ...prev, clinicId: clinicsData[0].id }));
            }
        } catch (error) {
            console.error('Failed to fetch data', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/admin/resources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...newResource,
                    serialNumber: newResource.serialNumber || undefined,
                    calibrationExpiryDate: newResource.calibrationExpiryDate || undefined,
                    warrantyEndDate: newResource.warrantyEndDate || undefined
                })
            });

            if (res.ok) {
                fetchData();
                setIsAddModalOpen(false);
                setNewResource(prev => ({ ...prev, name: '', totalQuantity: 1, serialNumber: '', calibrationExpiryDate: '', warrantyEndDate: '' }));
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingResource) return;

        try {
            const res = await fetch('/api/admin/resources', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingResource)
            });

            if (res.ok) {
                fetchData();
                setIsEditModalOpen(false);
                setEditingResource(null);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure?')) return;
        try {
            const res = await fetch(`/api/admin/resources?id=${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                fetchData();
            }
        } catch (error) {
            console.error(error);
        }
    };

    const openEdit = (resource: Resource) => {
        setEditingResource(resource);
        setIsEditModalOpen(true);
    };

    const getClinicName = (id: string) => clinics.find(c => c.id === id)?.name || id;

    const getDaysLeft = (dateStr?: string) => {
        if (!dateStr) return null;
        return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    };

    const getDateBadge = (dateStr: string | undefined, label: string, icon: React.ReactNode) => {
        if (!dateStr) return null;
        const daysLeft = getDaysLeft(dateStr)!;
        const colorClass = daysLeft <= 0
            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            : daysLeft <= 90
                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
        const text = daysLeft <= 0
            ? `${label}: Expired`
            : daysLeft <= 90
                ? `${label}: ${daysLeft}d left`
                : `${label}: ${dateStr}`;
        return (
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${colorClass}`}>
                {icon} {text}
            </span>
        );
    };

    if (loading) return <div className="p-8">Loading resources...</div>;

    // Group by Clinic
    const groupedResources = resources.reduce((acc, curr) => {
        if (!acc[curr.clinicId]) acc[curr.clinicId] = [];
        acc[curr.clinicId].push(curr);
        return acc;
    }, {} as Record<string, Resource[]>);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-6xl mx-auto">
                <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Resource Management</h1>
                        <p className="text-gray-600 dark:text-gray-400">Manage physical resources like machines and rooms.</p>
                    </div>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Resource
                    </button>
                </header>

                <div className="space-y-8">
                    {Object.keys(groupedResources).length === 0 && (
                        <div className="text-center py-12 text-gray-500 bg-white dark:bg-gray-800 rounded-xl">
                            No resources found. Add one to get started.
                        </div>
                    )}

                    {Object.entries(groupedResources).map(([clinicId, clinicResources]) => (
                        <div key={clinicId} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                            <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{getClinicName(clinicId)}</h2>
                            </div>
                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                {clinicResources.map(resource => (
                                    <div key={resource.id} className="p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                                        <div>
                                            <h3 className="font-medium text-gray-900 dark:text-white mb-1">{resource.name}</h3>
                                            <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    <Archive className="w-4 h-4" />
                                                    {resource.type}
                                                </span>
                                                <span className="flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-400">
                                                    <Activity className="w-4 h-4" />
                                                    Quantity: {resource.totalQuantity}
                                                </span>
                                                {resource.serialNumber && (
                                                    <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                                        <Hash className="w-3 h-3" /> S/N: {resource.serialNumber}
                                                    </span>
                                                )}
                                                {getDateBadge(resource.calibrationExpiryDate, 'Calibration', <CalendarClock className="w-3 h-3" />)}
                                                {getDateBadge(resource.warrantyEndDate, 'Warranty', <ShieldCheck className="w-3 h-3" />)}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => openEdit(resource)}
                                                className="text-indigo-500 hover:text-indigo-700 p-2 rounded-full hover:bg-indigo-50"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(resource.id)}
                                                className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Add Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-xl">
                        <h2 className="text-xl font-bold mb-4">Add New Resource</h2>
                        <form onSubmit={handleAdd} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Clinic</label>
                                <select
                                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                    value={newResource.clinicId}
                                    onChange={(e) => setNewResource({ ...newResource, clinicId: e.target.value })}
                                >
                                    {clinics.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Name</label>
                                <input
                                    required
                                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                    value={newResource.name}
                                    onChange={(e) => setNewResource({ ...newResource, name: e.target.value })}
                                    placeholder="e.g. Laser Machine A"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Serial Number</label>
                                <input
                                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                    value={newResource.serialNumber}
                                    onChange={(e) => setNewResource({ ...newResource, serialNumber: e.target.value })}
                                    placeholder="e.g. SN-2024-00123"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Type</label>
                                    <select
                                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={newResource.type}
                                        onChange={(e) => setNewResource({ ...newResource, type: e.target.value })}
                                    >
                                        <option value="Equipment">Equipment</option>
                                        <option value="Room">Room</option>
                                        <option value="Staff">Staff</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Total Quantity</label>
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={newResource.totalQuantity}
                                        onChange={(e) => setNewResource({ ...newResource, totalQuantity: Number(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Calibration Expiry</label>
                                    <input
                                        type="date"
                                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={newResource.calibrationExpiryDate}
                                        onChange={(e) => setNewResource({ ...newResource, calibrationExpiryDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Warranty End Date</label>
                                    <input
                                        type="date"
                                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={newResource.warrantyEndDate}
                                        onChange={(e) => setNewResource({ ...newResource, warrantyEndDate: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-gray-600">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Add Resource</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {isEditModalOpen && editingResource && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-xl">
                        <h2 className="text-xl font-bold mb-4">Edit Resource</h2>
                        <form onSubmit={handleUpdate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Name</label>
                                <input
                                    required
                                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                    value={editingResource.name}
                                    onChange={(e) => setEditingResource({ ...editingResource, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Serial Number</label>
                                <input
                                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                    value={editingResource.serialNumber || ''}
                                    onChange={(e) => setEditingResource({ ...editingResource, serialNumber: e.target.value || undefined })}
                                    placeholder="e.g. SN-2024-00123"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Type</label>
                                    <select
                                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={editingResource.type}
                                        onChange={(e) => setEditingResource({ ...editingResource, type: e.target.value })}
                                    >
                                        <option value="Equipment">Equipment</option>
                                        <option value="Room">Room</option>
                                        <option value="Staff">Staff</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Quantity</label>
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={editingResource.totalQuantity}
                                        onChange={(e) => setEditingResource({ ...editingResource, totalQuantity: Number(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Calibration Expiry</label>
                                    <input
                                        type="date"
                                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={editingResource.calibrationExpiryDate || ''}
                                        onChange={(e) => setEditingResource({ ...editingResource, calibrationExpiryDate: e.target.value || undefined })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Warranty End Date</label>
                                    <input
                                        type="date"
                                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={editingResource.warrantyEndDate || ''}
                                        onChange={(e) => setEditingResource({ ...editingResource, warrantyEndDate: e.target.value || undefined })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-gray-600">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

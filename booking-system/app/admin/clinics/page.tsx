'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit2, Trash2, MapPin, Clock, Phone, Mail, Car, FileCheck } from 'lucide-react';
import { Clinic } from '@/lib/data';

interface ClinicFormState {
    id?: string;
    name: string;
    address: string;
    vatPercentage: number;
    image: string;
    operationHours: string;
    locationMap: string;
    parkingInfo: string;
    contactPhone: string;
    email: string;
    workingDays: number[];
    openingTime: string;
    closingTime: string;
    tradeLicenceNumber: string;
    tradeLicenceExpiry: string;
    dhaLicenceNumber: string;
    dhaLicenceExpiry: string;
    fanarLicenceNumber: string;
    fanarLicenceExpiry: string;
}

const initialFormState: ClinicFormState = {
    name: '',
    address: '',
    vatPercentage: 0,
    image: '',
    operationHours: '',
    locationMap: '',
    parkingInfo: '',
    contactPhone: '',
    email: '',
    workingDays: [1, 2, 3, 4, 5],
    openingTime: '09:00',
    closingTime: '17:00',
    tradeLicenceNumber: '',
    tradeLicenceExpiry: '',
    dhaLicenceNumber: '',
    dhaLicenceExpiry: '',
    fanarLicenceNumber: '',
    fanarLicenceExpiry: '',
};

export default function AdminClinicsPage() {
    const [clinics, setClinics] = useState<Clinic[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClinic, setEditingClinic] = useState<ClinicFormState>(initialFormState);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        fetchClinics();
    }, []);

    const fetchClinics = async () => {
        try {
            const res = await fetch('/api/admin/clinics');
            if (res.ok) {
                const data = await res.json();
                setClinics(data);
            }
        } catch (error) {
            console.error('Failed to fetch clinics', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const url = isEditing ? '/api/admin/clinics' : '/api/admin/clinics';
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingClinic),
            });

            if (res.ok) {
                fetchClinics();
                setIsModalOpen(false);
                setEditingClinic(initialFormState);
                setIsEditing(false);
            }
        } catch (error) {
            console.error('Failed to save clinic', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this clinic? This action cannot be undone.')) return;

        try {
            const res = await fetch(`/api/admin/clinics?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchClinics();
            }
        } catch (error) {
            console.error('Failed to delete clinic', error);
        }
    };

    const openEditModal = (clinic: Clinic) => {
        setEditingClinic({
            id: clinic.id,
            name: clinic.name,
            address: clinic.address,
            vatPercentage: clinic.vatPercentage,
            image: clinic.image || '',
            operationHours: clinic.operationHours || '',
            locationMap: clinic.locationMap || '',
            parkingInfo: clinic.parkingInfo || '',
            contactPhone: clinic.contactPhone || '',
            email: clinic.email || '',
            workingDays: clinic.workingDays || [1, 2, 3, 4, 5],
            openingTime: clinic.openingTime || '09:00',
            closingTime: clinic.closingTime || '17:00',
            tradeLicenceNumber: clinic.tradeLicenceNumber || '',
            tradeLicenceExpiry: clinic.tradeLicenceExpiry || '',
            dhaLicenceNumber: clinic.dhaLicenceNumber || '',
            dhaLicenceExpiry: clinic.dhaLicenceExpiry || '',
            fanarLicenceNumber: clinic.fanarLicenceNumber || '',
            fanarLicenceExpiry: clinic.fanarLicenceExpiry || '',
        });
        setIsEditing(true);
        setIsModalOpen(true);
    };

    const openAddModal = () => {
        setEditingClinic(initialFormState);
        setIsEditing(false);
        setIsModalOpen(true);
    };

    if (loading) return <div className="p-8">Loading branches...</div>;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-7xl mx-auto">
                <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Branch Management</h1>
                        <p className="text-gray-600 dark:text-gray-400">Manage clinic locations, hours, and contact info.</p>
                    </div>
                    <button
                        onClick={openAddModal}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add New Branch
                    </button>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {clinics.map((clinic) => (
                        <div key={clinic.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
                            {/* Image Placeholder or Actual Image */}
                            <div className="h-48 bg-gray-200 dark:bg-gray-700 relative">
                                {clinic.image ? (
                                    <img src={clinic.image} alt={clinic.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-gray-400">
                                        <MapPin className="w-12 h-12" />
                                    </div>
                                )}
                                <div className="absolute top-4 right-4 flex gap-2">
                                    <button
                                        onClick={() => openEditModal(clinic)}
                                        className="p-2 bg-white/90 dark:bg-gray-800/90 rounded-full hover:bg-white dark:hover:bg-gray-800 text-indigo-600 shadow-sm"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(clinic.id)}
                                        className="p-2 bg-white/90 dark:bg-gray-800/90 rounded-full hover:bg-white dark:hover:bg-gray-800 text-red-500 shadow-sm"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 flex-1 flex flex-col">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{clinic.name}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 flex items-start gap-2">
                                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    {clinic.address}
                                </p>

                                <div className="space-y-3 mt-auto">
                                    {clinic.contactPhone && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                            <Phone className="w-4 h-4 text-indigo-500" />
                                            {clinic.contactPhone}
                                        </div>
                                    )}
                                    {clinic.operationHours && (
                                        <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                                            <Clock className="w-4 h-4 text-indigo-500 mt-0.5" />
                                            <span className="whitespace-pre-line">{clinic.operationHours}</span>
                                        </div>
                                    )}
                                    <div className="text-xs text-gray-400 mt-2">
                                        VAT: {clinic.vatPercentage}%
                                    </div>
                                    {(clinic.tradeLicenceNumber || clinic.dhaLicenceNumber || clinic.fanarLicenceNumber) && (
                                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-1.5">
                                            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                                                <FileCheck className="w-3 h-3" /> Licences
                                            </div>
                                            {clinic.tradeLicenceNumber && (
                                                <div className="text-xs text-gray-500">
                                                    <span className="font-medium">Trade:</span> {clinic.tradeLicenceNumber}
                                                    {clinic.tradeLicenceExpiry && <span className="ml-1 text-gray-400">(exp {clinic.tradeLicenceExpiry})</span>}
                                                </div>
                                            )}
                                            {clinic.dhaLicenceNumber && (
                                                <div className="text-xs text-gray-500">
                                                    <span className="font-medium">DHA:</span> {clinic.dhaLicenceNumber}
                                                    {clinic.dhaLicenceExpiry && <span className="ml-1 text-gray-400">(exp {clinic.dhaLicenceExpiry})</span>}
                                                </div>
                                            )}
                                            {clinic.fanarLicenceNumber && (
                                                <div className="text-xs text-gray-500">
                                                    <span className="font-medium">FANAR:</span> {clinic.fanarLicenceNumber}
                                                    {clinic.fanarLicenceExpiry && <span className="ml-1 text-gray-400">(exp {clinic.fanarLicenceExpiry})</span>}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Add/Edit Modal */}
                {isModalOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full p-6 shadow-xl my-8">
                            <h2 className="text-xl font-bold mb-4">{isEditing ? 'Edit Branch' : 'Add New Branch'}</h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Branch Name</label>
                                        <input
                                            required
                                            type="text"
                                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingClinic.name}
                                            onChange={(e) => setEditingClinic({ ...editingClinic, name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">VAT Percentage (%)</label>
                                        <input
                                            required
                                            type="number"
                                            min="0"
                                            max="100"
                                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingClinic.vatPercentage}
                                            onChange={(e) => setEditingClinic({ ...editingClinic, vatPercentage: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium mb-1">Address</label>
                                        <input
                                            required
                                            type="text"
                                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingClinic.address}
                                            onChange={(e) => setEditingClinic({ ...editingClinic, address: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Phone</label>
                                        <input
                                            type="tel"
                                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingClinic.contactPhone}
                                            onChange={(e) => setEditingClinic({ ...editingClinic, contactPhone: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Email</label>
                                        <input
                                            type="email"
                                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingClinic.email}
                                            onChange={(e) => setEditingClinic({ ...editingClinic, email: e.target.value })}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium mb-1">Image URL</label>
                                        <input
                                            type="url"
                                            placeholder="https://..."
                                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingClinic.image}
                                            onChange={(e) => setEditingClinic({ ...editingClinic, image: e.target.value })}
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium mb-1">Working Days</label>
                                        <div className="flex flex-wrap gap-2">
                                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                                                <label key={day} className="flex items-center gap-1 bg-gray-50 dark:bg-gray-700/50 px-3 py-1 rounded-md border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-indigo-500">
                                                    <input
                                                        type="checkbox"
                                                        checked={editingClinic.workingDays.includes(idx)}
                                                        onChange={(e) => {
                                                            const newDays = e.target.checked
                                                                ? [...editingClinic.workingDays, idx]
                                                                : editingClinic.workingDays.filter(d => d !== idx);
                                                            setEditingClinic({ ...editingClinic, workingDays: newDays.sort() });
                                                        }}
                                                        className="rounded text-indigo-600"
                                                    />
                                                    <span className="text-sm">{day}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1">Opening Time</label>
                                        <input
                                            type="time"
                                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingClinic.openingTime}
                                            onChange={(e) => setEditingClinic({ ...editingClinic, openingTime: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Closing Time</label>
                                        <input
                                            type="time"
                                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingClinic.closingTime}
                                            onChange={(e) => setEditingClinic({ ...editingClinic, closingTime: e.target.value })}
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium mb-1">Display Hours Text (Optional Override)</label>
                                        <textarea
                                            rows={2}
                                            placeholder="Mon-Fri: 9AM - 6PM..."
                                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingClinic.operationHours}
                                            onChange={(e) => setEditingClinic({ ...editingClinic, operationHours: e.target.value })}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium mb-1">Parking Information</label>
                                        <textarea
                                            rows={2}
                                            placeholder="Free parking available..."
                                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingClinic.parkingInfo}
                                            onChange={(e) => setEditingClinic({ ...editingClinic, parkingInfo: e.target.value })}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium mb-1">Location Map URL (Embed Link)</label>
                                        <input
                                            type="url"
                                            placeholder="https://maps.google.com/..."
                                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingClinic.locationMap}
                                            onChange={(e) => setEditingClinic({ ...editingClinic, locationMap: e.target.value })}
                                        />
                                    </div>

                                    {/* Licences Section */}
                                    <div className="md:col-span-2 border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
                                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                            <FileCheck className="w-4 h-4" /> Licences
                                        </h3>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Trade Licence Number</label>
                                        <input type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingClinic.tradeLicenceNumber}
                                            onChange={(e) => setEditingClinic({ ...editingClinic, tradeLicenceNumber: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Trade Licence Expiry</label>
                                        <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingClinic.tradeLicenceExpiry}
                                            onChange={(e) => setEditingClinic({ ...editingClinic, tradeLicenceExpiry: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">DHA Licence Number</label>
                                        <input type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingClinic.dhaLicenceNumber}
                                            onChange={(e) => setEditingClinic({ ...editingClinic, dhaLicenceNumber: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">DHA Licence Expiry</label>
                                        <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingClinic.dhaLicenceExpiry}
                                            onChange={(e) => setEditingClinic({ ...editingClinic, dhaLicenceExpiry: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">FANAR Licence Number</label>
                                        <input type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingClinic.fanarLicenceNumber}
                                            onChange={(e) => setEditingClinic({ ...editingClinic, fanarLicenceNumber: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">FANAR Licence Expiry</label>
                                        <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingClinic.fanarLicenceExpiry}
                                            onChange={(e) => setEditingClinic({ ...editingClinic, fanarLicenceExpiry: e.target.value })} />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                    >
                                        {isEditing ? 'Save Changes' : 'Create Branch'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

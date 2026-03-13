'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Search, Edit2, MapPin, Stethoscope, ShieldCheck, CalendarClock, CircleDot } from 'lucide-react';
import { Clinic, Doctor } from '@/lib/data';

interface DoctorFormState {
    departmentId: string;
    name: string;
    specialty: string;
    image: string;
    certifications: string;
    maxConcurrentBookings: number;
    licenseNumber: string;
    licenseExpiry: string;
    startDate: string;
    endDate: string;
    status: 'working' | 'not_working';
}

export default function DoctorsPage() {
    const [clinics, setClinics] = useState<Clinic[]>([]);
    const [selectedClinicId, setSelectedClinicId] = useState('');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Add Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newDoctor, setNewDoctor] = useState<DoctorFormState>({
        departmentId: '',
        name: '',
        specialty: '',
        image: '',
        certifications: '',
        maxConcurrentBookings: 1,
        licenseNumber: '',
        licenseExpiry: '',
        startDate: '',
        endDate: '',
        status: 'working'
    });

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingDoctor, setEditingDoctor] = useState<Doctor & { departmentId: string } | null>(null);

    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchDoctors();
    }, []);

    const fetchDoctors = async () => {
        try {
            const res = await fetch('/api/admin/doctors');
            const data = await res.json();
            setClinics(data);
            if (data.length > 0 && !selectedClinicId) {
                setSelectedClinicId(data[0].id);
            }
        } catch (error) {
            console.error('Failed to fetch doctors', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddDoctor = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = {
                clinicId: selectedClinicId,
                departmentId: newDoctor.departmentId,
                name: newDoctor.name,
                specialty: newDoctor.specialty,
                image: newDoctor.image,
                certifications: newDoctor.certifications.split(',').map(c => c.trim()).filter(Boolean),
                maxConcurrentBookings: Number(newDoctor.maxConcurrentBookings) || 1,
                licenseNumber: newDoctor.licenseNumber || undefined,
                licenseExpiry: newDoctor.licenseExpiry || undefined,
                startDate: newDoctor.startDate || undefined,
                endDate: newDoctor.endDate || undefined,
                status: newDoctor.status
            };

            const res = await fetch('/api/admin/doctors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                await fetchDoctors();
                setIsAddModalOpen(false);
                setNewDoctor({ departmentId: '', name: '', specialty: '', image: '', certifications: '', maxConcurrentBookings: 1, licenseNumber: '', licenseExpiry: '', startDate: '', endDate: '', status: 'working' });
            } else {
                alert('Failed to add doctor');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateDoctor = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingDoctor) return;
        setSubmitting(true);
        try {
            const payload = {
                clinicId: selectedClinicId,
                departmentId: editingDoctor.departmentId,
                doctorId: editingDoctor.id,
                name: editingDoctor.name,
                specialty: editingDoctor.specialty,
                image: editingDoctor.image,
                certifications: typeof editingDoctor.certifications === 'string'
                    ? (editingDoctor.certifications as string).split(',').map((c: string) => c.trim()).filter(Boolean)
                    : editingDoctor.certifications,
                maxConcurrentBookings: Number(editingDoctor.maxConcurrentBookings) || 1,
                licenseNumber: editingDoctor.licenseNumber || undefined,
                licenseExpiry: editingDoctor.licenseExpiry || undefined,
                startDate: editingDoctor.startDate || undefined,
                endDate: editingDoctor.endDate || undefined,
                status: editingDoctor.status
            };

            const res = await fetch('/api/admin/doctors', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                await fetchDoctors();
                setIsEditModalOpen(false);
                setEditingDoctor(null);
            } else {
                alert('Failed to update doctor');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteDoctor = async (departmentId: string, doctorId: string) => {
        if (!confirm('Are you sure you want to delete this doctor?')) return;

        try {
            const res = await fetch(`/api/admin/doctors?clinicId=${encodeURIComponent(selectedClinicId)}&departmentId=${encodeURIComponent(departmentId)}&doctorId=${encodeURIComponent(doctorId)}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                await fetchDoctors();
            } else {
                alert('Failed to delete doctor');
            }
        } catch (error) {
            console.error(error);
        }
    };

    const openEditModal = (departmentId: string, doctor: Doctor) => {
        setEditingDoctor({
            ...doctor,
            departmentId
        });
        setIsEditModalOpen(true);
    };

    const currentClinic = clinics.find(c => c.id === selectedClinicId);

    // Derived departments with filtered doctors
    const filteredDepartments = currentClinic?.departments.map(dept => ({
        ...dept,
        doctors: dept.doctors.filter(d =>
            d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.specialty.toLowerCase().includes(searchTerm.toLowerCase())
        )
    })).filter(dept => dept.doctors.length > 0) || [];

    if (loading) return <div className="p-8">Loading doctors...</div>;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-6xl mx-auto">
                <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Manage Doctors</h1>
                        <p className="text-gray-600 dark:text-gray-400">Add, edit, or remove specialists from your clinics.</p>
                    </div>

                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add New Doctor
                    </button>
                </header>

                {/* Filters */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm mb-6 flex flex-col md:flex-row gap-4">
                    <div className="md:w-1/3">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Clinic Branch</label>
                        <select
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent"
                            value={selectedClinicId}
                            onChange={(e) => setSelectedClinicId(e.target.value)}
                        >
                            {clinics.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="md:w-2/3">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Search Doctors</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name or specialty..."
                                className="w-full pl-10 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Doctors List */}
                <div className="space-y-8">
                    {filteredDepartments.map(dept => (
                        <div key={dept.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                            <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{dept.name}</h2>
                                <span className="text-xs font-medium text-gray-500 bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded-full">{dept.doctors.length} Doctors</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                                {dept.doctors.map(doctor => (
                                    <div key={doctor.id} className={`flex flex-col items-center p-6 border rounded-xl hover:shadow-md transition-all group relative ${doctor.status === 'not_working' ? 'border-red-200 dark:border-red-800 opacity-60' : 'border-gray-100 dark:border-gray-700'}`}>
                                        {/* Status badge */}
                                        <div className="absolute top-3 right-3">
                                            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${doctor.status === 'not_working' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
                                                <CircleDot className="w-2.5 h-2.5" />
                                                {doctor.status === 'not_working' ? 'Not Working' : 'Working'}
                                            </span>
                                        </div>

                                        <div className="w-24 h-24 bg-gray-200 rounded-full overflow-hidden mb-4">
                                            <img src={doctor.image} alt={doctor.name} className="w-full h-full object-cover" />
                                        </div>
                                        <h3 className="font-bold text-gray-900 dark:text-white text-center">{doctor.name}</h3>
                                        <p className="text-sm text-indigo-600 dark:text-indigo-400 text-center mb-2">{doctor.specialty}</p>

                                        {/* License info */}
                                        {doctor.licenseNumber && (
                                            <div className="flex flex-wrap gap-1 justify-center mb-2">
                                                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                                                    <ShieldCheck className="w-3 h-3" /> Lic: {doctor.licenseNumber}
                                                </span>
                                                {doctor.licenseExpiry && (() => {
                                                    const daysLeft = Math.ceil((new Date(doctor.licenseExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                                                    return (
                                                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${daysLeft <= 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : daysLeft <= 90 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                                                            <CalendarClock className="w-3 h-3" />
                                                            {daysLeft <= 0 ? 'License Expired' : daysLeft <= 90 ? `Expires ${daysLeft}d` : `Exp: ${doctor.licenseExpiry}`}
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        )}

                                        {/* Employment dates */}
                                        {(doctor.startDate || doctor.endDate) && (
                                            <div className="text-[10px] text-gray-500 mb-2">
                                                {doctor.startDate && <span>From: {doctor.startDate}</span>}
                                                {doctor.startDate && doctor.endDate && <span> · </span>}
                                                {doctor.endDate && <span>To: {doctor.endDate}</span>}
                                            </div>
                                        )}

                                        {doctor.certifications && doctor.certifications.length > 0 && (
                                            <div className="flex flex-wrap gap-1 justify-center mb-4">
                                                {doctor.certifications.map((cert, idx) => (
                                                    <span key={idx} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                                                        {cert}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        <div className="mb-4 text-xs text-gray-500 bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded">
                                            Max Concurrent Bookings: <span className="font-bold text-gray-900 dark:text-gray-100">{doctor.maxConcurrentBookings || 1}</span>
                                        </div>

                                        <div className="flex gap-2 w-full mt-auto">
                                            <button
                                                onClick={() => openEditModal(dept.id, doctor)}
                                                className="flex-1 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteDoctor(dept.id, doctor.id)}
                                                className="flex-1 py-2 text-sm font-medium text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {filteredDepartments.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            No doctors found matchig your criteria.
                        </div>
                    )}
                </div>

                {/* Add Doctor Modal */}
                {isAddModalOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 shadow-xl my-8">
                            <h2 className="text-xl font-bold mb-4">Add New Doctor</h2>
                            <form onSubmit={handleAddDoctor} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Department</label>
                                    <select
                                        required
                                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={newDoctor.departmentId}
                                        onChange={(e) => setNewDoctor({ ...newDoctor, departmentId: e.target.value })}
                                    >
                                        <option value="">Select Department</option>
                                        {currentClinic?.departments.map(d => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Name</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="e.g., Dr. John Doe"
                                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={newDoctor.name}
                                        onChange={(e) => setNewDoctor({ ...newDoctor, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Specialty</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="e.g., Cardiology"
                                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={newDoctor.specialty}
                                        onChange={(e) => setNewDoctor({ ...newDoctor, specialty: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Image URL (Optional)</label>
                                    <input
                                        type="url"
                                        placeholder="Leave empty to auto-generate"
                                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={newDoctor.image}
                                        onChange={(e) => setNewDoctor({ ...newDoctor, image: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">License Number</label>
                                        <input type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={newDoctor.licenseNumber} onChange={(e) => setNewDoctor({ ...newDoctor, licenseNumber: e.target.value })} placeholder="e.g. DHA-P-12345" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">License Expiry</label>
                                        <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={newDoctor.licenseExpiry} onChange={(e) => setNewDoctor({ ...newDoctor, licenseExpiry: e.target.value })} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Start Date</label>
                                        <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={newDoctor.startDate} onChange={(e) => setNewDoctor({ ...newDoctor, startDate: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">End Date</label>
                                        <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={newDoctor.endDate} onChange={(e) => setNewDoctor({ ...newDoctor, endDate: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Status</label>
                                        <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={newDoctor.status} onChange={(e) => setNewDoctor({ ...newDoctor, status: e.target.value as 'working' | 'not_working' })}>
                                            <option value="working">Working</option>
                                            <option value="not_working">Not Working</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Max Bookings per Slot</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="5"
                                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={newDoctor.maxConcurrentBookings}
                                        onChange={(e) => setNewDoctor({ ...newDoctor, maxConcurrentBookings: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Certifications (Comma separated)</label>
                                    <textarea
                                        placeholder="e.g., Board Certified, MD, PhD"
                                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={newDoctor.certifications}
                                        onChange={(e) => setNewDoctor({ ...newDoctor, certifications: e.target.value })}
                                    />
                                </div>

                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setIsAddModalOpen(false)}
                                        className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                        {submitting ? 'Adding...' : 'Add Doctor'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Edit Doctor Modal */}
                {isEditModalOpen && editingDoctor && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 shadow-xl my-8">
                            <h2 className="text-xl font-bold mb-4">Edit Doctor</h2>
                            <form onSubmit={handleUpdateDoctor} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Name</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={editingDoctor.name}
                                        onChange={(e) => setEditingDoctor({ ...editingDoctor, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Specialty</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={editingDoctor.specialty}
                                        onChange={(e) => setEditingDoctor({ ...editingDoctor, specialty: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Image URL</label>
                                    <input
                                        type="url"
                                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={editingDoctor.image}
                                        onChange={(e) => setEditingDoctor({ ...editingDoctor, image: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">License Number</label>
                                        <input type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingDoctor.licenseNumber || ''} onChange={(e) => setEditingDoctor({ ...editingDoctor, licenseNumber: e.target.value || undefined })} placeholder="e.g. DHA-P-12345" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">License Expiry</label>
                                        <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingDoctor.licenseExpiry || ''} onChange={(e) => setEditingDoctor({ ...editingDoctor, licenseExpiry: e.target.value || undefined })} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Start Date</label>
                                        <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingDoctor.startDate || ''} onChange={(e) => setEditingDoctor({ ...editingDoctor, startDate: e.target.value || undefined })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">End Date</label>
                                        <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingDoctor.endDate || ''} onChange={(e) => setEditingDoctor({ ...editingDoctor, endDate: e.target.value || undefined })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Status</label>
                                        <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingDoctor.status || 'working'} onChange={(e) => setEditingDoctor({ ...editingDoctor, status: e.target.value as 'working' | 'not_working' })}>
                                            <option value="working">Working</option>
                                            <option value="not_working">Not Working</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Max Bookings per Slot</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="5"
                                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={editingDoctor.maxConcurrentBookings || 1}
                                        onChange={(e) => setEditingDoctor({ ...editingDoctor, maxConcurrentBookings: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Certifications (Comma separated)</label>
                                    <textarea
                                        placeholder="e.g., Board Certified, MD, PhD"
                                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={Array.isArray(editingDoctor.certifications) ? editingDoctor.certifications.join(', ') : (editingDoctor.certifications || '')}
                                        onChange={(e) => setEditingDoctor({
                                            ...editingDoctor,
                                            certifications: e.target.value.split(',').map(s => s.trim())
                                        })}
                                    />
                                </div>

                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setIsEditModalOpen(false)}
                                        className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                        {submitting ? 'Saving...' : 'Save Changes'}
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

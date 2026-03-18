'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Search, Edit2, MapPin, Stethoscope, ShieldCheck, CalendarClock, CircleDot, GitBranch } from 'lucide-react';
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
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Add Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addClinicIds, setAddClinicIds] = useState<string[]>([]);
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
    const [editClinicIds, setEditClinicIds] = useState<string[]>([]);

    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchDoctors();
    }, []);

    const fetchDoctors = async () => {
        try {
            const res = await fetch('/api/admin/doctors');
            const data = await res.json();
            setClinics(data);
        } catch (error) {
            console.error('Failed to fetch doctors', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddDoctor = async (e: React.FormEvent) => {
        e.preventDefault();
        if (addClinicIds.length === 0) { alert('Please select at least one branch'); return; }
        setSubmitting(true);
        try {
            const sharedId = `doc-${Date.now()}`;
            let allSuccess = true;
            for (const clinicId of addClinicIds) {
                const clinic = clinics.find(c => c.id === clinicId);
                const firstDept = clinic?.departments[0];
                if (!firstDept) continue;

                const payload = {
                    clinicId,
                    departmentId: firstDept.id,
                    id: sharedId,
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
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) allSuccess = false;
            }
            if (allSuccess) {
                await fetchDoctors();
                setIsAddModalOpen(false);
                setNewDoctor({ departmentId: '', name: '', specialty: '', image: '', certifications: '', maxConcurrentBookings: 1, licenseNumber: '', licenseExpiry: '', startDate: '', endDate: '', status: 'working' });
                setAddClinicIds([]);
            } else {
                alert('Failed to add doctor to some branches');
                await fetchDoctors();
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
            const currentBranches = getDoctorBranches(editingDoctor.id);
            const currentClinicIdSet = new Set(currentBranches.map(b => b.clinicId));

            // Add to new branches
            for (const cId of editClinicIds) {
                if (!currentClinicIdSet.has(cId)) {
                    const clinic = clinics.find(c => c.id === cId);
                    const firstDept = clinic?.departments[0];
                    if (!firstDept) continue;
                    await fetch('/api/admin/doctors', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            clinicId: cId, departmentId: firstDept.id,
                            id: editingDoctor.id, name: editingDoctor.name,
                            specialty: editingDoctor.specialty, image: editingDoctor.image,
                            certifications: typeof editingDoctor.certifications === 'string'
                                ? (editingDoctor.certifications as string).split(',').map((c: string) => c.trim()).filter(Boolean)
                                : editingDoctor.certifications,
                            maxConcurrentBookings: Number(editingDoctor.maxConcurrentBookings) || 1,
                            licenseNumber: editingDoctor.licenseNumber || undefined,
                            licenseExpiry: editingDoctor.licenseExpiry || undefined,
                            startDate: editingDoctor.startDate || undefined,
                            endDate: editingDoctor.endDate || undefined,
                            status: editingDoctor.status
                        })
                    });
                }
            }

            // Remove from unchecked branches
            for (const b of currentBranches) {
                if (!editClinicIds.includes(b.clinicId)) {
                    await fetch(`/api/admin/doctors?clinicId=${encodeURIComponent(b.clinicId)}&departmentId=${encodeURIComponent(b.departmentId)}&doctorId=${encodeURIComponent(editingDoctor.id)}`, {
                        method: 'DELETE'
                    });
                }
            }

            // Update existing branches
            for (const b of currentBranches) {
                if (editClinicIds.includes(b.clinicId)) {
                    await fetch('/api/admin/doctors', {
                        method: 'PUT', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            clinicId: b.clinicId, departmentId: b.departmentId,
                            doctorId: editingDoctor.id, name: editingDoctor.name,
                            specialty: editingDoctor.specialty, image: editingDoctor.image,
                            certifications: typeof editingDoctor.certifications === 'string'
                                ? (editingDoctor.certifications as string).split(',').map((c: string) => c.trim()).filter(Boolean)
                                : editingDoctor.certifications,
                            maxConcurrentBookings: Number(editingDoctor.maxConcurrentBookings) || 1,
                            licenseNumber: editingDoctor.licenseNumber || undefined,
                            licenseExpiry: editingDoctor.licenseExpiry || undefined,
                            startDate: editingDoctor.startDate || undefined,
                            endDate: editingDoctor.endDate || undefined,
                            status: editingDoctor.status
                        })
                    });
                }
            }

            await fetchDoctors();
            setIsEditModalOpen(false);
            setEditingDoctor(null);
        } catch (error) {
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteDoctor = async (clinicId: string, departmentId: string, doctorId: string) => {
        if (!confirm('Are you sure you want to delete this doctor?')) return;

        try {
            const res = await fetch(`/api/admin/doctors?clinicId=${encodeURIComponent(clinicId)}&departmentId=${encodeURIComponent(departmentId)}&doctorId=${encodeURIComponent(doctorId)}`, {
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

    const openEditModal = (clinicId: string, departmentId: string, doctor: Doctor) => {
        const branches = getDoctorBranches(doctor.id);
        setEditingDoctor({
            ...doctor,
            clinicId,
            departmentId
        } as any);
        setEditClinicIds(branches.map(b => b.clinicId));
        setIsEditModalOpen(true);
    };

    // Flatten all doctors from all clinics/departments
    const allDoctors = clinics.flatMap(clinic =>
        clinic.departments.flatMap(dept =>
            dept.doctors.map(doctor => ({
                ...doctor,
                clinicId: clinic.id,
                clinicName: clinic.name,
                departmentId: dept.id,
                departmentName: dept.name,
            }))
        )
    );

    // Apply search filter
    const filteredDoctors = allDoctors.filter(d =>
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.departmentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.clinicName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // All departments across all clinics (for Add modal) - unique by ID
    const allDepartments = clinics.flatMap(c =>
        c.departments.map(d => ({ clinicId: c.id, clinicName: c.name, deptId: d.id, deptName: d.name }))
    );
    // Unique departments by ID — only show allowed departments for doctors
    const ALLOWED_DOCTOR_DEPTS = [
        'Aesthetic Dermatology',
        'Nursing-Beauty Therapy',
        'Laser Hair Removal',
        'Physiotherapy',
    ];
    const uniqueDepartments = Array.from(new Map(allDepartments.map(d => [d.deptId, d])).values())
        .filter(d => ALLOWED_DOCTOR_DEPTS.some(name => d.deptName.toLowerCase() === name.toLowerCase()));

    // Helper: get all branches a doctor is assigned to (by shared ID)
    const getDoctorBranches = (doctorId: string) => {
        return allDoctors.filter(d => d.id === doctorId).map(d => ({
            clinicId: d.clinicId, clinicName: d.clinicName,
            departmentId: d.departmentId, departmentName: d.departmentName
        }));
    };

    // Deduplicate doctors for display
    const uniqueDoctorIds = new Set<string>();
    const deduplicatedDoctors = filteredDoctors.filter(d => {
        const key = d.id;
        if (uniqueDoctorIds.has(key)) return false;
        uniqueDoctorIds.add(key);
        return true;
    });

    // Helper to check if a department exists in a clinic (by name, since IDs are clinic-prefixed)
    const getDeptName = (deptId: string) => {
        for (const c of clinics) {
            const dept = c.departments.find(d => d.id === deptId);
            if (dept) return dept.name;
        }
        return '';
    };
    const clinicHasDept = (clinicId: string, deptId: string) => {
        const name = getDeptName(deptId);
        return clinics.find(c => c.id === clinicId)?.departments.some(d => d.name === name) ?? false;
    };
    const findDeptIdInClinic = (clinicId: string, deptId: string) => {
        const name = getDeptName(deptId);
        return clinics.find(c => c.id === clinicId)?.departments.find(d => d.name === name)?.id || deptId;
    };

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
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Search Doctors</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name, specialty, department, or branch..."
                                className="w-full pl-10 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">{filteredDoctors.length} doctor{filteredDoctors.length !== 1 ? 's' : ''} across all branches</p>
                </div>

                {/* Doctors Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {deduplicatedDoctors.map(doctor => {
                        const branches = getDoctorBranches(doctor.id);
                        const isMultiBranch = branches.length > 1;
                        return (
                        <div key={`${doctor.clinicId}-${doctor.departmentId}-${doctor.id}`} className={`bg-white dark:bg-gray-800 flex flex-col items-center p-6 border rounded-xl shadow-sm hover:shadow-md transition-all group relative ${doctor.status === 'not_working' ? 'border-red-200 dark:border-red-800 opacity-60' : 'border-gray-100 dark:border-gray-700'}`}>
                            {/* Status badge */}
                            <div className="absolute top-3 right-3">
                                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${doctor.status === 'not_working' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
                                    <CircleDot className="w-2.5 h-2.5" />
                                    {doctor.status === 'not_working' ? 'Not Working' : 'Working'}
                                </span>
                            </div>

                            {/* Branch badges — show ALL branches this doctor is assigned to */}
                            <div className="absolute top-3 left-3 flex flex-col gap-1">
                                {branches.map((b, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300">
                                        <MapPin className="w-2.5 h-2.5" /> {b.clinicName.replace(' Branch', '')} — {b.departmentName}
                                    </span>
                                ))}
                                {isMultiBranch && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300">
                                        <GitBranch className="w-2.5 h-2.5" /> Multi-Branch
                                    </span>
                                )}
                            </div>

                            <div className={`w-24 h-24 bg-gray-200 rounded-full overflow-hidden mb-4 ${branches.length > 2 ? 'mt-14' : branches.length > 1 ? 'mt-10' : 'mt-6'}`}>
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
                                    onClick={() => openEditModal(doctor.clinicId, doctor.departmentId, doctor)}
                                    className="flex-1 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => {
                                        const branches = getDoctorBranches(doctor.id);
                                        if (!confirm(`Remove ${doctor.name} from all ${branches.length} branch(es)?`)) return;
                                        branches.forEach(b => handleDeleteDoctor(b.clinicId, b.departmentId, doctor.id));
                                    }}
                                    className="py-2 px-3 text-sm font-medium text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        );
                    })}
                </div>

                {filteredDoctors.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        No doctors found matching your criteria.
                    </div>
                )}

                {/* Add Doctor Modal */}
                {isAddModalOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 shadow-xl my-8">
                            <h2 className="text-xl font-bold mb-4">Add New Doctor</h2>
                            <form onSubmit={handleAddDoctor} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Branches</label>
                                    <div className="flex flex-wrap gap-3">
                                        {clinics.map(c => (
                                            <label key={c.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${addClinicIds.includes(c.id) ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                                                <input
                                                    type="checkbox"
                                                    className="accent-indigo-600"
                                                    checked={addClinicIds.includes(c.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setAddClinicIds([...addClinicIds, c.id]);
                                                        else setAddClinicIds(addClinicIds.filter(id => id !== c.id));
                                                    }}
                                                />
                                                <span className="text-sm font-medium">{c.name}</span>
                                            </label>
                                        ))}
                                    </div>
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
                                    <label className="block text-sm font-medium mb-2">Branches</label>
                                    <div className="flex flex-wrap gap-3">
                                        {clinics.map(c => (
                                            <label key={c.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${editClinicIds.includes(c.id) ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                                                <input
                                                    type="checkbox"
                                                    className="accent-indigo-600"
                                                    checked={editClinicIds.includes(c.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setEditClinicIds([...editClinicIds, c.id]);
                                                        else setEditClinicIds(editClinicIds.filter(id => id !== c.id));
                                                    }}
                                                />
                                                <span className="text-sm font-medium">{c.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">Schedule is shared across all branches — no conflicts</p>
                                </div>
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

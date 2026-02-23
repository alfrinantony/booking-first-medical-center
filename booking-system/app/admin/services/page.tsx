'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Search, Clock, Edit2, UserCheck, Users, Users2, Calendar, Clock4, Archive, Pill } from 'lucide-react';
import { Clinic, Department, Service, ServiceAddOn, Doctor, Resource, Medicine } from '@/lib/data';

interface ServiceFormState {
    departmentId: string;
    name: string;
    price: string | number;
    duration: string | number;
    allowedDoctorIds: string[];
    allowedGender: 'male' | 'female' | 'both';
    allowedDays: number[];
    timeWindowStart: string;
    timeWindowEnd: string;
    isTaxable: boolean;
    category: string;
    followUpDuration: string;
    screeningQuestions: string[];
    requiredResourceIds: string[];
    maxMedicines: string;
    medicineIds: string[];
    medicineSelectionMode: 'choose' | 'either' | 'all';
    consumableIds: string[];
    addOns: ServiceAddOn[];
}

export default function ServicesPage() {
    const [clinics, setClinics] = useState<Clinic[]>([]);
    const [selectedClinicId, setSelectedClinicId] = useState('');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Add Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newService, setNewService] = useState<ServiceFormState>({
        departmentId: '',
        name: '',
        price: '',
        duration: '30',
        allowedDoctorIds: [],
        allowedGender: 'both',
        allowedDays: [],
        timeWindowStart: '',
        timeWindowEnd: '',
        isTaxable: false,
        category: '',
        followUpDuration: '',
        screeningQuestions: [],
        requiredResourceIds: [],
        maxMedicines: '',
        medicineIds: [],
        medicineSelectionMode: 'choose',
        consumableIds: [],
        addOns: []
    });

    const [resources, setResources] = useState<Resource[]>([]);
    const [medicines, setMedicines] = useState<Medicine[]>([]);

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingService, setEditingService] = useState<Service & { departmentId: string } & { timeWindowStart?: string, timeWindowEnd?: string, followUpDurationInput?: string } | null>(null);

    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchServices();
    }, []);

    const fetchServices = async () => {
        try {
            const res = await fetch('/api/admin/services');
            const data = await res.json();
            setClinics(data);
            if (data.length > 0 && !selectedClinicId) {
                setSelectedClinicId(data[0].id);
            }
        } catch (error) {
            console.error('Failed to fetch services', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchResources = async (clinicId: string) => {
        try {
            const res = await fetch(`/api/admin/resources?clinicId=${clinicId}`);
            const data = await res.json();
            setResources(data);
        } catch (error) {
            console.error('Failed to fetch resources', error);
        }
    };

    useEffect(() => {
        if (selectedClinicId) {
            fetchResources(selectedClinicId);
        }
    }, [selectedClinicId]);

    const buildServicePayload = (formState: ServiceFormState | (Service & { departmentId: string; timeWindowStart?: string; timeWindowEnd?: string })) => {
        const payload: any = {
            clinicId: selectedClinicId,
            departmentId: formState.departmentId,
            name: formState.name,
            price: Number(formState.price),
            duration: Number(formState.duration),
            allowedDoctorIds: formState.allowedDoctorIds,
            allowedGender: formState.allowedGender,
            allowedDays: formState.allowedDays,
            requiredResourceIds: formState.requiredResourceIds,
            consumableIds: 'consumableIds' in formState ? (formState as any).consumableIds || [] : []
        };

        if ('serviceId' in formState) { // It's an update (hacky check, better to separate)
            // simplified below
        }

        if (formState.timeWindowStart && formState.timeWindowEnd) {
            payload.timeWindow = {
                start: formState.timeWindowStart,
                end: formState.timeWindowEnd
            };
        } else {
            payload.timeWindow = undefined; // Clear it if not complete
        }

        return payload;
    };


    const handleAddService = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = {
                clinicId: selectedClinicId,
                departmentId: newService.departmentId,
                name: newService.name,
                price: Number(newService.price),
                duration: Number(newService.duration),
                allowedDoctorIds: newService.allowedDoctorIds,
                allowedGender: newService.allowedGender,
                allowedDays: newService.allowedDays,
                isTaxable: newService.isTaxable,
                category: newService.category,
                followUpDuration: newService.followUpDuration,
                screeningQuestions: newService.screeningQuestions,
                timeWindow: (newService.timeWindowStart && newService.timeWindowEnd) ? {
                    start: newService.timeWindowStart,
                    end: newService.timeWindowEnd
                } : undefined,
                requiredResourceIds: newService.requiredResourceIds,
                maxMedicines: newService.maxMedicines ? Number(newService.maxMedicines) : undefined,
                medicineIds: newService.medicineIds,
                medicineSelectionMode: newService.medicineIds.length > 0 ? newService.medicineSelectionMode : undefined,
                consumableIds: newService.consumableIds,
                addOns: newService.addOns
            };

            const res = await fetch('/api/admin/services', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                await fetchServices();
                setIsAddModalOpen(false);
                setNewService({ departmentId: '', name: '', price: '', duration: '30', allowedDoctorIds: [], allowedGender: 'both', allowedDays: [], timeWindowStart: '', timeWindowEnd: '', isTaxable: false, category: '', followUpDuration: '', screeningQuestions: [], requiredResourceIds: [], maxMedicines: '', medicineIds: [], medicineSelectionMode: 'choose', consumableIds: [], addOns: [] });
            } else {
                alert('Failed to add service');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateService = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingService) return;
        setSubmitting(true);
        try {
            const payload = {
                clinicId: selectedClinicId,
                departmentId: editingService.departmentId,
                serviceId: editingService.id,
                name: editingService.name,
                price: Number(editingService.price),
                duration: Number(editingService.duration),
                allowedDoctorIds: editingService.allowedDoctorIds,
                allowedGender: editingService.allowedGender,
                allowedDays: editingService.allowedDays,
                isTaxable: editingService.isTaxable,
                category: editingService.category,
                followUpDuration: editingService.followUpDurationInput ? Number(editingService.followUpDurationInput) : undefined,
                screeningQuestions: editingService.screeningQuestions,
                timeWindow: (editingService.timeWindowStart && editingService.timeWindowEnd) ? {
                    start: editingService.timeWindowStart,
                    end: editingService.timeWindowEnd
                } : undefined,
                requiredResourceIds: editingService.requiredResourceIds,
                maxMedicines: editingService.maxMedicines,
                medicineIds: editingService.medicineIds || [],
                medicineSelectionMode: (editingService.medicineIds || []).length > 0 ? editingService.medicineSelectionMode : undefined,
                consumableIds: editingService.consumableIds || [],
                addOns: editingService.addOns || []
            };

            const res = await fetch('/api/admin/services', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                await fetchServices();
                setIsEditModalOpen(false);
                setEditingService(null);
            } else {
                alert('Failed to update service');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteService = async (departmentId: string, serviceId: string) => {
        if (!confirm('Are you sure you want to delete this service?')) return;

        try {
            const res = await fetch(`/api/admin/services?clinicId=${selectedClinicId}&departmentId=${departmentId}&serviceId=${serviceId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                await fetchServices();
            } else {
                alert('Failed to delete service');
            }
        } catch (error) {
            console.error(error);
        }
    };

    const openEditModal = (departmentId: string, service: Service) => {
        setEditingService({
            ...service,
            departmentId,
            timeWindowStart: service.timeWindow?.start || '',
            timeWindowEnd: service.timeWindow?.end || '',
            followUpDurationInput: service.followUpDuration ? String(service.followUpDuration) : ''
        });
        setIsEditModalOpen(true);
    };

    // Fetch medicines for consumable selection
    useEffect(() => {
        fetch('/api/admin/medicines').then(r => r.json()).then(data => {
            if (Array.isArray(data)) setMedicines(data);
        }).catch(() => { });
    }, []);

    // Helper to get allowed doctors count text
    const getAllowedDoctorsText = (service: Service, deptDoctors: Doctor[]) => {
        if (!service.allowedDoctorIds || service.allowedDoctorIds.length === 0) {
            return 'All Doctors';
        }
        return `${service.allowedDoctorIds.length} / ${deptDoctors.length} Doctors`;
    };

    const getGenderText = (gender?: 'male' | 'female' | 'both') => {
        if (gender === 'male') return 'Male Only';
        if (gender === 'female') return 'Female Only';
        return 'All Genders';
    };

    const getDaysText = (days?: number[]) => {
        if (!days || days.length === 0) return 'Every Day';
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days.map(d => dayNames[d]).join(', ');
    };

    const getTimeWindowText = (window?: { start: string, end: string }) => {
        if (!window) return 'All Day';
        return `${window.start} - ${window.end}`;
    };

    const toggleDaySelection = (day: number, isEditing: boolean) => {
        if (isEditing && editingService) {
            const currentDays = editingService.allowedDays || [];
            const newDays = currentDays.includes(day)
                ? currentDays.filter(d => d !== day)
                : [...currentDays, day].sort();
            setEditingService({ ...editingService, allowedDays: newDays });
        } else {
            const currentDays = newService.allowedDays || [];
            const newDays = currentDays.includes(day)
                ? currentDays.filter(d => d !== day)
                : [...currentDays, day].sort();
            setNewService({ ...newService, allowedDays: newDays });
        }
    };

    // Filter Logic
    const currentClinic = clinics.find(c => c.id === selectedClinicId);

    // Derived departments with filtered services
    const filteredDepartments = currentClinic?.departments.map(dept => ({
        ...dept,
        services: dept.services.filter(s =>
            s.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
    })).filter(dept => dept.services.length > 0) || [];

    // Helpers to get doctors for a department
    const getDepartmentDoctors = (deptId: string) => {
        return currentClinic?.departments.find(d => d.id === deptId)?.doctors || [];
    };

    const toggleDoctorSelection = (docId: string, isEditing: boolean) => {
        if (isEditing && editingService) {
            const currentIds = editingService.allowedDoctorIds || [];
            const newIds = currentIds.includes(docId)
                ? currentIds.filter(id => id !== docId)
                : [...currentIds, docId];
            setEditingService({ ...editingService, allowedDoctorIds: newIds });
        } else {
            const currentIds = newService.allowedDoctorIds || [];
            const newIds = currentIds.includes(docId)
                ? currentIds.filter(id => id !== docId)
                : [...currentIds, docId];
            setNewService({ ...newService, allowedDoctorIds: newIds });
        }
    };

    if (loading) return <div className="p-8">Loading services...</div>;

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-6xl mx-auto">
                <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Service Management</h1>
                        <p className="text-gray-600 dark:text-gray-400">Manage services, pricing, durations, and restrictions.</p>
                    </div>

                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add New Service
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
                        <div className="mt-2 text-xs text-gray-500">
                            Resources available: {resources.length}
                        </div>
                    </div>
                    <div className="md:w-2/3">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Search Services</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name..."
                                className="w-full pl-10 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Service List */}
                <div className="space-y-6">
                    {filteredDepartments.map(dept => (
                        <div key={dept.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                            <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{dept.name}</h2>
                            </div>
                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                {dept.services.map(service => (
                                    <div key={service.id} className="p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                                        <div className="flex-1">
                                            <h3 className="font-medium text-gray-900 dark:text-white mb-1">{service.name}</h3>
                                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {service.duration} mins
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <span className="text-xs font-semibold">د.إ</span>
                                                    {service.price} AED {service.isTaxable && <span className="text-xs text-orange-600 bg-orange-100 dark:bg-orange-900/30 px-1 rounded">+VAT</span>}
                                                </span>
                                                {service.category && (
                                                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs text-gray-600 dark:text-gray-300">
                                                        {service.category}
                                                    </span>
                                                )}
                                                {service.followUpDuration && (
                                                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        Free Follow Up within {service.followUpDuration}d
                                                    </span>
                                                )}
                                                <span className="flex items-center gap-1" title="Allowed Doctors">
                                                    <Users className="w-3.5 h-3.5" />
                                                    {getAllowedDoctorsText(service, dept.doctors)}
                                                </span>
                                                <span className="flex items-center gap-1" title="Gender Restriction">
                                                    <Users2 className="w-3.5 h-3.5" />
                                                    {getGenderText(service.allowedGender)}
                                                </span>
                                                <span className="flex items-center gap-1" title="Day Restriction">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    {getDaysText(service.allowedDays)}
                                                </span>
                                                <span className="flex items-center gap-1" title="Time Restriction">
                                                    <Clock4 className="w-3.5 h-3.5" />
                                                    {getTimeWindowText(service.timeWindow)}
                                                </span>
                                                {service.requiredResourceIds && service.requiredResourceIds.length > 0 && (
                                                    <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400" title="Required Resources">
                                                        <Archive className="w-3.5 h-3.5" />
                                                        {service.requiredResourceIds.length} Resources
                                                    </span>
                                                )}
                                                {service.maxMedicines !== undefined && service.maxMedicines > 0 && (
                                                    <span className="flex items-center gap-1 text-teal-600 dark:text-teal-400" title="Max Medicines">
                                                        <Pill className="w-3.5 h-3.5" />
                                                        Up to {service.maxMedicines} Medicine{service.maxMedicines > 1 ? 's' : ''}
                                                    </span>
                                                )}
                                            </div>
                                            {/* Add-on badges */}
                                            {service.addOns && service.addOns.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                    {service.addOns.map(ao => (
                                                        <span key={ao.id} className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400 border border-violet-200 dark:border-violet-800">
                                                            🔧 {ao.procedure} · {ao.area} · +{ao.price} AED
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 ml-4">
                                            <button
                                                onClick={() => openEditModal(dept.id, service)}
                                                className="text-indigo-500 hover:text-indigo-700 p-2 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                                                title="Edit Service"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteService(dept.id, service.id)}
                                                className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                title="Delete Service"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {filteredDepartments.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            No services found matching your criteria.
                        </div>
                    )}
                </div>

                {/* Add Service Modal */}
                {isAddModalOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full p-6 shadow-xl my-8">
                            <h2 className="text-xl font-bold mb-4">Add New Service</h2>
                            <form onSubmit={handleAddService} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Department</label>
                                        <select
                                            required
                                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={newService.departmentId}
                                            onChange={(e) => setNewService({ ...newService, departmentId: e.target.value, allowedDoctorIds: [] })}
                                        >
                                            <option value="">Select Department</option>
                                            {currentClinic?.departments.map(d => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Service Name</label>
                                        <input
                                            required
                                            type="text"
                                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={newService.name}
                                            onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Price ($)</label>
                                        <input
                                            required
                                            type="number"
                                            min="0"
                                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={newService.price}
                                            onChange={(e) => setNewService({ ...newService, price: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Category</label>
                                        <input
                                            type="text"
                                            list="categories"
                                            placeholder="e.g., Consultation, Procedure"
                                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={newService.category}
                                            onChange={(e) => setNewService({ ...newService, category: e.target.value })}
                                        />
                                        <datalist id="categories">
                                            <option value="Consultation" />
                                            <option value="Procedure" />
                                            <option value="Follow-up" />
                                            <option value="Therapy" />
                                        </datalist>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Duration (min)</label>
                                        <input
                                            required
                                            type="number"
                                            step="15"
                                            min="15"
                                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={newService.duration}
                                            onChange={(e) => setNewService({ ...newService, duration: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Free Follow Up within (Days)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder="Optional"
                                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={newService.followUpDuration}
                                            onChange={(e) => setNewService({ ...newService, followUpDuration: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Medicine Selection Mode</label>
                                        <select
                                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={newService.medicineSelectionMode}
                                            onChange={(e) => setNewService({ ...newService, medicineSelectionMode: e.target.value as 'choose' | 'either' | 'all' })}
                                        >
                                            <option value="choose">Choose up to N</option>
                                            <option value="either">Pick exactly 1</option>
                                            <option value="all">All required</option>
                                        </select>
                                    </div>
                                    {newService.medicineSelectionMode === 'choose' && (
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Max Medicines</label>
                                            <input
                                                type="number" min="0" placeholder="0 = none"
                                                className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                                value={newService.maxMedicines}
                                                onChange={(e) => setNewService({ ...newService, maxMedicines: e.target.value })}
                                            />
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Allowed Gender</label>
                                        <select
                                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={newService.allowedGender || 'both'}
                                            onChange={(e) => setNewService({ ...newService, allowedGender: e.target.value as 'male' | 'female' | 'both' })}
                                        >
                                            <option value="both">Both (All Genders)</option>
                                            <option value="male">Male Only</option>
                                            <option value="female">Female Only</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="flex items-center gap-2 mt-4 cursor-pointer p-3 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                            checked={newService.isTaxable}
                                            onChange={(e) => setNewService({ ...newService, isTaxable: e.target.checked })}
                                        />
                                        <span className="text-sm font-medium">Taxable Service ({currentClinic?.vatPercentage}% VAT)</span>
                                    </label>
                                </div>

                                {/* Day Restriction */}
                                <div>
                                    <label className="block text-sm font-medium mb-2">Allowed Days (Check to allow)</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {dayNames.map((day, idx) => (
                                            <button
                                                key={day}
                                                type="button"
                                                onClick={() => toggleDaySelection(idx, false)}
                                                className={`px-3 py-1 rounded-full text-sm border transiton-colors ${(newService.allowedDays && newService.allowedDays.includes(idx))
                                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                    }`}
                                            >
                                                {day}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">If none selected, all days are allowed.</p>
                                </div>

                                {/* Time Restriction */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Start Time (Optional)</label>
                                        <input
                                            type="time"
                                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={newService.timeWindowStart}
                                            onChange={(e) => setNewService({ ...newService, timeWindowStart: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">End Time (Optional)</label>
                                        <input
                                            type="time"
                                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={newService.timeWindowEnd}
                                            onChange={(e) => setNewService({ ...newService, timeWindowEnd: e.target.value })}
                                        />
                                    </div>
                                </div>


                                {/* Doctor Selection */}
                                {newService.departmentId && (
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Allowed Doctors</label>
                                        <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                                            {getDepartmentDoctors(newService.departmentId).map(doc => (
                                                <label key={doc.id} className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={(newService.allowedDoctorIds || []).includes(doc.id)}
                                                        onChange={() => toggleDoctorSelection(doc.id, false)}
                                                        className="rounded text-indigo-600"
                                                    />
                                                    <span className="text-sm">{doc.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">Leave unchecked to allow all doctors.</p>
                                    </div>
                                )}

                                {/* Screening Questions */}
                                <div>
                                    <label className="block text-sm font-medium mb-2">Screening Questions (YES = Blocked)</label>
                                    <div className="space-y-2 mb-2">
                                        {newService.screeningQuestions.map((q, idx) => (
                                            <div key={idx} className="flex gap-2">
                                                <input
                                                    type="text"
                                                    className="flex-1 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                                    value={q}
                                                    onChange={(e) => {
                                                        const newQs = [...newService.screeningQuestions];
                                                        newQs[idx] = e.target.value;
                                                        setNewService({ ...newService, screeningQuestions: newQs });
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newQs = newService.screeningQuestions.filter((_, i) => i !== idx);
                                                        setNewService({ ...newService, screeningQuestions: newQs });
                                                    }}
                                                    className="text-red-500 hover:text-red-700 font-bold px-2"
                                                >
                                                    X
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setNewService({ ...newService, screeningQuestions: [...newService.screeningQuestions, ''] })}
                                        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                                    >
                                        + Add Question
                                    </button>
                                </div>

                                {/* Resource Requirements */}
                                <div>
                                    <label className="block text-sm font-medium mb-2">Required Resources (Check to require)</label>
                                    <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                                        {resources.map(res => (
                                            <label key={res.id} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={(newService.requiredResourceIds || []).includes(res.id)}
                                                    onChange={(e) => {
                                                        const current = newService.requiredResourceIds || [];
                                                        const next = e.target.checked
                                                            ? [...current, res.id]
                                                            : current.filter(id => id !== res.id);
                                                        setNewService({ ...newService, requiredResourceIds: next });
                                                    }}
                                                    className="rounded text-indigo-600"
                                                />
                                                <span className="text-sm">{res.name} ({res.type})</span>
                                            </label>
                                        ))}
                                        {resources.length === 0 && <p className="text-xs text-gray-500">No resources found for this clinic.</p>}
                                    </div>
                                </div>

                                {/* Linked Medicines */}
                                <div>
                                    <label className="block text-sm font-medium mb-2">Linked Medicines</label>
                                    <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                                        {medicines.filter(m => m.category !== 'consumable').map(med => (
                                            <label key={med.id} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={(newService.medicineIds || []).includes(med.id)}
                                                    onChange={(e) => {
                                                        const current = newService.medicineIds || [];
                                                        const next = e.target.checked
                                                            ? [...current, med.id]
                                                            : current.filter(id => id !== med.id);
                                                        setNewService({ ...newService, medicineIds: next });
                                                    }}
                                                    className="rounded text-teal-600"
                                                />
                                                <span className="text-sm">{med.name}</span>
                                                <span className="text-xs text-gray-400 ml-auto">{med.price} AED</span>
                                            </label>
                                        ))}
                                        {medicines.filter(m => m.category !== 'consumable').length === 0 && <p className="text-xs text-gray-500">No medicines found.</p>}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Customer will pick from these based on selection mode above.</p>
                                </div>

                                {/* Linked Consumables */}
                                <div>
                                    <label className="block text-sm font-medium mb-2">Linked Consumables (auto-deducted)</label>
                                    <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                                        {medicines.filter(m => m.category === 'consumable').map(med => (
                                            <label key={med.id} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={(newService.consumableIds || []).includes(med.id)}
                                                    onChange={(e) => {
                                                        const current = newService.consumableIds || [];
                                                        const next = e.target.checked
                                                            ? [...current, med.id]
                                                            : current.filter(id => id !== med.id);
                                                        setNewService({ ...newService, consumableIds: next });
                                                    }}
                                                    className="rounded text-orange-600"
                                                />
                                                <span className="text-sm">{med.name}</span>
                                            </label>
                                        ))}
                                        {medicines.filter(m => m.category === 'consumable').length === 0 && <p className="text-xs text-gray-500">No consumables found. Add items with category &apos;consumable&apos; in Inventory.</p>}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">These are used per procedure and auto-deducted from branch stock.</p>
                                </div>

                                {/* Service Add-ons */}
                                <div>
                                    <label className="block text-sm font-medium mb-2">Service Add-ons (Procedure + Area)</label>
                                    <div className="space-y-2">
                                        {(newService.addOns || []).map((ao, idx) => (
                                            <div key={ao.id} className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/30">
                                                <select className="flex-1 p-1.5 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                                    value={ao.procedure} onChange={e => { const u = [...newService.addOns]; u[idx] = { ...u[idx], procedure: e.target.value }; setNewService({ ...newService, addOns: u }); }}>
                                                    <option value="">Procedure...</option>
                                                    <option value="Shaving">Shaving</option>
                                                    <option value="Microneedling">Microneedling</option>
                                                    <option value="PRP Injection">PRP Injection</option>
                                                    <option value="Mesotherapy">Mesotherapy</option>
                                                    <option value="Chemical Peel">Chemical Peel</option>
                                                    <option value="Laser">Laser</option>
                                                    <option value="Cryotherapy">Cryotherapy</option>
                                                </select>
                                                <select className="flex-1 p-1.5 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                                    value={ao.area} onChange={e => { const u = [...newService.addOns]; u[idx] = { ...u[idx], area: e.target.value }; setNewService({ ...newService, addOns: u }); }}>
                                                    <option value="">Area...</option>
                                                    <option value="Face">Face</option>
                                                    <option value="Neck">Neck</option>
                                                    <option value="Hair">Hair</option>
                                                    <option value="Scalp">Scalp</option>
                                                    <option value="Under Eyes">Under Eyes</option>
                                                    <option value="Full Body">Full Body</option>
                                                    <option value="Hands">Hands</option>
                                                    <option value="Legs">Legs</option>
                                                    <option value="Arms">Arms</option>
                                                    <option value="Back">Back</option>
                                                </select>
                                                <input type="number" min="0" step="0.01" placeholder="Price" className="w-24 p-1.5 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                                    value={ao.price || ''} onChange={e => { const u = [...newService.addOns]; u[idx] = { ...u[idx], price: Number(e.target.value) }; setNewService({ ...newService, addOns: u }); }} />
                                                <button type="button" onClick={() => { const u = newService.addOns.filter((_, i) => i !== idx); setNewService({ ...newService, addOns: u }); }}
                                                    className="text-red-500 hover:text-red-700 font-bold px-1">✕</button>
                                            </div>
                                        ))}
                                    </div>
                                    <button type="button"
                                        onClick={() => setNewService({ ...newService, addOns: [...(newService.addOns || []), { id: `ao-${Date.now()}`, procedure: '', area: '', price: 0 }] })}
                                        className="text-sm text-violet-600 hover:text-violet-800 font-medium mt-2">
                                        + Add Add-on
                                    </button>
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
                                        {submitting ? 'Adding...' : 'Add Service'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                {/* Edit Service Modal */}
                {isEditModalOpen && editingService && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full p-6 shadow-xl my-8">
                            <h2 className="text-xl font-bold mb-4">Edit Service</h2>
                            <form onSubmit={handleUpdateService} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Service Name</label>
                                        <input
                                            required
                                            type="text"
                                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingService.name}
                                            onChange={(e) => setEditingService({ ...editingService, name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Price ($)</label>
                                        <input
                                            required
                                            type="number"
                                            min="0"
                                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingService.price}
                                            onChange={(e) => setEditingService({ ...editingService, price: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Category</label>
                                        <input
                                            type="text"
                                            list="edit-categories"
                                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingService.category || ''}
                                            onChange={(e) => setEditingService({ ...editingService, category: e.target.value })}
                                        />
                                        <datalist id="edit-categories">
                                            <option value="Consultation" />
                                            <option value="Procedure" />
                                            <option value="Follow-up" />
                                            <option value="Therapy" />
                                        </datalist>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Duration (min)</label>
                                        <input
                                            required
                                            type="number"
                                            step="15"
                                            min="15"
                                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingService.duration}
                                            onChange={(e) => setEditingService({ ...editingService, duration: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Free Follow Up within (Days)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder="Optional"
                                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingService.followUpDurationInput || ''}
                                            onChange={(e) => setEditingService({ ...editingService, followUpDurationInput: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Medicine Selection Mode</label>
                                        <select
                                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingService.medicineSelectionMode || 'choose'}
                                            onChange={(e) => setEditingService({ ...editingService, medicineSelectionMode: e.target.value as 'choose' | 'either' | 'all' })}
                                        >
                                            <option value="choose">Choose up to N</option>
                                            <option value="either">Pick exactly 1</option>
                                            <option value="all">All required</option>
                                        </select>
                                    </div>
                                    {(!editingService.medicineSelectionMode || editingService.medicineSelectionMode === 'choose') && (
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Max Medicines</label>
                                            <input
                                                type="number" min="0" placeholder="0 = none"
                                                className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                                value={editingService.maxMedicines !== undefined ? editingService.maxMedicines : ''}
                                                onChange={(e) => setEditingService({ ...editingService, maxMedicines: e.target.value ? Number(e.target.value) : undefined } as any)}
                                            />
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Allowed Gender</label>
                                        <select
                                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingService.allowedGender || 'both'}
                                            onChange={(e) => setEditingService({ ...editingService, allowedGender: e.target.value as 'male' | 'female' | 'both' })}
                                        >
                                            <option value="both">Both (All Genders)</option>
                                            <option value="male">Male Only</option>
                                            <option value="female">Female Only</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="flex items-center gap-2 mt-4 cursor-pointer p-3 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                            checked={editingService.isTaxable || false}
                                            onChange={(e) => setEditingService({ ...editingService, isTaxable: e.target.checked })}
                                        />
                                        <span className="text-sm font-medium">Taxable Service ({currentClinic?.vatPercentage}% VAT)</span>
                                    </label>
                                </div>

                                {/* Day Restriction */}
                                <div>
                                    <label className="block text-sm font-medium mb-2">Allowed Days (Check to allow)</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {dayNames.map((day, idx) => (
                                            <button
                                                key={day}
                                                type="button"
                                                onClick={() => toggleDaySelection(idx, true)}
                                                className={`px-3 py-1 rounded-full text-sm border transiton-colors ${(editingService.allowedDays && editingService.allowedDays.includes(idx))
                                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                    }`}
                                            >
                                                {day}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">If none selected, all days are allowed.</p>
                                </div>

                                {/* Time Restriction */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Start Time (Optional)</label>
                                        <input
                                            type="time"
                                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingService.timeWindowStart || ''}
                                            onChange={(e) => setEditingService({ ...editingService, timeWindowStart: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">End Time (Optional)</label>
                                        <input
                                            type="time"
                                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingService.timeWindowEnd || ''}
                                            onChange={(e) => setEditingService({ ...editingService, timeWindowEnd: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Doctor Selection */}
                                <div>
                                    <label className="block text-sm font-medium mb-2">Allowed Doctors</label>
                                    <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                                        {getDepartmentDoctors(editingService.departmentId).map(doc => (
                                            <label key={doc.id} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={(editingService.allowedDoctorIds || []).includes(doc.id)}
                                                    onChange={() => toggleDoctorSelection(doc.id, true)}
                                                    className="rounded text-indigo-600"
                                                />
                                                <span className="text-sm">{doc.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Leave unchecked to allow all doctors.</p>
                                </div>

                                {/* Resource Requirements Edit */}
                                <div>
                                    <label className="block text-sm font-medium mb-2">Required Resources</label>
                                    <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                                        {resources.map(res => (
                                            <label key={res.id} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={(editingService.requiredResourceIds || []).includes(res.id)}
                                                    onChange={(e) => {
                                                        const current = editingService.requiredResourceIds || [];
                                                        const next = e.target.checked
                                                            ? [...current, res.id]
                                                            : current.filter(id => id !== res.id);
                                                        setEditingService({ ...editingService, requiredResourceIds: next });
                                                    }}
                                                    className="rounded text-indigo-600"
                                                />
                                                <span className="text-sm">{res.name} ({res.type})</span>
                                            </label>
                                        ))}
                                        {resources.length === 0 && <p className="text-xs text-gray-500">No resources found for this clinic.</p>}
                                    </div>
                                </div>

                                {/* Screening Questions (Edit) */}
                                <div>
                                    <label className="block text-sm font-medium mb-2">Screening Questions (YES = Blocked)</label>
                                    <div className="space-y-2 mb-2">
                                        {(editingService.screeningQuestions || []).map((q, idx) => (
                                            <div key={idx} className="flex gap-2">
                                                <input
                                                    type="text"
                                                    className="flex-1 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                                    value={q}
                                                    onChange={(e) => {
                                                        const newQs = [...(editingService.screeningQuestions || [])];
                                                        newQs[idx] = e.target.value;
                                                        setEditingService({ ...editingService, screeningQuestions: newQs });
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newQs = (editingService.screeningQuestions || []).filter((_, i) => i !== idx);
                                                        setEditingService({ ...editingService, screeningQuestions: newQs });
                                                    }}
                                                    className="text-red-500 hover:text-red-700 font-bold px-2"
                                                >
                                                    X
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setEditingService({ ...editingService, screeningQuestions: [...(editingService.screeningQuestions || []), ''] })}
                                        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                                    >
                                        + Add Question
                                    </button>
                                </div>


                                {/* Linked Medicines (Edit) */}
                                <div>
                                    <label className="block text-sm font-medium mb-2">Linked Medicines</label>
                                    <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                                        {medicines.filter(m => m.category !== 'consumable').map(med => (
                                            <label key={med.id} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={(editingService.medicineIds || []).includes(med.id)}
                                                    onChange={(e) => {
                                                        const current = editingService.medicineIds || [];
                                                        const next = e.target.checked
                                                            ? [...current, med.id]
                                                            : current.filter(id => id !== med.id);
                                                        setEditingService({ ...editingService, medicineIds: next });
                                                    }}
                                                    className="rounded text-teal-600"
                                                />
                                                <span className="text-sm">{med.name}</span>
                                                <span className="text-xs text-gray-400 ml-auto">{med.price} AED</span>
                                            </label>
                                        ))}
                                        {medicines.filter(m => m.category !== 'consumable').length === 0 && <p className="text-xs text-gray-500">No medicines found.</p>}
                                    </div>
                                </div>

                                {/* Linked Consumables (Edit) */}
                                <div>
                                    <label className="block text-sm font-medium mb-2">Linked Consumables (auto-deducted)</label>
                                    <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                                        {medicines.filter(m => m.category === 'consumable').map(med => (
                                            <label key={med.id} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={(editingService.consumableIds || []).includes(med.id)}
                                                    onChange={(e) => {
                                                        const current = editingService.consumableIds || [];
                                                        const next = e.target.checked
                                                            ? [...current, med.id]
                                                            : current.filter(id => id !== med.id);
                                                        setEditingService({ ...editingService, consumableIds: next });
                                                    }}
                                                    className="rounded text-orange-600"
                                                />
                                                <span className="text-sm">{med.name}</span>
                                            </label>
                                        ))}
                                        {medicines.filter(m => m.category === 'consumable').length === 0 && <p className="text-xs text-gray-500">No consumables found.</p>}
                                    </div>
                                </div>

                                {/* Service Add-ons */}
                                <div>
                                    <label className="block text-sm font-medium mb-2">Service Add-ons (Procedure + Area)</label>
                                    <div className="space-y-2">
                                        {(editingService.addOns || []).map((ao: ServiceAddOn, idx: number) => (
                                            <div key={ao.id} className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/30">
                                                <select className="flex-1 p-1.5 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                                    value={ao.procedure} onChange={e => { const u = [...(editingService.addOns || [])]; u[idx] = { ...u[idx], procedure: e.target.value }; setEditingService({ ...editingService, addOns: u }); }}>
                                                    <option value="">Procedure...</option>
                                                    <option value="Shaving">Shaving</option>
                                                    <option value="Microneedling">Microneedling</option>
                                                    <option value="PRP Injection">PRP Injection</option>
                                                    <option value="Mesotherapy">Mesotherapy</option>
                                                    <option value="Chemical Peel">Chemical Peel</option>
                                                    <option value="Laser">Laser</option>
                                                    <option value="Cryotherapy">Cryotherapy</option>
                                                </select>
                                                <select className="flex-1 p-1.5 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                                    value={ao.area} onChange={e => { const u = [...(editingService.addOns || [])]; u[idx] = { ...u[idx], area: e.target.value }; setEditingService({ ...editingService, addOns: u }); }}>
                                                    <option value="">Area...</option>
                                                    <option value="Face">Face</option>
                                                    <option value="Neck">Neck</option>
                                                    <option value="Hair">Hair</option>
                                                    <option value="Scalp">Scalp</option>
                                                    <option value="Under Eyes">Under Eyes</option>
                                                    <option value="Full Body">Full Body</option>
                                                    <option value="Hands">Hands</option>
                                                    <option value="Legs">Legs</option>
                                                    <option value="Arms">Arms</option>
                                                    <option value="Back">Back</option>
                                                </select>
                                                <input type="number" min="0" step="0.01" placeholder="Price" className="w-24 p-1.5 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                                    value={ao.price || ''} onChange={e => { const u = [...(editingService.addOns || [])]; u[idx] = { ...u[idx], price: Number(e.target.value) }; setEditingService({ ...editingService, addOns: u }); }} />
                                                <button type="button" onClick={() => { const u = (editingService.addOns || []).filter((_: any, i: number) => i !== idx); setEditingService({ ...editingService, addOns: u }); }}
                                                    className="text-red-500 hover:text-red-700 font-bold px-1">✕</button>
                                            </div>
                                        ))}
                                    </div>
                                    <button type="button"
                                        onClick={() => setEditingService({ ...editingService, addOns: [...(editingService.addOns || []), { id: `ao-${Date.now()}`, procedure: '', area: '', price: 0 }] })}
                                        className="text-sm text-violet-600 hover:text-violet-800 font-medium mt-2">
                                        + Add Add-on
                                    </button>
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

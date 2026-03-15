'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Search, Clock, Edit2, UserCheck, Users, Users2, Calendar, Clock4, Archive, Pill, ImagePlus, FolderOpen, X, Eye, EyeOff } from 'lucide-react';
import { Clinic, Department, Service, ServiceAddOn, ServicePackageTier, Doctor, Resource, Medicine, RegisteredProduct, ProductConsumption } from '@/lib/data';
import ServiceEditorModal from '@/components/ServiceEditorModal';

interface ServiceFormState {
    departmentId: string;
    name: string;
    description: string;
    preCare: string;
    postCare: string;
    price: string | number;
    regularPrice: string | number;
    discountedPrice: string | number;
    threeSessionTotalCost: string | number;
    threeSessionValidity: string | number;
    threeSessionDiscountedPrice: string | number;
    sixSessionTotalCost: string | number;
    sixSessionValidity: string | number;
    sixSessionDiscountedPrice: string | number;
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
    image: string;
    productConsumptions: { registeredProductId: string; quantityPerService: number }[];
}

export default function ServicesPage() {
    const [clinics, setClinics] = useState<Clinic[]>([]);
    const [selectedClinicId, setSelectedClinicId] = useState('');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null);
    const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);

    // Add Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const emptyServiceForm: ServiceFormState = {
        departmentId: '',
        name: '',
        description: '',
        preCare: '',
        postCare: '',
        price: '',
        regularPrice: '',
        discountedPrice: '',
        threeSessionTotalCost: '',
        threeSessionValidity: '',
        threeSessionDiscountedPrice: '',
        sixSessionTotalCost: '',
        sixSessionValidity: '',
        sixSessionDiscountedPrice: '',
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
        addOns: [],
        image: '',
        productConsumptions: [],
    };
    const [newService, setNewService] = useState<ServiceFormState>(emptyServiceForm);

    const [resources, setResources] = useState<Resource[]>([]);
    const [medicines, setMedicines] = useState<Medicine[]>([]);

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingService, setEditingService] = useState<Service & { departmentId: string } & { timeWindowStart?: string, timeWindowEnd?: string, followUpDurationInput?: string } | null>(null);

    const [submitting, setSubmitting] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);

    // Image upload helper
    const uploadImage = async (file: File, type: string, id: string): Promise<string> => {
        setUploadingImage(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', type);
            formData.append('id', id);
            const res = await fetch('/api/admin/images/upload', { method: 'POST', body: formData });
            const data = await res.json();
            return data.url || '';
        } catch {
            return '';
        } finally {
            setUploadingImage(false);
        }
    };

    useEffect(() => {
        fetchServices();
        fetchCategoryImages();
    }, []);

    // Category images state
    const [categoryImages, setCategoryImages] = useState<Record<string, string>>({});
    const [showCategoryPanel, setShowCategoryPanel] = useState(false);

    const fetchCategoryImages = async () => {
        try {
            const res = await fetch('/api/admin/category-images');
            const data = await res.json();
            setCategoryImages(data);
        } catch { }
    };

    const handleCategoryImageUpload = async (category: string, file: File) => {
        const url = await uploadImage(file, 'category', category);
        if (url) {
            await fetch('/api/admin/category-images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category, imageUrl: url })
            });
            setCategoryImages(prev => ({ ...prev, [category]: url }));
        }
    };

    const handleCategoryImageRemove = async (category: string) => {
        await fetch(`/api/admin/category-images?category=${encodeURIComponent(category)}`, { method: 'DELETE' });
        setCategoryImages(prev => {
            const copy = { ...prev };
            delete copy[category];
            return copy;
        });
    };

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
            price: Number(formState.discountedPrice) || Number(formState.regularPrice) || Number(formState.price),
            regularPrice: Number(formState.regularPrice) || undefined,
            discountedPrice: Number(formState.discountedPrice) || undefined,
            duration: Number(formState.duration),
            allowedDoctorIds: formState.allowedDoctorIds,
            allowedGender: formState.allowedGender,
            allowedDays: formState.allowedDays,
            requiredResourceIds: formState.requiredResourceIds,
            consumableIds: 'consumableIds' in formState ? (formState as any).consumableIds || [] : [],
            productConsumptions: 'productConsumptions' in formState ? (formState as any).productConsumptions || [] : []
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
            // Determine which branches to add to
            const branchIds = selectedBranchIds.length > 0 ? selectedBranchIds : [selectedClinicId];

            for (const branchId of branchIds) {
                // Find the matching department in this branch
                const branchClinic = clinics.find(c => c.id === branchId);
                const deptId = newService.departmentId || branchClinic?.departments[0]?.id || '';

                const payload: any = {
                    clinicId: branchId,
                    departmentId: deptId,
                    name: newService.name,
                    description: newService.description,
                    preCare: newService.preCare,
                    postCare: newService.postCare,
                    price: Number(newService.discountedPrice) || Number(newService.regularPrice),
                    regularPrice: newService.regularPrice ? Number(newService.regularPrice) : undefined,
                    discountedPrice: newService.discountedPrice ? Number(newService.discountedPrice) : undefined,
                    threeSessionPackage: newService.threeSessionTotalCost ? {
                        totalCost: Number(newService.threeSessionTotalCost),
                        validity: Number(newService.threeSessionValidity) || 90,
                        discountedPrice: Number(newService.threeSessionDiscountedPrice) || Number(newService.threeSessionTotalCost)
                    } : undefined,
                    sixSessionPackage: newService.sixSessionTotalCost ? {
                        totalCost: Number(newService.sixSessionTotalCost),
                        validity: Number(newService.sixSessionValidity) || 180,
                        discountedPrice: Number(newService.sixSessionDiscountedPrice) || Number(newService.sixSessionTotalCost)
                    } : undefined,
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
                    productConsumptions: newService.productConsumptions.length > 0 ? newService.productConsumptions : undefined,
                    addOns: newService.addOns,
                    image: newService.image || undefined
                };

                const res = await fetch('/api/admin/services', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    const branch = branchClinic?.name || branchId;
                    alert(`Failed to add service to ${branch}`);
                }
            }

            await fetchServices();
            setIsAddModalOpen(false);
            setNewService(emptyServiceForm);
            setSelectedBranchIds([]);
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
            const buildPayload = (clinicId: string, deptId: string, serviceId?: string) => {
                const p: any = {
                    clinicId,
                    departmentId: deptId,
                    ...(serviceId ? { serviceId } : {}),
                    name: editingService.name,
                    description: editingService.description || '',
                    preCare: editingService.preCare || '',
                    postCare: editingService.postCare || '',
                    price: Number(editingService.price),
                    regularPrice: editingService.regularPrice ? Number(editingService.regularPrice) : undefined,
                    discountedPrice: editingService.discountedPrice ? Number(editingService.discountedPrice) : undefined,
                    threeSessionPackage: editingService.threeSessionPackage ? editingService.threeSessionPackage : undefined,
                    sixSessionPackage: editingService.sixSessionPackage ? editingService.sixSessionPackage : undefined,
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
                    productConsumptions: editingService.productConsumptions || [],
                    addOns: editingService.addOns || [],
                    image: editingService.image || undefined
                };
                return p;
            };

            // Update the current branch
            const mainPayload = buildPayload(selectedClinicId, editingService.departmentId, editingService.id);
            const res = await fetch('/api/admin/services', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(mainPayload)
            });

            if (!res.ok) {
                alert('Failed to update service');
            }

            // Apply to additionally selected branches
            const otherBranches = selectedBranchIds.filter(id => id !== selectedClinicId);
            for (const branchId of otherBranches) {
                const branchClinic = clinics.find(c => c.id === branchId);
                if (!branchClinic) continue;

                // Find same-named service in this branch
                let existingServiceId: string | undefined;
                let existingDeptId: string | undefined;
                for (const dept of branchClinic.departments || []) {
                    const found = (dept.services || []).find(s => s.name === editingService.name);
                    if (found) {
                        existingServiceId = found.id;
                        existingDeptId = dept.id;
                        break;
                    }
                }

                if (existingServiceId && existingDeptId) {
                    // Update existing service
                    await fetch('/api/admin/services', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(buildPayload(branchId, existingDeptId, existingServiceId))
                    });
                } else {
                    // Create new service in this branch
                    const deptId = branchClinic.departments?.[0]?.id || '';
                    await fetch('/api/admin/services', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(buildPayload(branchId, deptId))
                    });
                }
            }

            await fetchServices();
            setIsEditModalOpen(false);
            setEditingService(null);
            setSelectedBranchIds([]);
        } catch (error) {
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteService = async (departmentId: string, serviceId: string) => {
        console.log('[DELETE] Attempting delete:', { clinicId: selectedClinicId, departmentId, serviceId });
        try {
            const url = `/api/admin/services?clinicId=${selectedClinicId}&departmentId=${departmentId}&serviceId=${serviceId}`;
            console.log('[DELETE] URL:', url);
            const res = await fetch(url, {
                method: 'DELETE'
            });

            console.log('[DELETE] Response status:', res.status);

            if (res.ok) {
                setDeletingServiceId(null);
                await fetchServices();
            } else {
                const errBody = await res.text();
                console.error('[DELETE] Error body:', errBody);
                alert('Failed to delete service: ' + errBody);
            }
        } catch (error) {
            console.error('[DELETE] Exception:', error);
            alert('Error deleting service');
        }
    };

    const handleToggleVisibility = async (departmentId: string, serviceId: string, currentlyVisible: boolean) => {
        try {
            const res = await fetch('/api/admin/services', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clinicId: selectedClinicId,
                    departmentId,
                    serviceId,
                    isVisible: !currentlyVisible
                })
            });
            if (res.ok) {
                await fetchServices();
            }
        } catch (error) {
            console.error('Failed to toggle visibility', error);
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
    const [registeredProducts, setRegisteredProducts] = useState<RegisteredProduct[]>([]);
    useEffect(() => {
        fetch('/api/admin/medicines').then(r => r.json()).then(data => {
            if (Array.isArray(data)) setMedicines(data);
        }).catch(() => { });
        fetch('/api/admin/registered-products').then(r => r.json()).then(data => {
            if (Array.isArray(data)) setRegisteredProducts(data);
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

    // Derived flat list of all services (no department grouping)
    const allServices = currentClinic?.departments.flatMap(dept =>
        dept.services.map(s => ({ ...s, _deptId: dept.id, _deptName: dept.name }))
    ).filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())) || [];

    // Helpers to get doctors for services – collects ALL doctors from ALL branches/departments
    const getDepartmentDoctors = (deptId: string): Doctor[] => {
        // Collect doctors from every clinic and every department
        const seen = new Set<string>();
        const allDoctors: Doctor[] = [];
        for (const clinic of clinics) {
            for (const dept of clinic.departments) {
                for (const doc of dept.doctors) {
                    if (!seen.has(doc.id)) {
                        seen.add(doc.id);
                        allDoctors.push(doc);
                    }
                }
            }
        }
        return allDoctors.sort((a, b) => a.name.localeCompare(b.name));
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

                {/* ── Category Images Panel ── */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm mb-6 overflow-hidden">
                    <button
                        onClick={() => setShowCategoryPanel(!showCategoryPanel)}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <FolderOpen className="w-5 h-5 text-indigo-500" />
                            <span className="font-semibold text-gray-800 dark:text-gray-200">Category Images</span>
                            <span className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                                {Object.keys(categoryImages).length} set
                            </span>
                        </div>
                        <span className={`text-gray-400 transition-transform ${showCategoryPanel ? 'rotate-180' : ''}`}>
                            ▼
                        </span>
                    </button>
                    {showCategoryPanel && (() => {
                        // Collect all unique categories across all departments
                        const allCategories = new Set<string>();
                        currentClinic?.departments.forEach(dept => {
                            dept.services.forEach(svc => {
                                if (svc.category) allCategories.add(svc.category);
                            });
                        });
                        const cats = Array.from(allCategories).sort();
                        return (
                            <div className="px-6 pb-6 border-t border-gray-100 dark:border-gray-700">
                                <p className="text-sm text-gray-500 mt-3 mb-4">Upload images for service categories. These images appear on the booking page when clients choose a category.</p>
                                {cats.length === 0 ? (
                                    <p className="text-sm text-gray-400 italic">No categories found. Add services with categories first.</p>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                        {cats.map(cat => (
                                            <div key={cat} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                                                {categoryImages[cat] ? (
                                                    <div className="relative h-28 bg-gray-100 dark:bg-gray-700">
                                                        <img src={categoryImages[cat]} alt={cat} className="w-full h-full object-cover" />
                                                        <button
                                                            onClick={() => handleCategoryImageRemove(cat)}
                                                            className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-colors"
                                                            title="Remove image"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <label className="flex flex-col items-center justify-center h-28 bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                                        <ImagePlus className="w-6 h-6 text-gray-300 mb-1" />
                                                        <span className="text-xs text-gray-400">Upload</span>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            onChange={async (e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) await handleCategoryImageUpload(cat, file);
                                                            }}
                                                        />
                                                    </label>
                                                )}
                                                <div className="p-2 text-center">
                                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate block">{cat}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>

                {/* Service List – grouped by category */}
                {(() => {
                    const grouped: Record<string, typeof allServices> = {};
                    allServices.forEach(s => {
                        const cat = s.category || 'General';
                        if (!grouped[cat]) grouped[cat] = [];
                        grouped[cat].push(s);
                    });
                    const categories = Object.keys(grouped).sort((a, b) => a === 'General' ? 1 : b === 'General' ? -1 : a.localeCompare(b));

                    return categories.map(cat => (
                        <div key={cat} className="mb-4">
                            {/* Category Header */}
                            <div className="flex items-center gap-2 px-1 py-2 mb-1">
                                <FolderOpen className="w-4 h-4 text-indigo-500" />
                                <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">{cat}</h2>
                                <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-bold">{grouped[cat].length}</span>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {grouped[cat].map(service => {
                                        const isHidden = service.isVisible === false;
                                        return (
                                        <div key={service.id} className={`p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${isHidden ? 'opacity-50' : ''}`}>
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                {service.image && (
                                                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                                                        <img src={service.image} alt={service.name} className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                                                        {service.name}
                                                        {isHidden && (
                                                            <span className="ml-2 text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full font-bold">Hidden from Booking</span>
                                                        )}
                                                    </h3>
                                                    {service.description && (
                                                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1.5 line-clamp-2">{service.description}</p>
                                                    )}
                                                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="w-3.5 h-3.5" />
                                                            {service.duration} mins
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <span className="text-xs font-semibold">د.إ</span>
                                                            {service.regularPrice && service.discountedPrice ? (
                                                                <><span className="line-through text-gray-400 mr-1">{service.regularPrice}</span><span className="text-green-600 font-semibold">{service.discountedPrice} AED</span></>
                                                            ) : service.discountedPrice ? (
                                                                <><span className="text-green-600 font-semibold">{service.discountedPrice} AED</span></>
                                                            ) : (
                                                                <>{service.regularPrice || service.price} AED</>
                                                            )}
                                                            {service.isTaxable && <span className="text-xs text-orange-600 bg-orange-100 dark:bg-orange-900/30 px-1 rounded ml-1">+VAT</span>}
                                                        </span>
                                                        <span className="flex items-center gap-1 text-xs">
                                                            <UserCheck className="w-3 h-3" />
                                                            {getAllowedDoctorsText(service, getDepartmentDoctors(service._deptId))}
                                                        </span>
                                                        <span className="flex items-center gap-1 text-xs">
                                                            <Users className="w-3 h-3" />
                                                            {getGenderText(service.allowedGender)}
                                                        </span>
                                                        {service.allowedDays && service.allowedDays.length > 0 && (
                                                            <span className="flex items-center gap-1 text-xs">
                                                                <Calendar className="w-3 h-3" />
                                                                {getDaysText(service.allowedDays)}
                                                            </span>
                                                        )}
                                                        {service.timeWindow && (
                                                            <span className="flex items-center gap-1 text-xs">
                                                                <Clock4 className="w-3 h-3" />
                                                                {getTimeWindowText(service.timeWindow)}
                                                            </span>
                                                        )}
                                                        {service.requiredResourceIds && service.requiredResourceIds.length > 0 && (
                                                            <span className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                                                                <Archive className="w-3 h-3" />
                                                                {service.requiredResourceIds.length} Resource{service.requiredResourceIds.length > 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                        {service.maxMedicines && (
                                                            <span className="flex items-center gap-1 text-xs text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 px-2 py-0.5 rounded-full">
                                                                <Pill className="w-3.5 h-3.5" />
                                                                Up to {service.maxMedicines} Medicine{service.maxMedicines > 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {/* 3-Session & 6-Session Validity Row - Always visible */}
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border ${service.threeSessionPackage ? 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                                                            📦 3 Sessions: {service.threeSessionPackage
                                                                ? <><strong className="ml-0.5">{service.threeSessionPackage.discountedPrice || service.threeSessionPackage.totalCost} AED</strong> · {service.threeSessionPackage.validity || 90} days</>
                                                                : <span className="italic">Not set</span>}
                                                        </span>
                                                        <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border ${service.sixSessionPackage ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                                                            📦 6 Sessions: {service.sixSessionPackage
                                                                ? <><strong className="ml-0.5">{service.sixSessionPackage.discountedPrice || service.sixSessionPackage.totalCost} AED</strong> · {service.sixSessionPackage.validity || 180} days</>
                                                                : <span className="italic">Not set</span>}
                                                        </span>
                                                    </div>
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
                                            </div>
                                            <div className="flex items-center gap-2 ml-4 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleVisibility(service._deptId, service.id, service.isVisible !== false)}
                                                    className={`p-2 rounded-full transition-colors ${isHidden ? 'text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-green-500 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20'}`}
                                                    title={isHidden ? 'Show on Booking Portal' : 'Hide from Booking Portal'}
                                                >
                                                    {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => openEditModal(service._deptId, service)}
                                                    className="text-indigo-500 hover:text-indigo-700 p-2 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                                                    title="Edit Service"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                {deletingServiceId === service.id ? (
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteService(service._deptId, service.id)}
                                                            className="text-white bg-red-600 hover:bg-red-700 px-2 py-1 rounded-md text-xs font-bold transition-colors"
                                                        >
                                                            Confirm
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setDeletingServiceId(null)}
                                                            className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            console.log('[DELETE] Trash clicked for:', service.id, service.name);
                                                            setDeletingServiceId(service.id);
                                                            setTimeout(() => setDeletingServiceId(prev => prev === service.id ? null : prev), 3000);
                                                        }}
                                                        className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                        title="Delete Service"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ));
                })()}

                {allServices.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        No services found matching your criteria.
                    </div>
                )}

                {/* ═══ SESSION PACKAGES SECTION (ALL BRANCHES) ═══ */}
                {clinics.length > 0 && (() => {
                    // Collect services from ALL clinics, deduplicate by name (first occurrence wins)
                    const seen = new Set<string>();
                    const crossBranchServices: (Service & { _deptName: string; _category: string })[] = [];
                    for (const clinic of clinics) {
                        for (const dept of (clinic.departments || [])) {
                            for (const svc of (dept.services || [])) {
                                const key = svc.name.toLowerCase().trim();
                                if (!seen.has(key)) {
                                    seen.add(key);
                                    crossBranchServices.push({
                                        ...svc,
                                        _deptName: dept.name,
                                        _category: svc.category || 'General',
                                    });
                                }
                            }
                        }
                    }

                    if (crossBranchServices.length === 0) return null;

                    // Group by category
                    const pkgGrouped: Record<string, typeof crossBranchServices> = {};
                    crossBranchServices.forEach(s => {
                        if (!pkgGrouped[s._category]) pkgGrouped[s._category] = [];
                        pkgGrouped[s._category].push(s);
                    });
                    const pkgCategories = Object.keys(pkgGrouped).sort((a, b) => a === 'General' ? 1 : b === 'General' ? -1 : a.localeCompare(b));

                    return (
                        <div className="mt-10 border-t-2 border-indigo-100 dark:border-indigo-900/30 pt-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white text-lg">📦</div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">Session Packages</h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">3-Session &amp; 6-Session pricing and validity · <span className="text-indigo-500 font-medium">Valid at all branches</span></p>
                                </div>
                            </div>

                            {pkgCategories.map(cat => (
                                <div key={cat} className="mb-6">
                                    <div className="flex items-center gap-2 px-1 py-2 mb-2">
                                        <FolderOpen className="w-4 h-4 text-indigo-500" />
                                        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">{cat}</h3>
                                        <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-bold">
                                            {pkgGrouped[cat].length}
                                        </span>
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden overflow-x-auto">
                                        <table className="w-full text-sm min-w-[700px]">
                                            <thead>
                                                <tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
                                                    <th className="text-left px-4 py-3 font-semibold">Service</th>
                                                    <th className="text-center px-3 py-3 font-semibold">Single Price</th>
                                                    <th className="text-center px-3 py-3 font-semibold border-l border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/10" colSpan={3}>
                                                        <span className="text-blue-600 dark:text-blue-400">📦 3 Sessions</span>
                                                    </th>
                                                    <th className="text-center px-3 py-3 font-semibold border-l border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-900/10" colSpan={3}>
                                                        <span className="text-emerald-600 dark:text-emerald-400">📦 6 Sessions</span>
                                                    </th>
                                                </tr>
                                                <tr className="bg-gray-50/50 dark:bg-gray-700/30 text-gray-400 dark:text-gray-500 text-[10px] uppercase tracking-wider">
                                                    <th className="px-4 py-1"></th>
                                                    <th className="px-3 py-1 text-center">AED</th>
                                                    <th className="px-3 py-1 text-center border-l border-blue-100 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-900/5">Total</th>
                                                    <th className="px-3 py-1 text-center bg-blue-50/30 dark:bg-blue-900/5">Discounted</th>
                                                    <th className="px-3 py-1 text-center bg-blue-50/30 dark:bg-blue-900/5">Validity</th>
                                                    <th className="px-3 py-1 text-center border-l border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/30 dark:bg-emerald-900/5">Total</th>
                                                    <th className="px-3 py-1 text-center bg-emerald-50/30 dark:bg-emerald-900/5">Discounted</th>
                                                    <th className="px-3 py-1 text-center bg-emerald-50/30 dark:bg-emerald-900/5">Validity</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                {pkgGrouped[cat].map(service => {
                                                    const three = service.threeSessionPackage;
                                                    const six = service.sixSessionPackage;
                                                    return (
                                                        <tr key={service.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                                                            <td className="px-4 py-3">
                                                                <span className="font-medium text-gray-900 dark:text-white">{service.name}</span>
                                                            </td>
                                                            <td className="px-3 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">
                                                                {service.discountedPrice || service.regularPrice || service.price} AED
                                                            </td>
                                                            {/* 3-Session columns */}
                                                            <td className="px-3 py-3 text-center border-l border-blue-100 dark:border-blue-900/30 bg-blue-50/20 dark:bg-blue-900/5">
                                                                {three ? <span className="font-semibold text-blue-700 dark:text-blue-400">{three.totalCost} AED</span> : <span className="text-gray-300 italic text-xs">—</span>}
                                                            </td>
                                                            <td className="px-3 py-3 text-center bg-blue-50/20 dark:bg-blue-900/5">
                                                                {three ? <span className="font-bold text-blue-600 dark:text-blue-300">{three.discountedPrice} AED</span> : <span className="text-gray-300 italic text-xs">—</span>}
                                                            </td>
                                                            <td className="px-3 py-3 text-center bg-blue-50/20 dark:bg-blue-900/5">
                                                                {three ? <span className="text-blue-600 dark:text-blue-400 font-medium">{three.validity} days</span> : <span className="text-gray-300 italic text-xs">—</span>}
                                                            </td>
                                                            {/* 6-Session columns */}
                                                            <td className="px-3 py-3 text-center border-l border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/20 dark:bg-emerald-900/5">
                                                                {six ? <span className="font-semibold text-emerald-700 dark:text-emerald-400">{six.totalCost} AED</span> : <span className="text-gray-300 italic text-xs">—</span>}
                                                            </td>
                                                            <td className="px-3 py-3 text-center bg-emerald-50/20 dark:bg-emerald-900/5">
                                                                {six ? <span className="font-bold text-emerald-600 dark:text-emerald-300">{six.discountedPrice} AED</span> : <span className="text-gray-300 italic text-xs">—</span>}
                                                            </td>
                                                            <td className="px-3 py-3 text-center bg-emerald-50/20 dark:bg-emerald-900/5">
                                                                {six ? <span className="text-emerald-600 dark:text-emerald-400 font-medium">{six.validity} days</span> : <span className="text-gray-300 italic text-xs">—</span>}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    );
                })()}
                {/* Add Service Modal */}
                {isAddModalOpen && (
                    <>
                        {/* Branch Selection Overlay */}
                        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-4 pointer-events-none">
                            <div className="pointer-events-auto bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-indigo-200 dark:border-indigo-800 p-4 max-w-md w-full mx-4">
                                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                    Add to Branches
                                </h3>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
                                        <input
                                            type="checkbox"
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            checked={selectedBranchIds.length === clinics.length}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedBranchIds(clinics.map(c => c.id));
                                                } else {
                                                    setSelectedBranchIds([]);
                                                }
                                            }}
                                        />
                                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">Select All Branches</span>
                                    </label>
                                    {clinics.map(clinic => (
                                        <label key={clinic.id} className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            <input
                                                type="checkbox"
                                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                checked={selectedBranchIds.includes(clinic.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedBranchIds(prev => [...prev, clinic.id]);
                                                    } else {
                                                        setSelectedBranchIds(prev => prev.filter(id => id !== clinic.id));
                                                    }
                                                }}
                                            />
                                            <span className="text-gray-800 dark:text-gray-200">{clinic.name}</span>
                                        </label>
                                    ))}
                                    {selectedBranchIds.length === 0 && (
                                        <p className="text-xs text-gray-400 italic mt-1">If no branches selected, service will be added to the currently selected branch only.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <ServiceEditorModal
                        mode="add"
                        title="Add New Service"
                        formState={{ ...newService, departmentId: newService.departmentId || currentClinic?.departments[0]?.id || '' }}
                        setFormState={setNewService}
                        currentClinic={currentClinic}
                        doctors={getDepartmentDoctors('')}
                        resources={resources}
                        medicines={medicines}
                        registeredProducts={registeredProducts}
                        dayNames={dayNames}
                        onSubmit={(e) => {
                            // Auto-assign departmentId if not set
                            if (!newService.departmentId && currentClinic?.departments[0]) {
                                setNewService({ ...newService, departmentId: currentClinic.departments[0].id });
                            }
                            handleAddService(e);
                        }}
                        onClose={() => setIsAddModalOpen(false)}
                        onToggleDay={(day) => toggleDaySelection(day, false)}
                        onToggleDoctor={(docId) => toggleDoctorSelection(docId, false)}
                        onImageUpload={uploadImage}
                        submitting={submitting}
                        uploadingImage={uploadingImage}
                    />
                    </>
                )}
                {/* Edit Service Modal */}
                {isEditModalOpen && editingService && (
                    <>
                        {/* Branch Selection Overlay for Edit */}
                        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-4 pointer-events-none">
                            <div className="pointer-events-auto bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-amber-200 dark:border-amber-800 p-4 max-w-md w-full mx-4">
                                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                    Apply Edits to Branches
                                </h3>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                                        <input
                                            type="checkbox"
                                            className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                                            checked={selectedBranchIds.length === clinics.length}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedBranchIds(clinics.map(c => c.id));
                                                } else {
                                                    setSelectedBranchIds([]);
                                                }
                                            }}
                                        />
                                        <span className="font-semibold text-amber-600 dark:text-amber-400">Apply to All Branches</span>
                                    </label>
                                    {clinics.map(clinic => (
                                        <label key={clinic.id} className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            <input
                                                type="checkbox"
                                                className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                                                checked={selectedBranchIds.includes(clinic.id) || clinic.id === selectedClinicId}
                                                disabled={clinic.id === selectedClinicId}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedBranchIds(prev => [...prev, clinic.id]);
                                                    } else {
                                                        setSelectedBranchIds(prev => prev.filter(id => id !== clinic.id));
                                                    }
                                                }}
                                            />
                                            <span className="text-gray-800 dark:text-gray-200">
                                                {clinic.name}
                                                {clinic.id === selectedClinicId && <span className="text-xs text-gray-400 ml-1">(current)</span>}
                                            </span>
                                        </label>
                                    ))}
                                    {selectedBranchIds.filter(id => id !== selectedClinicId).length === 0 && (
                                        <p className="text-xs text-gray-400 italic mt-1">Check additional branches to apply the same edits there too.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <ServiceEditorModal
                            mode="edit"
                            title="Edit Service"
                            formState={editingService}
                            setFormState={setEditingService}
                            currentClinic={currentClinic}
                            doctors={getDepartmentDoctors(editingService.departmentId)}
                            resources={resources}
                            medicines={medicines}
                            registeredProducts={registeredProducts}
                            dayNames={dayNames}
                            onSubmit={handleUpdateService}
                            onClose={() => { setIsEditModalOpen(false); setSelectedBranchIds([]); }}
                            onToggleDay={(day) => toggleDaySelection(day, true)}
                            onToggleDoctor={(docId) => toggleDoctorSelection(docId, true)}
                            onImageUpload={uploadImage}
                            submitting={submitting}
                            uploadingImage={uploadingImage}
                        />
                    </>
                )}
            </div>
        </div>
    );
}


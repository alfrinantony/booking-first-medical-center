'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Search, Clock, Edit2, UserCheck, Users, Users2, Calendar, Clock4, Archive, Pill, ImagePlus, FolderOpen, X } from 'lucide-react';
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
            const payload: any = {
                clinicId: selectedClinicId,
                departmentId: newService.departmentId,
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

            if (res.ok) {
                await fetchServices();
                setIsAddModalOpen(false);
                setNewService(emptyServiceForm);
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
            const payload: any = {
                clinicId: selectedClinicId,
                departmentId: editingService.departmentId,
                serviceId: editingService.id,
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

                {/* Service List – flat, no department grouping */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {allServices.map(service => (
                            <div key={service.id} className="p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    {/* Service Thumbnail */}
                                    {service.image && (
                                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                                            <img src={service.image} alt={service.name} className="w-full h-full object-cover" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium text-gray-900 dark:text-white mb-1">{service.name}</h3>
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
                                            {service.category && (
                                                <span className="text-xs bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                                                    {service.category}
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
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                    <button
                                        onClick={() => openEditModal(service._deptId, service)}
                                        className="text-indigo-500 hover:text-indigo-700 p-2 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                                        title="Edit Service"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteService(service._deptId, service.id)}
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

                {allServices.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        No services found matching your criteria.
                    </div>
                )}
                {/* Add Service Modal */}
                {isAddModalOpen && (
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
                )}
                {/* Edit Service Modal */}
                {isEditModalOpen && editingService && (
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
                        onClose={() => setIsEditModalOpen(false)}
                        onToggleDay={(day) => toggleDaySelection(day, true)}
                        onToggleDoctor={(docId) => toggleDoctorSelection(docId, true)}
                        onImageUpload={uploadImage}
                        submitting={submitting}
                        uploadingImage={uploadingImage}
                    />
                )}
            </div>
        </div>
    );
}


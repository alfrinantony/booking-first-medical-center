'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Search, Clock, Edit2, UserCheck, Users, Users2, Calendar, Clock4, Archive, Pill, ImagePlus, FolderOpen, X, Eye, EyeOff, ArrowUp, ArrowDown } from 'lucide-react';
import { Clinic, Department, Service, ServiceAddOn, ServicePackageTier, Doctor, Resource, Medicine, RegisteredProduct, ProductConsumption } from '@/lib/data';
import ServiceEditorModal from '@/components/ServiceEditorModal';
import { useFormDraft } from '@/hooks/useFormDraft';

interface ServiceFormState {
    departmentIds: string[];
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
    minimumIntervalDays: string;
    screeningQuestions: string[];
    requiredResourceIds: string[];
    maxMedicines: string;
    medicineIds: string[];
    medicineSelectionMode: 'choose' | 'either' | 'all';
    consumableIds: string[];
    addOns: ServiceAddOn[];
    image: string;
    productConsumptions: { registeredProductId: string; quantityPerService: number }[];
    maxDiscountPercentage: string | number;
    requiredEquipmentIds: string[];
    requiredEquipmentBrands: string[];
}

export default function ServicesPage() {
    const [clinics, setClinics] = useState<Clinic[]>([]);
    const [selectedClinicId, setSelectedClinicId] = useState('');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedFilterDeptId, setSelectedFilterDeptId] = useState('all');
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
    const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null);
    const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);

    // Add Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const emptyServiceForm: ServiceFormState = {
        departmentIds: [],
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
        minimumIntervalDays: '',
        screeningQuestions: [],
        requiredResourceIds: [],
        maxMedicines: '',
        medicineIds: [],
        medicineSelectionMode: 'choose',
        consumableIds: [],
        addOns: [],
        image: '',
        productConsumptions: [],
        maxDiscountPercentage: '',
        requiredEquipmentIds: [],
        requiredEquipmentBrands: [],
    };
    const [newService, setNewService] = useState<ServiceFormState>(emptyServiceForm);

    const [resources, setResources] = useState<Resource[]>([]);
    const [equipments, setEquipments] = useState<any[]>([]);
    const [medicines, setMedicines] = useState<Medicine[]>([]);

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingService, setEditingService] = useState<Service & { departmentIds: string[] } & { timeWindowStart?: string, timeWindowEnd?: string, followUpDurationInput?: string, minimumIntervalDaysInput?: string, maxDiscountPercentage?: string | number, originalName?: string } | null>(null);

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

    // Form Draft Auto-Save
    const pageDraftData = {
        isAddModalOpen,
        newService,
        isEditModalOpen,
        editingService,
        selectedBranchIds
    };

    const { clearDraft: clearPageDraft } = useFormDraft('admin-services-page', pageDraftData, {
        onRestore: (data: any) => {
            if (data.isAddModalOpen !== undefined) setIsAddModalOpen(data.isAddModalOpen);
            if (data.newService) setNewService(data.newService);
            if (data.isEditModalOpen !== undefined) setIsEditModalOpen(data.isEditModalOpen);
            if (data.editingService) setEditingService(data.editingService);
            if (data.selectedBranchIds) setSelectedBranchIds(data.selectedBranchIds);
        }
    });

    const [categoryOrder, setCategoryOrder] = useState<string[]>([]);

    const fetchCategoryOrder = async () => {
        try {
            const res = await fetch('/api/admin/category-order');
            const data = await res.json();
            if (Array.isArray(data)) setCategoryOrder(data);
        } catch { }
    };

    useEffect(() => {
        fetchServices();
        fetchCategoryImages();
        fetchCategoryOrder();
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
            const res = await fetch(`/api/admin/services?t=${Date.now()}`, { cache: 'no-store' });
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

    const fetchEquipments = async (clinicId: string) => {
        try {
            const res = await fetch(`/api/admin/equipment?branchId=${clinicId}`);
            const data = await res.json();
            setEquipments(data);
        } catch (error) {
            console.error('Failed to fetch equipments', error);
        }
    };

    useEffect(() => {
        if (selectedClinicId) {
            fetchResources(selectedClinicId);
            fetchEquipments(selectedClinicId);
        }
    }, [selectedClinicId]);

    // Empty space from deleted buildServicePayload


    const handleAddService = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            // Determine which branches to add to. If none selected, default to the currently selected branch only (matching the UI text).
            const branchIds = selectedBranchIds.length > 0 ? selectedBranchIds : [selectedClinicId];

            for (const branchId of branchIds) {
                const branchClinic = clinics.find(c => c.id === branchId);
                if (!branchClinic) continue;

                const targetDeptIds = newService.departmentIds.length > 0 
                                      ? newService.departmentIds 
                                      : (currentClinic?.departments?.[0] ? [currentClinic.departments[0].id] : []);

                for (const sourceDeptId of targetDeptIds) {
                    let targetDeptId = sourceDeptId;
                    if (branchId !== selectedClinicId) {
                        // Find the original department name from the currently selected clinic
                        const sourceClinic = clinics.find(c => c.id === selectedClinicId);
                        const sourceDept = sourceClinic?.departments?.find(d => d.id === sourceDeptId);
                        const matchedDept = branchClinic.departments?.find(d => d.name === sourceDept?.name);
                        targetDeptId = matchedDept?.id || branchClinic.departments?.[0]?.id || '';
                    }

                    if (!targetDeptId) continue;

                const payload: any = {
                    clinicId: branchId,
                    departmentId: targetDeptId,
                    name: newService.name,
                    description: newService.description,
                    preCare: newService.preCare,
                    postCare: newService.postCare,
                    price: (newService.discountedPrice && String(newService.discountedPrice).trim() !== '') ? Number(newService.discountedPrice) : 
                           (newService.regularPrice && String(newService.regularPrice).trim() !== '') ? Number(newService.regularPrice) : 0,
                    regularPrice: newService.regularPrice && String(newService.regularPrice).trim() !== '' ? Number(newService.regularPrice) : undefined,
                    discountedPrice: newService.discountedPrice && String(newService.discountedPrice).trim() !== '' ? Number(newService.discountedPrice) : undefined,
                    maxDiscountPercentage: newService.maxDiscountPercentage && String(newService.maxDiscountPercentage).trim() !== '' ? Number(newService.maxDiscountPercentage) : undefined,
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
                    minimumIntervalDays: newService.minimumIntervalDays ? Number(newService.minimumIntervalDays) : undefined,
                    screeningQuestions: newService.screeningQuestions,
                    timeWindow: (newService.timeWindowStart && newService.timeWindowEnd) ? {
                        start: newService.timeWindowStart,
                        end: newService.timeWindowEnd
                    } : undefined,
                    requiredResourceIds: newService.requiredResourceIds,
                    requiredEquipmentIds: newService.requiredEquipmentIds,
                    requiredEquipmentBrands: newService.requiredEquipmentBrands,
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
                } // End department loop
            } // End branch loop

            await fetchServices();
            setIsAddModalOpen(false);
            setNewService(emptyServiceForm);
            setSelectedBranchIds([]);
            await clearPageDraft();
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
                    price: (editingService.discountedPrice !== null && editingService.discountedPrice !== undefined && String(editingService.discountedPrice).trim() !== '') ? Number(editingService.discountedPrice) : 
                           (editingService.regularPrice !== null && editingService.regularPrice !== undefined && String(editingService.regularPrice).trim() !== '') ? Number(editingService.regularPrice) : Number(editingService.price),
                    regularPrice: editingService.regularPrice !== null && editingService.regularPrice !== undefined && String(editingService.regularPrice).trim() !== '' ? Number(editingService.regularPrice) : null,
                    discountedPrice: editingService.discountedPrice !== null && editingService.discountedPrice !== undefined && String(editingService.discountedPrice).trim() !== '' ? Number(editingService.discountedPrice) : null,
                    maxDiscountPercentage: editingService.maxDiscountPercentage !== null && editingService.maxDiscountPercentage !== undefined && String(editingService.maxDiscountPercentage).trim() !== '' ? Number(editingService.maxDiscountPercentage) : null,
                    threeSessionPackage: editingService.threeSessionPackage && editingService.threeSessionPackage.totalCost ? editingService.threeSessionPackage : null,
                    sixSessionPackage: editingService.sixSessionPackage && editingService.sixSessionPackage.totalCost ? editingService.sixSessionPackage : null,
                    duration: Number(editingService.duration),
                    allowedDoctorIds: editingService.allowedDoctorIds,
                    allowedGender: editingService.allowedGender,
                    allowedDays: editingService.allowedDays,
                    isTaxable: editingService.isTaxable,
                    category: editingService.category,
                    followUpDuration: (editingService as any).followUpDurationInput ? Number((editingService as any).followUpDurationInput) : null,
                    minimumIntervalDays: (editingService as any).minimumIntervalDaysInput ? Number((editingService as any).minimumIntervalDaysInput) : null,
                    screeningQuestions: editingService.screeningQuestions,
                    timeWindow: (editingService.timeWindowStart && editingService.timeWindowEnd) ? {
                        start: editingService.timeWindowStart,
                        end: editingService.timeWindowEnd
                    } : null,
                    requiredResourceIds: editingService.requiredResourceIds,
                    requiredEquipmentIds: editingService.requiredEquipmentIds || [],
                    maxMedicines: editingService.maxMedicines || null,
                    medicineIds: editingService.medicineIds || [],
                    medicineSelectionMode: (editingService.medicineIds || []).length > 0 ? editingService.medicineSelectionMode : null,
                    consumableIds: editingService.consumableIds || [],
                    productConsumptions: editingService.productConsumptions || [],
                    addOns: editingService.addOns || [],
                    image: editingService.image || null
                };
                return p;
            };

            const previouslyAssignedBranchIds: string[] = [];
            for (const c of clinics) {
                for (const d of c.departments || []) {
                    if ((d.services || []).some(s => s.name === (editingService as any).originalName)) {
                        previouslyAssignedBranchIds.push(c.id);
                        break;
                    }
                }
            }

            // Determine which branches to process. If none selected, the UI text says:
            // "If no branches selected, service will be updated in all branches where it currently exists."
            const targetBranchIds = selectedBranchIds.length > 0 ? selectedBranchIds : previouslyAssignedBranchIds;

            for (const branchId of targetBranchIds) {
                const branchClinic = clinics.find(c => c.id === branchId);
                if (!branchClinic) continue;

                // What were the OLD departments in this branch that had this service?
                const prevDeptIds: string[] = [];
                for (const d of branchClinic.departments || []) {
                    if (d.services.some(s => s.name === (editingService as any).originalName)) prevDeptIds.push(d.id);
                }

                // What are the NEW desired departments in this branch?
                // We map them by name from exactly what was selected in editingService.departmentIds from the source clinic.
                const sourceClinic = clinics.find(c => c.id === selectedClinicId);
                const targetDeptIds: string[] = [];
                
                for (const srcDeptId of editingService.departmentIds) {
                    if (branchId === selectedClinicId) {
                        targetDeptIds.push(srcDeptId);
                    } else {
                        const sourceDept = sourceClinic?.departments?.find(d => d.id === srcDeptId);
                        const matchedDept = branchClinic.departments?.find(d => d.name === sourceDept?.name);
                        if (matchedDept) {
                            targetDeptIds.push(matchedDept.id);
                        } else if (branchClinic.departments?.[0]) {
                            // Target fallback
                            if (!targetDeptIds.includes(branchClinic.departments[0].id)) {
                                targetDeptIds.push(branchClinic.departments[0].id);
                            }
                        }
                    }
                }

                // Departments to Add or Update
                for (const deptId of targetDeptIds) {
                    const matchedSvc = branchClinic.departments?.find(d => d.id === deptId)?.services?.find(s => s.name === (editingService as any).originalName);
                    const method = matchedSvc ? 'PUT' : 'POST';
                    const res = await fetch('/api/admin/services', {
                        method,
                        headers: { 'Content-Type': 'application/json' },
                        // Make sure we carry over the same universal ID so bookings and packages don't break when switching departments!
                        body: JSON.stringify(buildPayload(branchId, deptId, matchedSvc?.id || editingService.id))
                    });

                    if (!res.ok) {
                        const err = await res.text();
                        console.error(`Failed to ${method} service in ${deptId}:`, err);
                        alert(`Failed to save department mapping for ${deptId}.`);
                    }
                }

                // Departments to Delete (UNCHECKED)
                const departmentsToRemove = prevDeptIds.filter(id => !targetDeptIds.includes(id));
                for (const deptId of departmentsToRemove) {
                    const matchedSvc = branchClinic.departments?.find(d => d.id === deptId)?.services?.find(s => s.name === (editingService as any).originalName);
                    if (matchedSvc) {
                        const dr = await fetch(`/api/admin/services?clinicId=${encodeURIComponent(branchId)}&departmentId=${encodeURIComponent(deptId)}&serviceId=${encodeURIComponent(matchedSvc.id)}`, {
                            method: 'DELETE'
                        });
                        if (!dr.ok) {
                            console.error(`Failed to DELETE service from ${deptId}`);
                        }
                    }
                }
            } // Close the for loop iterating over targetBranchIds

            // Handle branches that were ENTIRELY unchecked (need to be deleted from ALL departments in that branch)
            const branchesToRemove = previouslyAssignedBranchIds.filter(id => !targetBranchIds.includes(id));
            
            for (const branchId of branchesToRemove) {
                const branchClinic = clinics.find(c => c.id === branchId);
                if (!branchClinic) continue;
                
                // Find service details in this branch
                for (const dept of branchClinic.departments || []) {
                    const found = (dept.services || []).find(s => s.name === (editingService as any).originalName);
                    if (found) {
                        await fetch(`/api/admin/services?clinicId=${encodeURIComponent(branchId)}&departmentId=${encodeURIComponent(dept.id)}&serviceId=${encodeURIComponent(found.id)}`, {
                            method: 'DELETE'
                        });
                        break;
                    }
                }
            }

            await fetchServices();
            setIsEditModalOpen(false);
            setEditingService(null);
            setSelectedBranchIds([]);
            await clearPageDraft();
        } catch (error) {
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteService = async (departmentId: string, serviceId: string) => {
        console.log('[DELETE] Attempting delete:', { clinicId: selectedClinicId, departmentId, serviceId });
        try {
            const url = `/api/admin/services?clinicId=${encodeURIComponent(selectedClinicId)}&departmentId=${encodeURIComponent(departmentId)}&serviceId=${encodeURIComponent(serviceId)}`;
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

    const handleToggleVisibility = async (deptIds: string[], serviceId: string, currentStatus: boolean) => {
        try {
            // Updated: Hide globally across all clinics to ensure it actually unpublishes from the booking portal catalog
            const res = await fetch('/api/admin/services', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serviceId,
                    updateGlobally: true,
                    isVisible: !currentStatus
                })
            });
            if (!res.ok) throw new Error('Failed to toggle visibility');
            
            fetchServices();
        } catch (error) {
            console.error('Failed to toggle visibility', error);
        }
    };

    const handleMoveCategory = async (cat: string, direction: 'up' | 'down') => {
        const currentOrder = [...categoryOrder];
        // If not in order list, add all missing categories first
        const allCats = new Set<string>();
        currentClinic?.departments.forEach(dept => {
            dept.services.forEach(svc => {
                if (svc.category) allCats.add(svc.category);
            });
        });
        const missing = Array.from(allCats).filter(c => !currentOrder.includes(c));
        const fullOrder = [...currentOrder, ...missing];

        const index = fullOrder.indexOf(cat);
        if (index === -1) return;
        if (direction === 'up' && index > 0) {
            [fullOrder[index - 1], fullOrder[index]] = [fullOrder[index], fullOrder[index - 1]];
        } else if (direction === 'down' && index < fullOrder.length - 1) {
            [fullOrder[index + 1], fullOrder[index]] = [fullOrder[index], fullOrder[index + 1]];
        } else {
            return;
        }

        setCategoryOrder(fullOrder);
        try {
            await fetch('/api/admin/categories/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order: fullOrder })
            });
        } catch (error) {
            console.error('Failed to reorder categories', error);
        }
    };

    const handleMoveService = async (serviceId: string, currentCategory: string, direction: 'up' | 'down') => {
        // Find all services in this category across all departments
        const svcsInCategory = allServices.filter(s => (s.category || 'General') === currentCategory)
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        const index = svcsInCategory.findIndex(s => s.id === serviceId);
        if (index === -1) return;
        
        if (direction === 'up' && index > 0) {
            [svcsInCategory[index - 1], svcsInCategory[index]] = [svcsInCategory[index], svcsInCategory[index - 1]];
        } else if (direction === 'down' && index < svcsInCategory.length - 1) {
            [svcsInCategory[index + 1], svcsInCategory[index]] = [svcsInCategory[index], svcsInCategory[index + 1]];
        } else {
            return;
        }

        // Generate new orders
        const updates = svcsInCategory.map((s, i) => ({ serviceId: s.id, order: i }));
        
        // Optimistic update
        setClinics(prevClinics => prevClinics.map(clinic => ({
            ...clinic,
            departments: clinic.departments.map(dept => ({
                ...dept,
                services: dept.services.map(s => {
                    const update = updates.find(u => u.serviceId === s.id);
                    return update ? { ...s, order: update.order } : s;
                })
            }))
        })));

        try {
            await fetch('/api/admin/services/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates })
            });
        } catch (error) {
            console.error('Failed to reorder services', error);
            fetchServices(); // Revert on failure
        }
    };

    const openEditModal = (departmentId: string, service: Service & { _deptIds?: string[] }) => {
        // Collect exact departments from the aggregated UI token, or fallback to the single ID if raw
        const deptIdsWithService = service._deptIds && service._deptIds.length > 0 
            ? service._deptIds 
            : [departmentId];
        
        setEditingService({
            ...service,
            departmentIds: deptIdsWithService,
            timeWindowStart: service.timeWindow?.start || '',
            timeWindowEnd: service.timeWindow?.end || '',
            followUpDurationInput: service.followUpDuration ? String(service.followUpDuration) : '',
            minimumIntervalDaysInput: service.minimumIntervalDays ? String(service.minimumIntervalDays) : '',
            maxDiscountPercentage: service.maxDiscountPercentage ?? '',
            originalName: service.name // Track original name for cross-branch matching during rename
        } as any);
        // Preload selectedBranchIds with branches that already have this service (by name match)
        const branchesWithService: string[] = [];
        for (const clinic of clinics) {
            for (const dept of clinic.departments || []) {
                if ((dept.services || []).some(s => s.name === service.name)) {
                    branchesWithService.push(clinic.id);
                    break;
                }
            }
        }
        // Populate exactly the branches where the service exists
        setSelectedBranchIds(branchesWithService);
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

    // Derived flat list of all services (grouped by category later, but filtered here)
    const rawServices = currentClinic?.departments.flatMap(dept =>
        dept.services.map(s => ({ ...s, _deptId: dept.id, _deptName: dept.name }))
    ) || [];

    // Aggregate by unique service ID so multi-department services appear as one card
    const serviceMap = new Map<string, typeof rawServices[0] & { _deptNames: string[], _deptIds: string[] }>();
    for (const s of rawServices) {
        if (!serviceMap.has(s.id)) {
            serviceMap.set(s.id, { ...s, _deptNames: [s._deptName], _deptIds: [s._deptId] });
        } else {
            const existing = serviceMap.get(s.id)!;
            if (!existing._deptIds.includes(s._deptId)) {
                existing._deptNames.push(s._deptName);
                existing._deptIds.push(s._deptId);
            }
        }
    }

    const allServices = Array.from(serviceMap.values()).filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDept = selectedFilterDeptId === 'all' || s._deptIds.includes(selectedFilterDeptId);
        return matchesSearch && matchesDept;
    });

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

    const getGroupedDoctors = () => {
        const groups: { departmentId: string, departmentName: string, doctors: Doctor[] }[] = [];
        for (const clinic of clinics) {
            for (const dept of clinic.departments || []) {
                let group = groups.find(g => g.departmentName === dept.name);
                if (!group) {
                    group = { departmentId: dept.id, departmentName: dept.name, doctors: [] };
                    groups.push(group);
                }
                for (const doc of dept.doctors || []) {
                    if (!group.doctors.some(d => d.id === doc.id)) {
                        group.doctors.push(doc);
                    }
                }
            }
        }
        groups.forEach(g => g.doctors.sort((a, b) => a.name.localeCompare(b.name)));
        return groups.filter(g => g.doctors.length > 0).sort((a, b) => a.departmentName.localeCompare(b.departmentName));
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
                    <div className="md:w-1/4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Clinic Branch</label>
                        <select
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent text-sm"
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
                    <div className="md:w-1/4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Department</label>
                        <select
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent text-sm"
                            value={selectedFilterDeptId}
                            onChange={(e) => setSelectedFilterDeptId(e.target.value)}
                        >
                            <option value="all">All Departments</option>
                            {currentClinic?.departments.map(dept => (
                                <option key={dept.id} value={dept.id}>{dept.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="md:w-2/4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Search Services</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name..."
                                className="w-full pl-10 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent text-sm"
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
                    const categories = Object.keys(grouped).sort((a, b) => {
                        if (a === 'General') return 1;
                        if (b === 'General') return -1;
                        const indexA = categoryOrder.indexOf(a);
                        const indexB = categoryOrder.indexOf(b);
                        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                        if (indexA !== -1) return -1;
                        if (indexB !== -1) return 1;
                        return a.localeCompare(b);
                    });

                    return categories.map(cat => (
                        <div key={cat} className="mb-4">
                            {/* Category Header */}
                            <div className="w-full flex items-center justify-between mb-2 gap-2">
                                <button
                                    onClick={() => setExpandedCategories(prev => ({...prev, [cat]: prev[cat] === false}))}
                                    className="flex-1 flex items-center justify-between px-2 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors group"
                                >
                                    <div className="flex items-center gap-2">
                                        <FolderOpen className="w-5 h-5 text-indigo-500" />
                                        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 tracking-tight">{cat}</h2>
                                        <span className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-bold ml-2">
                                            {grouped[cat].length}
                                        </span>
                                    </div>
                                    <span className={`text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-transform ${expandedCategories[cat] === false ? 'rotate-180' : ''}`}>
                                        ▼
                                    </span>
                                </button>
                                <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800 p-1 rounded-lg">
                                    <button onClick={() => handleMoveCategory(cat, 'up')} className="p-1.5 rounded text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/40" title="Move Category Up"><ArrowUp className="w-4 h-4" /></button>
                                    <button onClick={() => handleMoveCategory(cat, 'down')} className="p-1.5 rounded text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/40" title="Move Category Down"><ArrowDown className="w-4 h-4" /></button>
                                </div>
                            </div>
                            
                            {expandedCategories[cat] !== false && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-4">
                                    {grouped[cat].sort((a, b) => (a.order || 0) - (b.order || 0)).map(service => {
                                        const isHidden = service.isVisible === false;
                                        return (
                                        <div key={service.id} className={`bg-white dark:bg-gray-800 rounded-xl p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100 dark:border-gray-700/60 hover:-translate-y-1 hover:shadow-lg hover:border-indigo-100 dark:hover:border-indigo-900/50 transition-all flex flex-col ${isHidden ? 'opacity-60 bg-gray-50/50 dark:bg-gray-800/50' : ''}`}>
                                            
                                            {/* Header Row */}
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex gap-4 items-start flex-1 min-w-0">
                                                    {service.image ? (
                                                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-indigo-50 dark:bg-indigo-900/20 shrink-0 border border-gray-100 dark:border-gray-700">
                                                            <img src={service.image} alt={service.name} className="w-full h-full object-cover" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-16 h-16 rounded-xl bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center shrink-0 border border-dashed border-gray-200 dark:border-gray-700">
                                                            <FolderOpen className="w-6 h-6 text-gray-300" />
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0 pr-2">
                                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight mb-1 truncate" title={service.name}>
                                                            {service.name}
                                                        </h3>
                                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                                            {service._deptNames.map(deptName => (
                                                                <span key={deptName} className="text-xs text-indigo-600 dark:text-indigo-400 font-medium bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full">
                                                                    {deptName}
                                                                </span>
                                                            ))}
                                                            {isHidden && (
                                                                <span className="text-[10px] bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">Hidden</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* Actions */}
                                                <div className="flex items-center gap-1 shrink-0 bg-gray-50 dark:bg-gray-900/50 p-1 rounded-lg border border-gray-100 dark:border-gray-800">
                                                    <button onClick={() => handleMoveService(service.id, cat, 'up')} className="p-1.5 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors" title="Move Up"><ArrowUp className="w-4 h-4" /></button>
                                                    <button onClick={() => handleMoveService(service.id, cat, 'down')} className="p-1.5 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors" title="Move Down"><ArrowDown className="w-4 h-4" /></button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleVisibility(service._deptIds, service.id, service.isVisible !== false)}
                                                        className={`p-1.5 rounded-md transition-colors ${isHidden ? 'text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/40' : 'text-green-500 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/40'}`}
                                                        title={isHidden ? 'Show on Booking Portal' : 'Hide from Booking Portal'}
                                                    >
                                                        {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => openEditModal(service._deptIds[0], service)}
                                                        className="text-indigo-500 hover:text-indigo-700 p-1.5 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                                                        title="Edit Service"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    {deletingServiceId === service.id ? (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteService(service._deptId, service.id); }}
                                                            className="text-white bg-red-600 hover:bg-red-700 px-2 py-1.5 rounded-md text-xs font-bold transition-colors"
                                                        >
                                                            Confirm
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => { setDeletingServiceId(service.id); setTimeout(() => setDeletingServiceId(prev => prev === service.id ? null : prev), 3000); }}
                                                            className="text-red-500 hover:text-red-700 p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                                                            title="Delete Service"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* Description */}
                                            {service.description ? (
                                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2 h-10">{service.description}</p>
                                            ) : (
                                                <div className="h-10 mb-4"></div>
                                            )}
                                            
                                            {/* Price & Duration */}
                                            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100 dark:border-gray-700/50">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500">
                                                        <Clock className="w-4 h-4" />
                                                    </div>
                                                    <span className="font-semibold text-gray-700 dark:text-gray-300">{service.duration} <span className="text-xs font-normal text-gray-500">min</span></span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {service.regularPrice && service.discountedPrice ? (
                                                            <><span className="line-through text-gray-400 text-sm">{service.regularPrice}</span><span className="text-xl font-black text-green-600 dark:text-green-400">{service.discountedPrice} AED</span></>
                                                        ) : service.discountedPrice ? (
                                                            <span className="text-xl font-black text-green-600 dark:text-green-400">{service.discountedPrice} AED</span>
                                                        ) : (
                                                            <span className="text-xl font-black text-gray-900 dark:text-white">{service.regularPrice || service.price} <span className="text-sm text-gray-500 font-medium">AED</span></span>
                                                        )}
                                                    </div>
                                                    {service.isTaxable && <span className="text-[10px] text-orange-600 bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider block mt-1 w-max ml-auto">+VAT Applicable</span>}
                                                </div>
                                            </div>
                                            
                                            {/* Requirements & Info Badges */}
                                            <div className="flex flex-wrap gap-2 mb-4 mt-auto">
                                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700">
                                                    <UserCheck className="w-3.5 h-3.5 text-gray-400" />
                                                    {getAllowedDoctorsText(service, getDepartmentDoctors(service._deptId))}
                                                </span>
                                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700">
                                                    <Users className="w-3.5 h-3.5 text-gray-400" />
                                                    {getGenderText(service.allowedGender)}
                                                </span>
                                                {service.allowedDays && service.allowedDays.length > 0 && (
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700">
                                                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                                        {getDaysText(service.allowedDays)}
                                                    </span>
                                                )}
                                                {service.timeWindow && (
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700">
                                                        <Clock4 className="w-3.5 h-3.5 text-gray-400" />
                                                        {getTimeWindowText(service.timeWindow)}
                                                    </span>
                                                )}
                                                {service.requiredResourceIds && service.requiredResourceIds.length > 0 && (
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded-md border border-amber-200 dark:border-amber-800/50">
                                                        <Archive className="w-3.5 h-3.5" />
                                                        {service.requiredResourceIds.length} Resource{service.requiredResourceIds.length > 1 ? 's' : ''}
                                                    </span>
                                                )}
                                                {service.maxMedicines && (
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 px-2.5 py-1 rounded-md border border-teal-200 dark:border-teal-800/50">
                                                        <Pill className="w-3.5 h-3.5" />
                                                        Up to {service.maxMedicines} Meds
                                                    </span>
                                                )}
                                                {service.minimumIntervalDays ? (
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-md border border-blue-200 dark:border-blue-800/50" title="Minimum Interval Between Sessions">
                                                        <Clock4 className="w-3.5 h-3.5" />
                                                        {service.minimumIntervalDays}d Min Interval
                                                    </span>
                                                ) : null}
                                                {service.followUpDuration ? (
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2.5 py-1 rounded-md border border-green-200 dark:border-green-800/50" title="Free Follow-up Period">
                                                        <Calendar className="w-3.5 h-3.5" />
                                                        {service.followUpDuration}d Free Follow-up
                                                    </span>
                                                ) : null}
                                            </div>
                                            
                                            {/* Add Ons */}
                                            {service.addOns && service.addOns.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mb-4">
                                                    {service.addOns.map(ao => (
                                                        <span key={ao.id} className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400 border border-violet-200 dark:border-violet-800/50">
                                                            <span className="opacity-50">✨</span> {ao.procedure} · {ao.area} <span className="opacity-50 px-1 border-l border-violet-200 dark:border-violet-700">+</span> {ao.price} AED
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            
                                            {/* Session Packages (Footer Area) */}
                                            {(service.threeSessionPackage || service.sixSessionPackage) && (
                                                <div className="pt-4 border-t border-gray-100 dark:border-gray-700/50 grid grid-cols-2 gap-3 mt-auto">
                                                    <div className={`p-2 rounded-lg border flex flex-col items-center justify-center text-center ${service.threeSessionPackage ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30' : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800 opacity-50'}`}>
                                                        <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${service.threeSessionPackage ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>3 Sessions</span>
                                                        {service.threeSessionPackage ? (
                                                            <>
                                                                <span className="text-sm font-black text-gray-900 dark:text-white">{service.threeSessionPackage.discountedPrice || service.threeSessionPackage.totalCost} <span className="text-[10px] font-normal text-gray-500">AED</span></span>
                                                                <span className="text-[9px] text-gray-500 mt-0.5">{service.threeSessionPackage.validity || 90} days</span>
                                                            </>
                                                        ) : <span className="text-xs text-gray-400 italic mt-1">N/A</span>}
                                                    </div>
                                                    <div className={`p-2 rounded-lg border flex flex-col items-center justify-center text-center ${service.sixSessionPackage ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30' : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800 opacity-50'}`}>
                                                        <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${service.sixSessionPackage ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>6 Sessions</span>
                                                        {service.sixSessionPackage ? (
                                                            <>
                                                                <span className="text-sm font-black text-gray-900 dark:text-white">{service.sixSessionPackage.discountedPrice || service.sixSessionPackage.totalCost} <span className="text-[10px] font-normal text-gray-500">AED</span></span>
                                                                <span className="text-[9px] text-gray-500 mt-0.5">{service.sixSessionPackage.validity || 180} days</span>
                                                            </>
                                                        ) : <span className="text-xs text-gray-400 italic mt-1">N/A</span>}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        );
                                    })}
                                </div>
                            )}
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
                    <ServiceEditorModal
                        branchSelector={
                            <div>
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
                        }
                        mode="add"
                        title="Add New Service"
                        formState={{ ...newService, departmentIds: newService.departmentIds?.length > 0 ? newService.departmentIds : (currentClinic?.departments?.[0] ? [currentClinic.departments[0].id] : []) }}
                        setFormState={setNewService}
                        currentClinic={currentClinic}
                        doctors={getDepartmentDoctors('')}
                        groupedDoctors={getGroupedDoctors()}
                        resources={resources}
                        equipments={equipments}
                        services={currentClinic?.departments?.flatMap(d => d.services) || []}
                        medicines={medicines}
                        registeredProducts={registeredProducts}
                        dayNames={dayNames}
                        onSubmit={(e) => {
                            // Auto-assign departmentIds if not set
                            if ((!newService.departmentIds || newService.departmentIds.length === 0) && currentClinic?.departments?.[0]) {
                                setNewService({ ...newService, departmentIds: [currentClinic.departments[0].id] });
                            }
                            handleAddService(e);
                        }}
                        onClose={() => { setIsAddModalOpen(false); clearPageDraft(); }}
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
                        branchSelector={
                            <div>
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
                                                checked={selectedBranchIds.includes(clinic.id)}
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
                                            </span>
                                        </label>
                                    ))}
                                    {selectedBranchIds.filter(id => id !== selectedClinicId).length === 0 && (
                                        <p className="text-xs text-gray-400 italic mt-1">Check additional branches to apply the same edits there too.</p>
                                    )}
                                </div>
                            </div>
                        }
                        mode="edit"
                        title="Edit Service"
                            formState={editingService}
                            setFormState={setEditingService}
                            currentClinic={currentClinic}
                            doctors={getDepartmentDoctors('')}
                            groupedDoctors={getGroupedDoctors()}
                            resources={resources}
                            equipments={equipments}
                            services={currentClinic?.departments?.flatMap(d => d.services) || []}
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
                )}
            </div>
        </div>
    );
}


// Cache invalidation commit

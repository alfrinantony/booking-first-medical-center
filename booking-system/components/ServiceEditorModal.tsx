'use client';

import React, { useRef } from 'react';
import { X, ImagePlus, FileText, DollarSign, Heart, Clock, Shield, Package, Sparkles, Plus, Trash2 } from 'lucide-react';
import { ServiceAddOn, Doctor, Resource, Medicine, Clinic, RegisteredProduct, BOOKING_CATEGORIES } from '@/lib/data';

// Section definitions for sidebar
const SECTIONS = [
    { id: 'basic', label: 'Basic Info', icon: FileText, color: 'text-gray-600' },
    { id: 'pricing', label: 'Pricing', icon: DollarSign, color: 'text-green-600' },
    { id: 'care', label: 'Care & Follow-up', icon: Heart, color: 'text-pink-600' },
    { id: 'scheduling', label: 'Scheduling', icon: Clock, color: 'text-blue-600' },
    { id: 'restrictions', label: 'Restrictions', icon: Shield, color: 'text-orange-600' },
    { id: 'inventory', label: 'Inventory', icon: Package, color: 'text-purple-600' },
    { id: 'extras', label: 'Extras', icon: Sparkles, color: 'text-violet-600' },
];

interface ServiceEditorModalProps {
    mode: 'add' | 'edit';
    title: string;
    // Form state
    formState: any;
    setFormState: (val: any) => void;
    // Data
    currentClinic: Clinic | undefined;
    doctors: Doctor[];
    resources: Resource[];
    medicines: Medicine[];
    dayNames: string[];
    // Handlers
    onSubmit: (e: React.FormEvent) => void;
    onClose: () => void;
    onToggleDay: (day: number) => void;
    onToggleDoctor: (docId: string) => void;
    onImageUpload: (file: File, type: string, id: string) => Promise<string>;
    submitting: boolean;
    uploadingImage: boolean;
    registeredProducts?: RegisteredProduct[];
}

function SectionHeader({ id, label, icon: Icon, color }: { id: string; label: string; icon: any; color: string }) {
    return (
        <div id={`section-${id}`} className="flex items-center gap-2 pb-2 mb-3 border-b border-gray-200 dark:border-gray-700 scroll-mt-4">
            <Icon className={`w-4 h-4 ${color}`} />
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">{label}</h3>
        </div>
    );
}

export default function ServiceEditorModal({
    mode, title, formState, setFormState,
    currentClinic, doctors, resources, medicines, dayNames,
    onSubmit, onClose, onToggleDay, onToggleDoctor,
    onImageUpload, submitting, uploadingImage, registeredProducts,
}: ServiceEditorModalProps & { registeredProducts?: RegisteredProduct[] }) {
    const contentRef = useRef<HTMLDivElement>(null);
    const [activeSection, setActiveSection] = React.useState('basic');

    const scrollToSection = (id: string) => {
        setActiveSection(id);
        const el = document.getElementById(`section-${id}`);
        if (el && contentRef.current) {
            contentRef.current.scrollTo({ top: el.offsetTop - contentRef.current.offsetTop - 16, behavior: 'smooth' });
        }
    };

    const update = (updates: any) => setFormState({ ...formState, ...updates });

    // Track scroll position to highlight active sidebar link
    const handleScroll = () => {
        if (!contentRef.current) return;
        const container = contentRef.current;
        const scrollTop = container.scrollTop + 60;
        for (let i = SECTIONS.length - 1; i >= 0; i--) {
            const el = document.getElementById(`section-${SECTIONS[i].id}`);
            if (el && el.offsetTop - container.offsetTop <= scrollTop) {
                setActiveSection(SECTIONS[i].id);
                break;
            }
        }
    };

    // Helpers for nested package editing
    const get3Pack = () => formState.threeSessionPackage || formState.threeSessionTotalCost !== undefined
        ? { totalCost: formState.threeSessionPackage?.totalCost ?? formState.threeSessionTotalCost ?? '', validity: formState.threeSessionPackage?.validity ?? formState.threeSessionValidity ?? '', discountedPrice: formState.threeSessionPackage?.discountedPrice ?? formState.threeSessionDiscountedPrice ?? '' }
        : { totalCost: '', validity: '', discountedPrice: '' };

    const get6Pack = () => formState.sixSessionPackage || formState.sixSessionTotalCost !== undefined
        ? { totalCost: formState.sixSessionPackage?.totalCost ?? formState.sixSessionTotalCost ?? '', validity: formState.sixSessionPackage?.validity ?? formState.sixSessionValidity ?? '', discountedPrice: formState.sixSessionPackage?.discountedPrice ?? formState.sixSessionDiscountedPrice ?? '' }
        : { totalCost: '', validity: '', discountedPrice: '' };

    const set3Pack = (field: string, value: string) => {
        if (mode === 'add') {
            update({ [`threeSession${field.charAt(0).toUpperCase() + field.slice(1)}`]: value });
        } else {
            const pkg = formState.threeSessionPackage || { totalCost: 0, validity: 90, discountedPrice: 0 };
            update({ threeSessionPackage: { ...pkg, [field]: Number(value) } });
        }
    };
    const set6Pack = (field: string, value: string) => {
        if (mode === 'add') {
            update({ [`sixSession${field.charAt(0).toUpperCase() + field.slice(1)}`]: value });
        } else {
            const pkg = formState.sixSessionPackage || { totalCost: 0, validity: 180, discountedPrice: 0 };
            update({ sixSessionPackage: { ...pkg, [field]: Number(value) } });
        }
    };

    const followUpVal = mode === 'edit' ? (formState.followUpDurationInput || '') : (formState.followUpDuration || '');
    const setFollowUp = (v: string) => mode === 'edit' ? update({ followUpDurationInput: v }) : update({ followUpDuration: v });

    const medMode = formState.medicineSelectionMode || 'choose';
    const maxMed = formState.maxMedicines !== undefined ? formState.maxMedicines : '';

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-[95vw] max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                {/* ── Sticky Header ── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
                    <button type="button" onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* ── 2-Column Body ── */}
                <form onSubmit={onSubmit} className="flex flex-1 min-h-0">
                    {/* Sidebar */}
                    <nav className="w-48 shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 py-4 px-2 overflow-y-auto hidden md:block">
                        {SECTIONS.map(s => (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => scrollToSection(s.id)}
                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1 ${activeSection === s.id
                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                            >
                                <s.icon className={`w-4 h-4 ${activeSection === s.id ? 'text-indigo-500' : s.color}`} />
                                {s.label}
                            </button>
                        ))}
                    </nav>

                    {/* Scrollable Content */}
                    <div ref={contentRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-6 space-y-6">

                        {/* ══ SECTION 1: Basic Info ══ */}
                        <section>
                            <SectionHeader id="basic" label="Basic Info" icon={FileText} color="text-gray-600" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Service Name *</label>
                                    <input required type="text" className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={formState.name || ''} onChange={e => update({ name: e.target.value })} />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium mb-1">Service Image</label>
                                    <div className="flex items-center gap-4">
                                        {formState.image && (
                                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 shrink-0">
                                                <img src={formState.image} alt="Preview" className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                        <label className="flex items-center gap-2 px-4 py-2 border border-dashed rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">
                                            <ImagePlus className="w-4 h-4 text-gray-400" />
                                            {uploadingImage ? 'Uploading...' : 'Upload'}
                                            <input type="file" accept="image/*" className="hidden" onChange={async e => {
                                                const f = e.target.files?.[0];
                                                if (f) { const url = await onImageUpload(f, 'service', formState.id || formState.name || 'new'); if (url) update({ image: url }); }
                                            }} />
                                        </label>
                                        {formState.image && <button type="button" onClick={() => update({ image: '' })} className="text-xs text-red-500">Remove</button>}
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium mb-1">Description</label>
                                    <textarea rows={2} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={formState.description || ''} onChange={e => update({ description: e.target.value })} placeholder="Describe the service..." />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Category</label>
                                    <select className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={formState.category || ''} onChange={e => update({ category: e.target.value })}>
                                        <option value="">Select Category</option>
                                        {BOOKING_CATEGORIES.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Duration (min) *</label>
                                    <input required type="number" step="15" min="15" className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={formState.duration || ''} onChange={e => update({ duration: mode === 'edit' ? Number(e.target.value) : e.target.value })} />
                                </div>
                            </div>
                        </section>

                        {/* ══ SECTION 2: Pricing ══ */}
                        <section>
                            <SectionHeader id="pricing" label="Pricing" icon={DollarSign} color="text-green-600" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Regular Price (AED) *</label>
                                    <input required type="number" min="0" className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={formState.regularPrice || ''} onChange={e => update({ regularPrice: mode === 'edit' ? (e.target.value ? Number(e.target.value) : undefined) : e.target.value })} placeholder="Original price" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Discounted Price (AED) *</label>
                                    <input required type="number" min="0" className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={formState.discountedPrice || ''} onChange={e => update({ discountedPrice: mode === 'edit' ? (e.target.value ? Number(e.target.value) : undefined) : e.target.value })} placeholder="Client pays this" />
                                </div>
                            </div>
                            <label className="flex items-center gap-2 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer mb-4">
                                <input type="checkbox" className="w-4 h-4 rounded text-indigo-600" checked={formState.isTaxable || false} onChange={e => update({ isTaxable: e.target.checked })} />
                                <span className="text-sm font-medium">Taxable Service ({currentClinic?.vatPercentage}% VAT)</span>
                            </label>
                            {/* 3-Session Package */}
                            <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50/50 dark:bg-blue-900/10 mb-3">
                                <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2">📦 3-Session Package</h4>
                                <div className="grid grid-cols-3 gap-3">
                                    <div><label className="block text-[11px] mb-1">Total Cost</label><input type="number" min="0" className="w-full p-1.5 border rounded text-xs dark:bg-gray-700 dark:border-gray-600" value={get3Pack().totalCost} onChange={e => set3Pack('totalCost', e.target.value)} /></div>
                                    <div><label className="block text-[11px] mb-1">Validity (Days)</label><input type="number" min="1" className="w-full p-1.5 border rounded text-xs dark:bg-gray-700 dark:border-gray-600" value={get3Pack().validity} onChange={e => set3Pack('validity', e.target.value)} /></div>
                                    <div><label className="block text-[11px] mb-1">Discounted</label><input type="number" min="0" className="w-full p-1.5 border rounded text-xs dark:bg-gray-700 dark:border-gray-600" value={get3Pack().discountedPrice} onChange={e => set3Pack('discountedPrice', e.target.value)} /></div>
                                </div>
                            </div>
                            {/* 6-Session Package */}
                            <div className="border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 bg-emerald-50/50 dark:bg-emerald-900/10">
                                <h4 className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-2">📦 6-Session Package</h4>
                                <div className="grid grid-cols-3 gap-3">
                                    <div><label className="block text-[11px] mb-1">Total Cost</label><input type="number" min="0" className="w-full p-1.5 border rounded text-xs dark:bg-gray-700 dark:border-gray-600" value={get6Pack().totalCost} onChange={e => set6Pack('totalCost', e.target.value)} /></div>
                                    <div><label className="block text-[11px] mb-1">Validity (Days)</label><input type="number" min="1" className="w-full p-1.5 border rounded text-xs dark:bg-gray-700 dark:border-gray-600" value={get6Pack().validity} onChange={e => set6Pack('validity', e.target.value)} /></div>
                                    <div><label className="block text-[11px] mb-1">Discounted</label><input type="number" min="0" className="w-full p-1.5 border rounded text-xs dark:bg-gray-700 dark:border-gray-600" value={get6Pack().discountedPrice} onChange={e => set6Pack('discountedPrice', e.target.value)} /></div>
                                </div>
                            </div>
                        </section>

                        {/* ══ SECTION 3: Care & Follow-up ══ */}
                        <section>
                            <SectionHeader id="care" label="Care & Follow-up" icon={Heart} color="text-pink-600" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Pre-Procedure Care</label>
                                    <textarea rows={3} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={formState.preCare || ''} onChange={e => update({ preCare: e.target.value })} placeholder="Instructions before..." />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Post-Procedure Care</label>
                                    <textarea rows={3} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={formState.postCare || ''} onChange={e => update({ postCare: e.target.value })} placeholder="Instructions after..." />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Free Follow-up (Days)</label>
                                    <input type="number" min="0" className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={followUpVal} onChange={e => setFollowUp(e.target.value)} placeholder="Optional" />
                                </div>
                            </div>
                        </section>

                        {/* ══ SECTION 4: Scheduling ══ */}
                        <section>
                            <SectionHeader id="scheduling" label="Scheduling" icon={Clock} color="text-blue-600" />
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-2">Allowed Days</label>
                                <div className="flex gap-2 flex-wrap">
                                    {dayNames.map((day, idx) => (
                                        <button key={day} type="button" onClick={() => onToggleDay(idx)}
                                            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${(formState.allowedDays || []).includes(idx)
                                                ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                                            {day}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">None selected = all days allowed.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Start Time</label>
                                    <input type="time" className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={formState.timeWindowStart || ''} onChange={e => update({ timeWindowStart: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">End Time</label>
                                    <input type="time" className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={formState.timeWindowEnd || ''} onChange={e => update({ timeWindowEnd: e.target.value })} />
                                </div>
                            </div>
                        </section>

                        {/* ══ SECTION 5: Restrictions ══ */}
                        <section>
                            <SectionHeader id="restrictions" label="Restrictions" icon={Shield} color="text-orange-600" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Allowed Gender</label>
                                    <select className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={formState.allowedGender || 'both'} onChange={e => update({ allowedGender: e.target.value })}>
                                        <option value="both">Both (All Genders)</option>
                                        <option value="male">Male Only</option>
                                        <option value="female">Female Only</option>
                                    </select>
                                </div>
                            </div>
                            {/* Doctor Selection */}
                            {(mode === 'edit' || formState.departmentId) && (
                                <div className="mt-4">
                                    <label className="block text-sm font-medium mb-2">Allowed Doctors</label>
                                    <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-1.5">
                                        {doctors.map(doc => (
                                            <label key={doc.id} className="flex items-center gap-2 cursor-pointer text-sm">
                                                <input type="checkbox" checked={(formState.allowedDoctorIds || []).includes(doc.id)} onChange={() => onToggleDoctor(doc.id)} className="rounded text-indigo-600" />
                                                {doc.name}
                                            </label>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Unchecked = all doctors allowed.</p>
                                </div>
                            )}
                        </section>

                        {/* ══ SECTION 6: Inventory ══ */}
                        <section>
                            <SectionHeader id="inventory" label="Inventory" icon={Package} color="text-purple-600" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Medicine Selection Mode</label>
                                    <select className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={medMode} onChange={e => update({ medicineSelectionMode: e.target.value })}>
                                        <option value="choose">Choose up to N</option>
                                        <option value="either">Pick exactly 1</option>
                                        <option value="all">All required</option>
                                    </select>
                                </div>
                                {medMode === 'choose' && (
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Max Medicines</label>
                                        <input type="number" min="0" className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                                            value={maxMed} onChange={e => update({ maxMedicines: mode === 'edit' ? (e.target.value ? Number(e.target.value) : undefined) : e.target.value })} placeholder="0 = none" />
                                    </div>
                                )}
                            </div>
                            {/* Resources */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-2">Required Resources</label>
                                <div className="border rounded-lg p-3 max-h-36 overflow-y-auto space-y-1.5">
                                    {resources.map(res => (
                                        <label key={res.id} className="flex items-center gap-2 cursor-pointer text-sm">
                                            <input type="checkbox" checked={(formState.requiredResourceIds || []).includes(res.id)} onChange={e => {
                                                const c = formState.requiredResourceIds || [];
                                                update({ requiredResourceIds: e.target.checked ? [...c, res.id] : c.filter((id: string) => id !== res.id) });
                                            }} className="rounded text-indigo-600" />
                                            {res.name} ({res.type})
                                        </label>
                                    ))}
                                    {resources.length === 0 && <p className="text-xs text-gray-500">No resources for this clinic.</p>}
                                </div>
                            </div>
                            {/* Medicines */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-2">Linked Medicines</label>
                                <div className="border rounded-lg p-3 max-h-36 overflow-y-auto space-y-1.5">
                                    {medicines.filter(m => m.category !== 'consumable').map(med => (
                                        <label key={med.id} className="flex items-center gap-2 cursor-pointer text-sm">
                                            <input type="checkbox" checked={(formState.medicineIds || []).includes(med.id)} onChange={e => {
                                                const c = formState.medicineIds || [];
                                                update({ medicineIds: e.target.checked ? [...c, med.id] : c.filter((id: string) => id !== med.id) });
                                            }} className="rounded text-teal-600" />
                                            {med.name} <span className="text-xs text-gray-400 ml-auto">{med.price} AED</span>
                                        </label>
                                    ))}
                                    {medicines.filter(m => m.category !== 'consumable').length === 0 && <p className="text-xs text-gray-500">No medicines found.</p>}
                                </div>
                            </div>
                            {/* Consumables */}
                            <div>
                                <label className="block text-sm font-medium mb-2">Linked Consumables (auto-deducted)</label>
                                <div className="border rounded-lg p-3 max-h-36 overflow-y-auto space-y-1.5">
                                    {medicines.filter(m => m.category === 'consumable').map(med => (
                                        <label key={med.id} className="flex items-center gap-2 cursor-pointer text-sm">
                                            <input type="checkbox" checked={(formState.consumableIds || []).includes(med.id)} onChange={e => {
                                                const c = formState.consumableIds || [];
                                                update({ consumableIds: e.target.checked ? [...c, med.id] : c.filter((id: string) => id !== med.id) });
                                            }} className="rounded text-orange-600" />
                                            {med.name}
                                        </label>
                                    ))}
                                    {medicines.filter(m => m.category === 'consumable').length === 0 && <p className="text-xs text-gray-500">No consumables found.</p>}
                                </div>
                            </div>
                            {/* Product Consumptions — links to RegisteredProduct with quantity */}
                            <div className="mt-4 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 bg-indigo-50/50 dark:bg-indigo-900/10">
                                <h4 className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 mb-2">📦 Product Consumption per Service</h4>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-3">Define which registered products are consumed each time this service is performed.</p>
                                {(formState.productConsumptions || []).map((pc: any, idx: number) => (
                                    <div key={idx} className="flex items-center gap-2 mb-2">
                                        <select className="flex-1 p-1.5 border rounded text-xs dark:bg-gray-700 dark:border-gray-600"
                                            value={pc.registeredProductId || ''}
                                            onChange={e => {
                                                const u = [...(formState.productConsumptions || [])];
                                                u[idx] = { ...u[idx], registeredProductId: e.target.value };
                                                update({ productConsumptions: u });
                                            }}>
                                            <option value="">— Select Product —</option>
                                            {(registeredProducts || []).map(rp => (
                                                <option key={rp.id} value={rp.id}>{rp.tradeName} ({rp.category || 'Uncategorized'})</option>
                                            ))}
                                        </select>
                                        <input type="number" min="0.1" step="0.1" placeholder="Qty" className="w-20 p-1.5 border rounded text-xs dark:bg-gray-700 dark:border-gray-600"
                                            value={pc.quantityPerService || ''}
                                            onChange={e => {
                                                const u = [...(formState.productConsumptions || [])];
                                                u[idx] = { ...u[idx], quantityPerService: Number(e.target.value) };
                                                update({ productConsumptions: u });
                                            }} />
                                        <button type="button" onClick={() => {
                                            update({ productConsumptions: (formState.productConsumptions || []).filter((_: any, i: number) => i !== idx) });
                                        }} className="text-red-500 hover:text-red-700 px-1">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                                <button type="button" onClick={() => update({ productConsumptions: [...(formState.productConsumptions || []), { registeredProductId: '', quantityPerService: 1 }] })}
                                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 mt-1">
                                    <Plus className="w-3 h-3" /> Add Product
                                </button>
                            </div>
                        </section>

                        {/* ══ SECTION 7: Extras ══ */}
                        <section>
                            <SectionHeader id="extras" label="Extras" icon={Sparkles} color="text-violet-600" />
                            {/* Screening Questions */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-2">Screening Questions (YES = Blocked)</label>
                                <div className="space-y-2 mb-2">
                                    {(formState.screeningQuestions || []).map((q: string, idx: number) => (
                                        <div key={idx} className="flex gap-2">
                                            <input type="text" className="flex-1 p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm" value={q}
                                                onChange={e => { const nq = [...(formState.screeningQuestions || [])]; nq[idx] = e.target.value; update({ screeningQuestions: nq }); }} />
                                            <button type="button" onClick={() => update({ screeningQuestions: (formState.screeningQuestions || []).filter((_: any, i: number) => i !== idx) })}
                                                className="text-red-500 hover:text-red-700 font-bold px-2">✕</button>
                                        </div>
                                    ))}
                                </div>
                                <button type="button" onClick={() => update({ screeningQuestions: [...(formState.screeningQuestions || []), ''] })}
                                    className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">+ Add Question</button>
                            </div>
                            {/* Add-ons */}
                            <div>
                                <label className="block text-sm font-medium mb-2">Service Add-ons (Procedure + Area)</label>
                                <div className="space-y-2">
                                    {(formState.addOns || []).map((ao: ServiceAddOn, idx: number) => (
                                        <div key={ao.id} className="flex items-center gap-2 p-2 border rounded-lg bg-gray-50 dark:bg-gray-700/30">
                                            <select className="flex-1 p-1.5 text-sm border rounded dark:bg-gray-700 dark:border-gray-600"
                                                value={ao.procedure} onChange={e => { const u = [...(formState.addOns || [])]; u[idx] = { ...u[idx], procedure: e.target.value }; update({ addOns: u }); }}>
                                                <option value="">Procedure...</option>
                                                {['Shaving', 'Microneedling', 'PRP Injection', 'Mesotherapy', 'Chemical Peel', 'Laser', 'Cryotherapy'].map(p => <option key={p} value={p}>{p}</option>)}
                                            </select>
                                            <select className="flex-1 p-1.5 text-sm border rounded dark:bg-gray-700 dark:border-gray-600"
                                                value={ao.area} onChange={e => { const u = [...(formState.addOns || [])]; u[idx] = { ...u[idx], area: e.target.value }; update({ addOns: u }); }}>
                                                <option value="">Area...</option>
                                                {['Face', 'Neck', 'Hair', 'Scalp', 'Under Eyes', 'Full Body', 'Hands', 'Legs', 'Arms', 'Back'].map(a => <option key={a} value={a}>{a}</option>)}
                                            </select>
                                            <input type="number" min="0" step="0.01" placeholder="Price" className="w-20 p-1.5 text-sm border rounded dark:bg-gray-700 dark:border-gray-600"
                                                value={ao.price || ''} onChange={e => { const u = [...(formState.addOns || [])]; u[idx] = { ...u[idx], price: Number(e.target.value) }; update({ addOns: u }); }} />
                                            <button type="button" onClick={() => update({ addOns: (formState.addOns || []).filter((_: any, i: number) => i !== idx) })}
                                                className="text-red-500 hover:text-red-700 font-bold px-1">✕</button>
                                        </div>
                                    ))}
                                </div>
                                <button type="button" onClick={() => update({ addOns: [...(formState.addOns || []), { id: `ao-${Date.now()}`, procedure: '', area: '', price: 0 }] })}
                                    className="text-sm text-violet-600 hover:text-violet-800 font-medium mt-2">+ Add Add-on</button>
                            </div>
                        </section>
                    </div>

                    {/* ── Sticky Footer ── */}
                    <div className="absolute bottom-0 left-0 right-0 flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium">Cancel</button>
                        <button type="submit" disabled={submitting} className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-50">
                            {submitting ? (mode === 'add' ? 'Adding...' : 'Saving...') : (mode === 'add' ? 'Add Service' : 'Save Changes')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AddonService, AddonConsumable } from '@/lib/addon-services-store';
import { Zap, Plus, Pencil, Trash2, X, Check, Package, AlertTriangle, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, RefreshCw, GripVertical, Lock } from 'lucide-react';

interface Medicine { id: string; name: string; centralStock: number; }
interface InventoryBatch { id: string; batchNumber: string; quantity: number; expiryDate?: string; }

const GROUP_ICONS: Record<string, string> = {
    'Shaving': '✂️',
    'Numbing Application': '💊',
    'Other': '⚡',
};
const PRESET_GROUPS = ['Shaving', 'Numbing Application', 'Other'];

export default function AddonServicesPage() {
    const [addons, setAddons] = useState<AddonService[]>([]);
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [batchesMap, setBatchesMap] = useState<Record<string, InventoryBatch[]>>({});
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAddon, setEditingAddon] = useState<AddonService | null>(null);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    // RBAC
    const [user, setUser] = useState<any>(null);
    const [userReady, setUserReady] = useState(false);
    useEffect(() => {
        try { setUser(JSON.parse(sessionStorage.getItem('adminUser') || '{}')); } catch { }
        setUserReady(true);
    }, []);
    const isSuperAdmin = user?.role === 'SUPER_ADMIN';
    const isAdmin      = user?.role === 'ADMIN';
    // Grant full access to SUPER_ADMIN and ADMIN; other roles need explicit billing permissions
    const canCreate = !userReady || isSuperAdmin || isAdmin || !!user?.permissions?.billing?.includes('create');
    const canEdit   = !userReady || isSuperAdmin || isAdmin || !!user?.permissions?.billing?.includes('edit');
    const canDelete = !userReady || isSuperAdmin || isAdmin || !!user?.permissions?.billing?.includes('delete');


    // Drag-to-reorder state
    const dragId = useRef<string | null>(null);
    const dragOverId = useRef<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragOver, setDragOver] = useState<string | null>(null);

    // Form state
    const [formName, setFormName] = useState('');
    const [formGroup, setFormGroup] = useState('Shaving');
    const [formGroupCustom, setFormGroupCustom] = useState('');
    const [formPrice, setFormPrice] = useState(0);
    const [formActive, setFormActive] = useState(true);
    const [formConsumables, setFormConsumables] = useState<AddonConsumable[]>([]);

    const load = async () => {
        setLoading(true);
        try {
            const [addonsRes, medsRes] = await Promise.all([
                fetch('/api/admin/addon-services'),
                fetch('/api/admin/medicines'),
            ]);
            const addonsData = await addonsRes.json();
            const medsData = await medsRes.json();
            setAddons(Array.isArray(addonsData) ? addonsData : []);
            setMedicines(Array.isArray(medsData) ? medsData : []);
            const groups = new Set<string>((Array.isArray(addonsData) ? addonsData : []).map((a: AddonService) => a.group));
            setExpandedGroups(groups);
        } catch { } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const fetchBatches = async (medicineId: string) => {
        if (batchesMap[medicineId]) return;
        try {
            const res = await fetch(`/api/admin/inventory-batches?medicineId=${medicineId}&active=true`);
            const data = await res.json();
            setBatchesMap(prev => ({ ...prev, [medicineId]: Array.isArray(data) ? data : [] }));
        } catch { }
    };

    const openCreate = () => {
        if (!canCreate) return;
        setEditingAddon(null);
        setFormName(''); setFormGroup('Shaving'); setFormGroupCustom('');
        setFormPrice(0); setFormActive(true); setFormConsumables([]);
        setIsModalOpen(true);
    };

    const openEdit = (addon: AddonService) => {
        if (!canEdit) return;
        setEditingAddon(addon);
        setFormName(addon.name);
        const isPreset = PRESET_GROUPS.includes(addon.group);
        setFormGroup(isPreset ? addon.group : 'Other');
        setFormGroupCustom(isPreset ? '' : addon.group);
        setFormPrice(addon.defaultPrice);
        setFormActive(addon.isActive);
        setFormConsumables([...addon.linkedConsumables]);
        addon.linkedConsumables.forEach(c => fetchBatches(c.medicineId));
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        const finalGroup = formGroup === 'Other' ? (formGroupCustom.trim() || 'Other') : formGroup;
        const payload = {
            name: formName.trim(), group: finalGroup,
            defaultPrice: formPrice,
            linkedConsumables: formConsumables.filter(c => c.medicineId),
            isActive: formActive,
        };
        if (!payload.name || !payload.group) return;
        setSaving(true);
        try {
            const url = editingAddon ? `/api/admin/addon-services/${editingAddon.id}` : '/api/admin/addon-services';
            const method = editingAddon ? 'PUT' : 'POST';
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (res.ok) { await load(); setIsModalOpen(false); }
        } catch { } finally { setSaving(false); }
    };

    const handleDelete = async (id: string) => {
        if (!canDelete) return;
        try { await fetch(`/api/admin/addon-services/${id}`, { method: 'DELETE' }); await load(); } catch { }
        setDeleteConfirm(null);
    };

    const handleToggleActive = async (addon: AddonService) => {
        if (!canEdit) return;
        try {
            await fetch(`/api/admin/addon-services/${addon.id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !addon.isActive }),
            });
            await load();
        } catch { }
    };

    // ── Drag-and-drop reorder ──
    const handleDragStart = (id: string) => {
        dragId.current = id;
        setIsDragging(true);
    };

    const handleDragOver = (e: React.DragEvent, id: string) => {
        e.preventDefault();
        dragOverId.current = id;
        setDragOver(id);
    };

    const handleDrop = async (e: React.DragEvent, group: string) => {
        e.preventDefault();
        const fromId = dragId.current;
        const toId   = dragOverId.current;
        dragId.current = null; dragOverId.current = null;
        setIsDragging(false); setDragOver(null);
        if (!fromId || !toId || fromId === toId) return;

        // Reorder within the full flat list keeping group membership
        const newAddons = [...addons];
        const fromIdx = newAddons.findIndex(a => a.id === fromId);
        const toIdx   = newAddons.findIndex(a => a.id === toId);
        if (fromIdx === -1 || toIdx === -1) return;

        // Move the dragged item to the dragged-over position, updating its group
        const [moved] = newAddons.splice(fromIdx, 1);
        moved.group = group; // allow cross-group moves
        newAddons.splice(toIdx, 0, moved);
        setAddons(newAddons);

        try {
            await fetch('/api/admin/addon-services/reorder', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: newAddons.map(a => a.id) }),
            });
        } catch { /* optimistic — reload on next refresh */ }
    };

    const handleDragEnd = () => { setIsDragging(false); setDragOver(null); dragId.current = null; dragOverId.current = null; };

    const addConsumable = () => setFormConsumables(prev => [...prev, { medicineId: '', medicineName: '', quantityPerService: 1 }]);
    const updateConsumable = (idx: number, updates: Partial<AddonConsumable>) => {
        setFormConsumables(prev => { const n = [...prev]; n[idx] = { ...n[idx], ...updates }; return n; });
    };
    const removeConsumable = (idx: number) => setFormConsumables(prev => prev.filter((_, i) => i !== idx));

    const grouped = addons.reduce<Record<string, AddonService[]>>((acc, a) => {
        if (!acc[a.group]) acc[a.group] = [];
        acc[a.group].push(a);
        return acc;
    }, {});

    const totalActive = addons.filter(a => a.isActive).length;
    const totalLinked = addons.filter(a => a.linkedConsumables.length > 0).length;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
            <div className="max-w-4xl mx-auto">

                {/* Header */}
                <header className="mb-6 flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
                                <Zap className="w-4 h-4 text-white" />
                            </div>
                            Add-on Services
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Configure billable add-ons linked to consumables for automatic stock deduction.
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs">
                            <span className="text-emerald-600 font-medium">{totalActive} active</span>
                            <span className="text-blue-600 font-medium">{totalLinked} with stock link</span>
                            <span className="text-gray-400">{addons.length} total</span>
                            {!canEdit && <span className="text-amber-600 flex items-center gap-1"><Lock className="w-3 h-3" /> Read-only access</span>}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button onClick={load} className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                            <RefreshCw className="w-4 h-4 text-gray-500" />
                        </button>
                        {canCreate ? (
                            <button onClick={openCreate} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl font-medium text-sm transition-colors shadow-sm">
                                <Plus className="w-4 h-4" /> New Add-on
                            </button>
                        ) : (
                            <span className="flex items-center gap-1.5 text-xs text-gray-400 border border-gray-200 px-3 py-2 rounded-xl">
                                <Lock className="w-3.5 h-3.5" /> No create permission
                            </span>
                        )}
                    </div>
                </header>

                {/* Info Banner */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6 flex items-start gap-3">
                    <Package className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                        <strong>How it works:</strong> When a staff member selects an add-on in billing, linked consumables are auto-deducted from stock.
                        {canEdit && <span className="ml-1 text-blue-500">Drag the <GripVertical className="w-3 h-3 inline" /> handle to reorder within each group.</span>}
                    </div>
                </div>

                {/* Add-on List */}
                {loading ? (
                    <div className="space-y-4">
                        {[1, 2].map(i => (
                            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 animate-pulse">
                                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-3" />
                                <div className="space-y-2">{[1, 2, 3].map(j => <div key={j} className="h-12 bg-gray-100 dark:bg-gray-700 rounded-lg" />)}</div>
                            </div>
                        ))}
                    </div>
                ) : addons.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
                        <Zap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No add-on services configured yet.</p>
                        {canCreate && <button onClick={openCreate} className="mt-3 text-sm text-violet-600 hover:underline">Create your first add-on →</button>}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {Object.entries(grouped).map(([group, items]) => {
                            const isExpanded = expandedGroups.has(group);
                            return (
                                <div key={group} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                                    {/* Group Header */}
                                    <button
                                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                                        onClick={() => setExpandedGroups(prev => {
                                            const n = new Set(prev);
                                            if (n.has(group)) n.delete(group); else n.add(group);
                                            return n;
                                        })}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">{GROUP_ICONS[group] || '⚡'}</span>
                                            <span className="font-semibold text-gray-900 dark:text-white">{group}</span>
                                            <span className="text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full font-medium">
                                                {items.length} add-on{items.length !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                    </button>

                                    {/* Add-on rows */}
                                    {isExpanded && (
                                        <div
                                            className="border-t border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700/50"
                                            onDragOver={e => e.preventDefault()}
                                            onDrop={e => handleDrop(e, group)}
                                        >
                                            {items.map(addon => (
                                                <div
                                                    key={addon.id}
                                                    draggable={canEdit}
                                                    onDragStart={() => handleDragStart(addon.id)}
                                                    onDragOver={e => handleDragOver(e, addon.id)}
                                                    onDragEnd={handleDragEnd}
                                                    className={`p-4 flex items-start gap-3 transition-all
                                                        ${!addon.isActive ? 'opacity-50' : ''}
                                                        ${dragOver === addon.id ? 'bg-violet-50 dark:bg-violet-900/20 border-l-4 border-l-violet-500' : ''}
                                                        ${isDragging && dragId.current === addon.id ? 'opacity-30' : ''}
                                                    `}
                                                >
                                                    {/* Drag Handle */}
                                                    {canEdit && (
                                                        <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 pt-1 shrink-0">
                                                            <GripVertical className="w-4 h-4" />
                                                        </div>
                                                    )}

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-medium text-gray-900 dark:text-white text-sm">{addon.name}</span>
                                                            <span className="text-xs font-bold text-violet-600 dark:text-violet-400">{addon.defaultPrice} AED</span>
                                                            {!addon.isActive && (
                                                                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">Inactive</span>
                                                            )}
                                                        </div>
                                                        {addon.linkedConsumables.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                                {addon.linkedConsumables.map((c, ci) => (
                                                                    <span key={ci} className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                                                                        <Package className="w-2.5 h-2.5" />
                                                                        {c.medicineName} × {c.quantityPerService}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                                                                <AlertTriangle className="w-3 h-3" /> No consumables linked — stock won&apos;t be deducted
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-1 shrink-0">
                                                        {canEdit && (
                                                            <button
                                                                onClick={() => handleToggleActive(addon)}
                                                                title={addon.isActive ? 'Deactivate' : 'Activate'}
                                                                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                            >
                                                                {addon.isActive
                                                                    ? <ToggleRight className="w-5 h-5 text-emerald-500" />
                                                                    : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                                                            </button>
                                                        )}
                                                        {canEdit && (
                                                            <button onClick={() => openEdit(addon)} className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-600 transition-colors">
                                                                <Pencil className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {canDelete && (
                                                            deleteConfirm === addon.id ? (
                                                                <div className="flex items-center gap-1">
                                                                    <button onClick={() => handleDelete(addon.id)} className="p-1 rounded text-red-600 hover:bg-red-50 text-xs font-bold">Yes</button>
                                                                    <button onClick={() => setDeleteConfirm(null)} className="p-1 rounded text-gray-500 hover:bg-gray-100 text-xs">No</button>
                                                                </div>
                                                            ) : (
                                                                <button onClick={() => setDeleteConfirm(addon.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors">
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Create / Edit Modal ── */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 p-5 text-white">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Zap className="w-5 h-5" />
                                    <h2 className="text-lg font-bold">{editingAddon ? 'Edit Add-on' : 'New Add-on Service'}</h2>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Service Name *</label>
                                <input type="text" placeholder="e.g. Shaving – Full Body"
                                    className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                    value={formName} onChange={e => setFormName(e.target.value)} />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Group *</label>
                                    <select className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                        value={formGroup} onChange={e => setFormGroup(e.target.value)}>
                                        {PRESET_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                    {formGroup === 'Other' && (
                                        <input type="text" placeholder="Custom group name"
                                            className="w-full mt-1.5 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                            value={formGroupCustom} onChange={e => setFormGroupCustom(e.target.value)} />
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Default Price (AED) *</label>
                                    <input type="number" min="0"
                                        className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                        value={formPrice} onChange={e => setFormPrice(Number(e.target.value))} />
                                </div>
                            </div>

                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" className="sr-only" checked={formActive} onChange={e => setFormActive(e.target.checked)} />
                                <div className={`w-10 h-5 rounded-full transition-colors ${formActive ? 'bg-emerald-500' : 'bg-gray-300'} relative`}>
                                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${formActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                </div>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {formActive ? 'Active — visible in billing' : 'Inactive — hidden from billing'}
                                </span>
                            </label>

                            {/* Linked Consumables */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                        <Package className="w-4 h-4 text-emerald-600" />
                                        Linked Consumables
                                        <span className="text-[11px] font-normal text-gray-400">(auto-deducted from stock on billing)</span>
                                    </label>
                                    <button type="button" onClick={addConsumable} className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold flex items-center gap-1">
                                        <Plus className="w-3.5 h-3.5" /> Add
                                    </button>
                                </div>

                                {formConsumables.length === 0 ? (
                                    <div className="text-center py-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                                        <p className="text-xs text-gray-400">No consumables linked.</p>
                                        <p className="text-[11px] text-amber-500 mt-0.5">Stock won&apos;t be auto-deducted without linked consumables.</p>
                                        <button type="button" onClick={addConsumable} className="mt-2 text-xs text-emerald-600 hover:underline">+ Link a consumable</button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {formConsumables.map((cons, idx) => (
                                            <div key={idx} className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 flex gap-2 items-start">
                                                <div className="flex-1 min-w-0 grid grid-cols-3 gap-2">
                                                    <div className="col-span-2">
                                                        <label className="block text-[10px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wider">Medicine / Consumable</label>
                                                        <select
                                                            className="w-full p-1.5 border border-emerald-300 dark:border-emerald-700 rounded-lg text-xs bg-white dark:bg-gray-800 focus:outline-none"
                                                            value={cons.medicineId}
                                                            onChange={e => {
                                                                const med = medicines.find(m => m.id === e.target.value);
                                                                updateConsumable(idx, { medicineId: e.target.value, medicineName: med?.name || '' });
                                                                if (e.target.value) fetchBatches(e.target.value);
                                                            }}
                                                        >
                                                            <option value="">— Select medicine —</option>
                                                            {medicines.map(m => <option key={m.id} value={m.id}>{m.name} (Stock: {m.centralStock})</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wider">Qty / Service</label>
                                                        <input type="number" min="0.1" step="0.1"
                                                            className="w-full p-1.5 border border-emerald-300 dark:border-emerald-700 rounded-lg text-xs bg-white dark:bg-gray-800 focus:outline-none"
                                                            value={cons.quantityPerService}
                                                            onChange={e => updateConsumable(idx, { quantityPerService: Number(e.target.value) })} />
                                                    </div>
                                                </div>
                                                <button type="button" onClick={() => removeConsumable(idx)} className="mt-4 p-1 text-red-400 hover:text-red-600 rounded">
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800/80">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-sm transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleSave} disabled={saving || !formName.trim()}
                                className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-2 transition-colors">
                                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                {editingAddon ? 'Save Changes' : 'Create Add-on'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

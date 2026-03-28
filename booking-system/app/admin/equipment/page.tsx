'use client';

import React, { useState, useEffect } from 'react';
import {
    Plus, Search, Edit2, Trash2, ArrowLeftRight, History, AlertTriangle, Wrench,
    Package, MapPin, Filter, X, ChevronDown, ChevronUp, Calendar, Shield
} from 'lucide-react';
import { User } from '@/lib/users-types';

interface EquipmentItem {
    id: string;
    name: string;
    category: string;
    brand: string;
    serialNumber: string;
    quantity: number;
    branchId: string;
    purchaseDate: string;
    warrantyExpiry: string;
    status: 'active' | 'maintenance' | 'damaged' | 'disposed';
    assignedDepartment: string;
    notes: string;
    lowStockThreshold: number;
    nextMaintenanceDate?: string;
}

interface HistoryEntry {
    id: string;
    equipmentId: string;
    action: string;
    fromBranch?: string;
    toBranch?: string;
    notes: string;
    timestamp: string;
    quantityChanged?: number;
}

interface Branch { id: string; name: string; }

const BRANCHES: Branch[] = [
    { id: 'clinic-1', name: 'Al Muraqabat Branch' },
    { id: 'clinic-2', name: 'Al Qiyadah Branch' },
    { id: 'clinic-3', name: 'Silicon Oasis Branch' },
];

const CATEGORIES = [
    'Medical Device', 'Laser Equipment', 'Diagnostic', 'Surgical Instrument',
    'Infection Control', 'Furniture', 'IT Equipment', 'Other'
];

const STATUS_OPTIONS: { value: EquipmentItem['status']; label: string; color: string }[] = [
    { value: 'active', label: 'Active', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    { value: 'maintenance', label: 'Under Maintenance', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    { value: 'damaged', label: 'Damaged', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    { value: 'disposed', label: 'Disposed', color: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
];

const branchName = (id: string) => BRANCHES.find(b => b.id === id)?.name || id;

const emptyForm: Omit<EquipmentItem, 'id'> = {
    name: '', category: '', brand: '', serialNumber: '', quantity: 1,
    branchId: BRANCHES[0].id, purchaseDate: '', warrantyExpiry: '',
    status: 'active', assignedDepartment: '', notes: '', lowStockThreshold: 1,
    nextMaintenanceDate: '',
};

export default function EquipmentPage() {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [items, setItems] = useState<EquipmentItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [filterBranch, setFilterBranch] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [formData, setFormData] = useState(emptyForm);
    const [editingId, setEditingId] = useState('');
    const [transferItem, setTransferItem] = useState<EquipmentItem | null>(null);
    const [transferBranch, setTransferBranch] = useState('');
    const [transferQty, setTransferQty] = useState(1);
    const [transferNotes, setTransferNotes] = useState('');
    const [historyData, setHistoryData] = useState<HistoryEntry[]>([]);
    const [historyItemName, setHistoryItemName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [dashboardOpen, setDashboardOpen] = useState(true);

    // ── Fetch ──
    const fetchItems = async () => {
        try {
            const res = await fetch(`/api/admin/equipment?_t=${Date.now()}`, { cache: 'no-store' });
            const data = await res.json();
            if (Array.isArray(data)) setItems(data);
        } catch { /* ignore */ } finally { setLoading(false); }
    };

    useEffect(() => {
        const userStr = sessionStorage.getItem('adminUser');
        if (userStr) {
            try { setCurrentUser(JSON.parse(userStr)); } catch (e) {}
        }
        fetchItems();
    }, []);

    // ── Filtered list ──
    const filtered = items.filter(i => {
        // Enforce RBAC Branch Scoping
        if (currentUser && currentUser.role !== 'SUPER_ADMIN') {
            if (!currentUser.clinicIds?.includes(i.branchId)) return false;
        }

        if (filterBranch && i.branchId !== filterBranch) return false;
        if (filterCategory && i.category !== filterCategory) return false;
        if (filterStatus && i.status !== filterStatus) return false;
        if (searchTerm && !i.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
            !i.serialNumber.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
    });

    // ── RBAC Safe Stats ──
    const safeItems = items.filter(i => {
        if (currentUser && currentUser.role !== 'SUPER_ADMIN') {
            return currentUser.clinicIds?.includes(i.branchId);
        }
        return true;
    });

    const totalCount = safeItems.length;
    const totalQty = safeItems.reduce((s, i) => s + i.quantity, 0);
    const branchCounts = BRANCHES
        .filter(b => currentUser?.role === 'SUPER_ADMIN' || currentUser?.clinicIds?.includes(b.id))
        .map(b => ({ ...b, count: safeItems.filter(i => i.branchId === b.id).length }));
    const maintenanceCount = safeItems.filter(i => i.status === 'maintenance').length;
    const damagedCount = safeItems.filter(i => i.status === 'damaged').length;
    const lowStockItems = safeItems.filter(i => i.quantity <= i.lowStockThreshold && i.status === 'active');
    const today = new Date();
    const in7Days = new Date(today.getTime() + 7 * 86400000);
    const maintenanceDue = safeItems.filter(i => i.nextMaintenanceDate && new Date(i.nextMaintenanceDate) <= in7Days && i.status === 'active');

    // ── Handlers ──
    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await fetch('/api/admin/equipment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            await fetchItems();
            setShowAddModal(false);
            setFormData(emptyForm);
        } catch { /* ignore */ } finally { setSubmitting(false); }
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await fetch('/api/admin/equipment', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: editingId, ...formData }),
            });
            await fetchItems();
            setShowEditModal(false);
        } catch { /* ignore */ } finally { setSubmitting(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this equipment item?')) return;
        await fetch(`/api/admin/equipment?id=${id}`, { method: 'DELETE' });
        await fetchItems();
    };

    const openEdit = (item: EquipmentItem) => {
        setEditingId(item.id);
        setFormData({
            name: item.name, category: item.category, brand: item.brand,
            serialNumber: item.serialNumber, quantity: item.quantity,
            branchId: item.branchId, purchaseDate: item.purchaseDate,
            warrantyExpiry: item.warrantyExpiry, status: item.status,
            assignedDepartment: item.assignedDepartment, notes: item.notes,
            lowStockThreshold: item.lowStockThreshold,
            nextMaintenanceDate: item.nextMaintenanceDate || '',
        });
        setShowEditModal(true);
    };

    const openTransfer = (item: EquipmentItem) => {
        setTransferItem(item);
        setTransferBranch(BRANCHES.find(b => b.id !== item.branchId)?.id || '');
        setTransferQty(1);
        setTransferNotes('');
        setShowTransferModal(true);
    };

    const handleTransfer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!transferItem) return;
        setSubmitting(true);
        try {
            await fetch('/api/admin/equipment', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'transfer',
                    id: transferItem.id,
                    toBranchId: transferBranch,
                    quantity: transferQty,
                    notes: transferNotes,
                }),
            });
            await fetchItems();
            setShowTransferModal(false);
        } catch { /* ignore */ } finally { setSubmitting(false); }
    };

    const openHistory = async (item: EquipmentItem) => {
        setHistoryItemName(item.name);
        setShowHistoryModal(true);
        try {
            const res = await fetch(`/api/admin/equipment?historyFor=${item.id}`);
            const data = await res.json();
            setHistoryData(Array.isArray(data) ? data : []);
        } catch { setHistoryData([]); }
    };

    const statusBadge = (status: string) => {
        const s = STATUS_OPTIONS.find(o => o.value === status);
        return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s?.color || ''}`}>{s?.label || status}</span>;
    };

    // ── Form fields (shared by Add and Edit) ──
    const renderFormFields = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium mb-1">Equipment Name *</label>
                <input required type="text" className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">Category *</label>
                <select required className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                    <option value="">Select Category</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">Brand / Model</label>
                <input type="text" className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value })} />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">Serial Number</label>
                <input type="text" className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    value={formData.serialNumber} onChange={e => setFormData({ ...formData, serialNumber: e.target.value })} />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">Quantity *</label>
                <input required type="number" min="1" className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })} />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">Low Stock Threshold</label>
                <input type="number" min="0" className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    value={formData.lowStockThreshold} onChange={e => setFormData({ ...formData, lowStockThreshold: Number(e.target.value) })} />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">Branch *</label>
                <select required className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    value={formData.branchId} onChange={e => setFormData({ ...formData, branchId: e.target.value })}>
                    {BRANCHES.filter(b => currentUser?.role === 'SUPER_ADMIN' || currentUser?.clinicIds?.includes(b.id)).map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as EquipmentItem['status'] })}>
                    {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">Purchase Date</label>
                <input type="date" className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    value={formData.purchaseDate} onChange={e => setFormData({ ...formData, purchaseDate: e.target.value })} />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">Warranty Expiry</label>
                <input type="date" className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    value={formData.warrantyExpiry} onChange={e => setFormData({ ...formData, warrantyExpiry: e.target.value })} />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">Next Maintenance Date</label>
                <input type="date" className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    value={formData.nextMaintenanceDate || ''} onChange={e => setFormData({ ...formData, nextMaintenanceDate: e.target.value })} />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">Assigned Department / Room</label>
                <input type="text" className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    value={formData.assignedDepartment} onChange={e => setFormData({ ...formData, assignedDepartment: e.target.value })} />
            </div>
            <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea rows={2} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
            </div>
        </div>
    );

    if (loading) return <div className="p-8 text-gray-500">Loading equipment...</div>;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* ── Header ── */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Equipment Inventory</h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Track, manage, and transfer equipment across all branches</p>
                    </div>
                    <button onClick={() => { setFormData(emptyForm); setShowAddModal(true); }}
                        className="bg-indigo-600 text-white px-4 py-2.5 rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm">
                        <Plus className="w-4 h-4" /> Add Equipment
                    </button>
                </div>

                {/* ── Alerts ── */}
                {(lowStockItems.length > 0 || maintenanceDue.length > 0) && (
                    <div className="space-y-2">
                        {lowStockItems.length > 0 && (
                            <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-red-700 dark:text-red-400">Low Stock Alert</p>
                                    <p className="text-xs text-red-600 dark:text-red-400">{lowStockItems.map(i => `${i.name} (${branchName(i.branchId)} — Qty: ${i.quantity})`).join(', ')}</p>
                                </div>
                            </div>
                        )}
                        {maintenanceDue.length > 0 && (
                            <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                                <Wrench className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Maintenance Reminder</p>
                                    <p className="text-xs text-amber-600 dark:text-amber-400">{maintenanceDue.map(i => `${i.name} — due ${i.nextMaintenanceDate}`).join(', ')}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Dashboard Summary ── */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                    <button onClick={() => setDashboardOpen(!dashboardOpen)}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <div className="flex items-center gap-2">
                            <Package className="w-5 h-5 text-indigo-500" />
                            <span className="font-semibold text-gray-800 dark:text-gray-200">Dashboard Summary</span>
                        </div>
                        {dashboardOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </button>
                    {dashboardOpen && (
                        <div className="px-6 pb-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-center">
                                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{totalCount}</p>
                                <p className="text-[11px] text-indigo-500 font-medium">Total Items</p>
                            </div>
                            {branchCounts.map(b => (
                                <div key={b.id} className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-center">
                                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{b.count}</p>
                                    <p className="text-[11px] text-blue-500 font-medium truncate">{b.name.replace(' Branch', '')}</p>
                                </div>
                            ))}
                            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-center">
                                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{maintenanceCount}</p>
                                <p className="text-[11px] text-amber-500 font-medium">Maintenance</p>
                            </div>
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-center">
                                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{damagedCount}</p>
                                <p className="text-[11px] text-red-500 font-medium">Damaged</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Filter Bar ── */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex flex-col md:flex-row gap-3 items-end">
                    <div className="flex-1 min-w-[160px]">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Branch</label>
                        <select className="w-full p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                            value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
                            <option value="">All Branches</option>
                            {BRANCHES.filter(b => currentUser?.role === 'SUPER_ADMIN' || currentUser?.clinicIds?.includes(b.id)).map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1 min-w-[160px]">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                        <select className="w-full p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                            value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                            <option value="">All Categories</option>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="flex-1 min-w-[130px]">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                        <select className="w-full p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                            value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                            <option value="">All Statuses</option>
                            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            <input type="text" placeholder="Name or serial number..."
                                className="w-full pl-9 p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                </div>

                {/* ── Equipment Table ── */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    <th className="px-4 py-3">Equipment</th>
                                    <th className="px-4 py-3">Category</th>
                                    <th className="px-4 py-3">Branch</th>
                                    <th className="px-4 py-3 text-center">Qty</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Warranty</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filtered.map(item => {
                                    const isLow = item.quantity <= item.lowStockThreshold && item.status === 'active';
                                    const isMaintSoon = item.nextMaintenanceDate && new Date(item.nextMaintenanceDate) <= in7Days && item.status === 'active';
                                    return (
                                        <tr key={item.id} className={`hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${isLow ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                                            <td className="px-4 py-3">
                                                <div>
                                                    <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
                                                    <p className="text-xs text-gray-500">{item.brand} {item.serialNumber ? `· SN: ${item.serialNumber}` : ''}</p>
                                                    {item.assignedDepartment && <p className="text-xs text-indigo-500">{item.assignedDepartment}</p>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{item.category}</td>
                                            <td className="px-4 py-3">
                                                <span className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                                                    <MapPin className="w-3 h-3" />{branchName(item.branchId).replace(' Branch', '')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`font-bold ${isLow ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>{item.quantity}</span>
                                                {isLow && <AlertTriangle className="w-3 h-3 text-red-500 inline ml-1" />}
                                            </td>
                                            <td className="px-4 py-3">
                                                {statusBadge(item.status)}
                                                {isMaintSoon && (
                                                    <span className="flex items-center gap-1 text-[10px] text-amber-600 mt-1">
                                                        <Wrench className="w-3 h-3" /> Maint. due
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-500">
                                                {item.warrantyExpiry ? (
                                                    <span className={new Date(item.warrantyExpiry) < today ? 'text-red-500 line-through' : ''}>
                                                        {item.warrantyExpiry}
                                                    </span>
                                                ) : '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={() => openEdit(item)} title="Edit"
                                                        className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-500 transition-colors">
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => openTransfer(item)} title="Transfer"
                                                        className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 transition-colors">
                                                        <ArrowLeftRight className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => openHistory(item)} title="History"
                                                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors">
                                                        <History className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => handleDelete(item.id)} title="Delete"
                                                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {filtered.length === 0 && (
                        <div className="text-center py-12 text-gray-400">
                            <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
                            {items.length === 0 ? 'No equipment added yet. Click "Add Equipment" to get started.' : 'No equipment matches the current filters.'}
                        </div>
                    )}
                </div>

                {/* ── Add Modal ── */}
                {showAddModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                            <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Add Equipment</h2>
                                <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
                            </div>
                            <form onSubmit={handleAdd} className="p-6">
                                {renderFormFields()}
                                <div className="flex justify-end gap-3 mt-6">
                                    <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                                    <button type="submit" disabled={submitting}
                                        className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium">
                                        {submitting ? 'Adding...' : 'Add Equipment'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ── Edit Modal ── */}
                {showEditModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                            <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Edit Equipment</h2>
                                <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
                            </div>
                            <form onSubmit={handleEdit} className="p-6">
                                {renderFormFields()}
                                <div className="flex justify-end gap-3 mt-6">
                                    <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                                    <button type="submit" disabled={submitting}
                                        className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium">
                                        {submitting ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ── Transfer Modal ── */}
                {showTransferModal && transferItem && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl">
                            <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Transfer Equipment</h2>
                                <button onClick={() => setShowTransferModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
                            </div>
                            <form onSubmit={handleTransfer} className="p-6 space-y-4">
                                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">{transferItem.name}</p>
                                    <p className="text-xs text-gray-500">From: {branchName(transferItem.branchId)} · Available: {transferItem.quantity}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Transfer To *</label>
                                    <select required className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={transferBranch} onChange={e => setTransferBranch(e.target.value)}>
                                        <option value="">Select Branch</option>
                                        {BRANCHES.filter(b => b.id !== transferItem.branchId).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Quantity</label>
                                    <input type="number" min="1" max={transferItem.quantity} required
                                        className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={transferQty} onChange={e => setTransferQty(Number(e.target.value))} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Notes</label>
                                    <textarea rows={2} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={transferNotes} onChange={e => setTransferNotes(e.target.value)} placeholder="Reason for transfer..." />
                                </div>
                                <div className="flex justify-end gap-3">
                                    <button type="button" onClick={() => setShowTransferModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                                    <button type="submit" disabled={submitting}
                                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center gap-2">
                                        <ArrowLeftRight className="w-4 h-4" /> {submitting ? 'Transferring...' : 'Transfer'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ── History Modal ── */}
                {showHistoryModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg max-h-[70vh] flex flex-col shadow-2xl">
                            <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700 shrink-0">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">History: {historyItemName}</h2>
                                <button onClick={() => setShowHistoryModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-3">
                                {historyData.length === 0 ? (
                                    <p className="text-sm text-gray-400 text-center py-8">No history found.</p>
                                ) : (
                                    historyData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(h => (
                                        <div key={h.id} className="flex gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                                h.action === 'new_entry' ? 'bg-green-100 text-green-600' :
                                                h.action === 'transfer' ? 'bg-blue-100 text-blue-600' :
                                                h.action === 'maintenance' ? 'bg-amber-100 text-amber-600' :
                                                h.action === 'damage' ? 'bg-red-100 text-red-600' :
                                                h.action === 'disposal' ? 'bg-gray-200 text-gray-600' :
                                                'bg-indigo-100 text-indigo-600'
                                            }`}>
                                                {h.action === 'transfer' ? <ArrowLeftRight className="w-4 h-4" /> :
                                                 h.action === 'maintenance' ? <Wrench className="w-4 h-4" /> :
                                                 h.action === 'new_entry' ? <Plus className="w-4 h-4" /> :
                                                 <History className="w-4 h-4" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 capitalize">{h.action.replace('_', ' ')}</p>
                                                <p className="text-xs text-gray-500">{h.notes}</p>
                                                {h.fromBranch && <p className="text-xs text-gray-400">{branchName(h.fromBranch)} → {branchName(h.toBranch || '')}</p>}
                                                <p className="text-[10px] text-gray-400 mt-1">{new Date(h.timestamp).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Plus, Trash2, Edit2, Pill, Package, CalendarClock, Warehouse, ArrowRightLeft, MapPin,
    AlertTriangle, BellOff, Bell, Hash, Boxes, Droplets, ClipboardCheck, Link2, Search,
    Printer, ClipboardList, Archive, SlidersHorizontal, Truck, CheckCircle2,
    XCircle, Clock, ChevronRight, BarChart3, FlaskConical, RotateCcw, ShieldAlert
} from 'lucide-react';
import { Medicine, Clinic, RegisteredProduct, Supplier, StockTransferRequest, ExpiredStockRecord, StockAdjustmentRecord } from '@/lib/data';

/* ─── Types ─────────────────────────────────────────────────────── */
type Tab = 'inventory' | 'transfers' | 'expired' | 'adjustments';

/* ─── Print Styles ──────────────────────────────────────────────── */
const PRINT_STYLES = `
@media print {
  body * { visibility: hidden !important; }
  #print-area, #print-area * { visibility: visible !important; }
  #print-area { position: absolute; left: 0; top: 0; width: 100%; }
  .no-print { display: none !important; }
  table { border-collapse: collapse; width: 100%; font-size: 11px; }
  th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
  th { background: #f0f4ff; font-weight: 700; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  p { font-size: 12px; margin: 0; }
}`;

export default function MedicinesPage() {
    /* ── Core data ── */
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [clinics, setClinics] = useState<Clinic[]>([]);
    const [registeredProducts, setRegisteredProducts] = useState<RegisteredProduct[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);

    /* ── New feature data ── */
    const [transfers, setTransfers] = useState<StockTransferRequest[]>([]);
    const [expiredRecords, setExpiredRecords] = useState<ExpiredStockRecord[]>([]);
    const [adjustments, setAdjustments] = useState<StockAdjustmentRecord[]>([]);

    /* ── UI state ── */
    const [activeTab, setActiveTab] = useState<Tab>('inventory');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeSearch, setActiveSearch] = useState('');
    const [submitting, setSubmitting] = useState(false);

    /* ── Modals ── */
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [isExpiredModalOpen, setIsExpiredModalOpen] = useState(false);
    const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);

    /* ── Forms ── */
    const [newMedicine, setNewMedicine] = useState({
        name: '', price: '', centralStock: '', expiryDate: '', category: 'medicine' as 'medicine' | 'consumable' | 'em_medicine',
        minCentralStock: '', itemCode: '', purchaseUnit: '', itemsPerPurchaseUnit: '', consumableUnit: '',
        registeredProductId: '', batchNumber: '', storedType: '', numberOfStoredType: '', consumableItemsInside: '', purchasedUnits: ''
    });
    const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);

    const [transferForm, setTransferForm] = useState({
        medicineId: '', fromLocation: 'central', toLocation: '', quantity: '', notes: ''
    });
    const [expiredForm, setExpiredForm] = useState({
        medicineId: '', quantity: '', location: 'central', batchNumber: ''
    });
    const [adjustForm, setAdjustForm] = useState({
        medicineId: '', location: 'central', newQty: '', reason: ''
    });
    const [disposalForm, setDisposalForm] = useState<{ id: string; date: string; notes: string } | null>(null);
    const [expiredYearFilter, setExpiredYearFilter] = useState(new Date().getFullYear());

    /* ── User/role ── */
    const [userName, setUserName] = useState('Admin');
    const [userId, setUserId] = useState('');
    const [userClinicIds, setUserClinicIds] = useState<string[]>([]);
    const [userRole, setUserRole] = useState<'SUPER_ADMIN' | 'ADMIN' | 'DOCTOR' | 'STAFF'>('ADMIN');
    const [canEditInventory, setCanEditInventory] = useState(false);

    /* ── Print ref ── */
    const printAreaRef = useRef<HTMLDivElement>(null);

    /* ─── Load user from localStorage ─── */
    useEffect(() => {
        try {
            const raw = localStorage.getItem('adminUser');
            if (raw) {
                const u = JSON.parse(raw);
                setUserName(u.name || 'Admin');
                setUserId(u.id || '');
                setUserClinicIds(Array.isArray(u.clinicIds) ? u.clinicIds : []);
                setUserRole(u.role || 'ADMIN');
                const isSuperAdmin = u.role === 'SUPER_ADMIN';
                const hasEditPerm = Array.isArray(u.permissions?.inventory) && u.permissions.inventory.includes('edit');
                setCanEditInventory(isSuperAdmin || hasEditPerm);
            }
        } catch { /* ignore */ }
    }, []);

    /* ─── Fetch all data ─── */
    const fetchAll = useCallback(async () => {
        const [meds, cls, rps, sups, trs, exps, adjs] = await Promise.all([
            fetch('/api/admin/medicines').then(r => r.json()),
            fetch('/api/admin/clinics').then(r => r.json()),
            fetch('/api/admin/registered-products').then(r => r.json()),
            fetch('/api/admin/suppliers').then(r => r.json()),
            fetch('/api/admin/stock-transfers').then(r => r.json()),
            fetch('/api/admin/expired-stock').then(r => r.json()),
            fetch('/api/admin/stock-adjustments').then(r => r.json()),
        ]);
        setMedicines(Array.isArray(meds) ? meds : []);
        setClinics(Array.isArray(cls) ? cls : []);
        setRegisteredProducts(Array.isArray(rps) ? rps : []);
        setSuppliers(Array.isArray(sups) ? sups : []);
        setTransfers(Array.isArray(trs) ? trs : []);
        setExpiredRecords(Array.isArray(exps) ? exps : []);
        setAdjustments(Array.isArray(adjs) ? adjs : []);
    }, []);

    useEffect(() => {
        fetchAll().catch(console.error).finally(() => setLoading(false));
    }, [fetchAll]);

    const fetchMedicines = async () => {
        const res = await fetch('/api/admin/medicines');
        const data = await res.json();
        setMedicines(Array.isArray(data) ? data : []);
    };
    const fetchTransfers = async () => {
        const res = await fetch('/api/admin/stock-transfers');
        const data = await res.json();
        setTransfers(Array.isArray(data) ? data : []);
    };
    const fetchExpired = async () => {
        const res = await fetch('/api/admin/expired-stock');
        const data = await res.json();
        setExpiredRecords(Array.isArray(data) ? data : []);
    };
    const fetchAdjustments = async () => {
        const res = await fetch('/api/admin/stock-adjustments');
        const data = await res.json();
        setAdjustments(Array.isArray(data) ? data : []);
    };

    /* ─── Helpers ─── */
    const getClinicName = (id: string) => id === 'central' ? 'Central Store' : (clinics.find(c => c.id === id)?.name || id);
    const getTotalStock = (med: Medicine) => med.centralStock + (med.branchStock || []).reduce((s, b) => s + b.quantity, 0);
    const isBelowMin = (qty: number, min?: number) => min !== undefined && min > 0 && qty < min;
    const isNearMin = (qty: number, min?: number) => min !== undefined && min > 0 && qty >= min && qty <= min * 1.5;
    const isAnyBelowMin = (med: Medicine) => isBelowMin(med.centralStock, med.minCentralStock) || (med.branchStock || []).some(bs => isBelowMin(bs.quantity, bs.minQuantity));
    const getRegisteredProduct = (med: Medicine) => med.registeredProductId ? registeredProducts.find(rp => rp.id === med.registeredProductId) : undefined;
    const getSupplierName = (id: string) => suppliers.find(s => s.id === id)?.name || id;
    const isExpired = (date: string) => new Date(date) < new Date();
    const getInTransitQty = (medId: string) => transfers.filter(t => t.medicineId === medId && (t.status === 'approved' || t.status === 'in_transit')).reduce((s, t) => s + t.quantity, 0);
    const getUnlinkedProducts = () => {
        const linkedIds = medicines.map(m => m.registeredProductId).filter(Boolean);
        return registeredProducts.filter(rp => !linkedIds.includes(rp.id));
    };
    const getProductSuppliersStr = (rp: RegisteredProduct) => {
        const sIds = rp.registeredSupplierIds?.length ? rp.registeredSupplierIds : (rp.registeredSupplierId ? [rp.registeredSupplierId] : []);
        return sIds.length === 0 ? 'None' : sIds.map(id => getSupplierName(id)).join(', ');
    };

    /* ─── Print ─── */
    const handlePrint = () => window.print();

    /* ─── CRUD Handlers ─── */
    const handleRegisteredProductSelect = (rpId: string) => {
        const rp = registeredProducts.find(p => p.id === rpId);
        if (rp) {
            setNewMedicine({
                ...newMedicine, registeredProductId: rpId, name: rp.tradeName, itemCode: rp.itemCode,
                price: String(rp.consumableItemsInside && Number(rp.consumableItemsInside) > 0 ? +(Number(rp.registeredPrice) / Number(rp.consumableItemsInside)).toFixed(2) : rp.registeredPrice),
                category: rp.category === 'em_medicine' ? 'medicine' : rp.category,
                purchaseUnit: rp.purchaseUnit, itemsPerPurchaseUnit: String(rp.consumableItemsInside),
                consumableUnit: rp.consumableUnit, storedType: rp.storedType || '',
                numberOfStoredType: String(rp.numberOfStoredType || ''), consumableItemsInside: String(rp.consumableItemsInside || ''),
                minCentralStock: String(rp.minCentralStock || ''),
            });
        } else {
            setNewMedicine({ ...newMedicine, registeredProductId: '' });
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault(); setSubmitting(true);
        try {
            const res = await fetch('/api/admin/medicines', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newMedicine.name, price: Number(newMedicine.price),
                    centralStock: (Number(newMedicine.purchasedUnits) || 0) * (Number(newMedicine.numberOfStoredType) || 1),
                    branchStock: [], expiryDate: newMedicine.expiryDate || undefined, category: newMedicine.category,
                    minCentralStock: newMedicine.minCentralStock ? Number(newMedicine.minCentralStock) : undefined,
                    itemCode: newMedicine.itemCode || undefined, purchaseUnit: newMedicine.purchaseUnit || undefined,
                    itemsPerPurchaseUnit: newMedicine.itemsPerPurchaseUnit ? Number(newMedicine.itemsPerPurchaseUnit) : undefined,
                    consumableUnit: newMedicine.consumableUnit || undefined,
                    registeredProductId: newMedicine.registeredProductId || undefined,
                    batchNumber: newMedicine.batchNumber || undefined, storedType: newMedicine.storedType || undefined,
                    numberOfStoredType: newMedicine.numberOfStoredType ? Number(newMedicine.numberOfStoredType) : undefined,
                    consumableItemsInside: newMedicine.consumableItemsInside ? Number(newMedicine.consumableItemsInside) : undefined,
                })
            });
            if (res.ok) { await fetchMedicines(); setIsAddModalOpen(false); setNewMedicine({ name: '', price: '', centralStock: '', expiryDate: '', category: 'medicine', minCentralStock: '', itemCode: '', purchaseUnit: '', itemsPerPurchaseUnit: '', consumableUnit: '', registeredProductId: '', batchNumber: '', storedType: '', numberOfStoredType: '', consumableItemsInside: '', purchasedUnits: '' }); }
            else alert('Failed to add medicine');
        } catch (e) { console.error(e); } finally { setSubmitting(false); }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault(); if (!editingMedicine) return; setSubmitting(true);
        try {
            const res = await fetch('/api/admin/medicines', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: editingMedicine.id, name: editingMedicine.name, price: Number(editingMedicine.price), centralStock: Number(editingMedicine.centralStock), branchStock: editingMedicine.branchStock, expiryDate: editingMedicine.expiryDate || undefined, category: editingMedicine.category, minCentralStock: editingMedicine.minCentralStock !== undefined ? editingMedicine.minCentralStock : undefined, itemCode: editingMedicine.itemCode || undefined, purchaseUnit: editingMedicine.purchaseUnit || undefined, itemsPerPurchaseUnit: editingMedicine.itemsPerPurchaseUnit !== undefined ? editingMedicine.itemsPerPurchaseUnit : undefined, consumableUnit: editingMedicine.consumableUnit || undefined, registeredProductId: editingMedicine.registeredProductId || undefined, batchNumber: editingMedicine.batchNumber || undefined, storedType: editingMedicine.storedType || undefined, numberOfStoredType: editingMedicine.numberOfStoredType !== undefined ? editingMedicine.numberOfStoredType : undefined, consumableItemsInside: editingMedicine.consumableItemsInside !== undefined ? editingMedicine.consumableItemsInside : undefined })
            });
            if (res.ok) { await fetchMedicines(); setIsEditModalOpen(false); setEditingMedicine(null); }
            else alert('Failed to update');
        } catch (e) { console.error(e); } finally { setSubmitting(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this item?')) return;
        const res = await fetch(`/api/admin/medicines?id=${id}`, { method: 'DELETE' });
        if (res.ok) await fetchMedicines(); else alert('Failed to delete');
    };

    const handleToggleNotified = async (med: Medicine) => {
        await fetch('/api/admin/medicines', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: med.id, isNotified: !med.isNotified }) });
        await fetchMedicines();
    };

    /* ─── Transfer Handler ─── */
    const handleTransferRequest = async (e: React.FormEvent) => {
        e.preventDefault(); setSubmitting(true);
        try {
            const res = await fetch('/api/admin/stock-transfers', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ medicineId: transferForm.medicineId, fromLocation: transferForm.fromLocation, toLocation: transferForm.toLocation, quantity: Number(transferForm.quantity), requestedBy: userName, requesterId: userId, notes: transferForm.notes || undefined })
            });
            if (res.ok) { await fetchTransfers(); await fetchMedicines(); setIsTransferModalOpen(false); setTransferForm({ medicineId: '', fromLocation: 'central', toLocation: '', quantity: '', notes: '' }); }
            else { const err = await res.json(); alert(err.error || 'Failed to create transfer'); }
        } catch (e) { console.error(e); } finally { setSubmitting(false); }
    };

    const handleTransferAction = async (id: string, status: string, reason?: string) => {
        setSubmitting(true);
        try {
            const res = await fetch('/api/admin/stock-transfers', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status, actorName: userName, actorId: userId, cancellationReason: reason })
            });
            if (res.ok) { await fetchTransfers(); await fetchMedicines(); }
            else { const err = await res.json(); alert(err.error || 'Failed'); }
        } catch (e) { console.error(e); } finally { setSubmitting(false); }
    };

    /* ─── Expired Stock Handler ─── */
    const handleMoveToExpired = async (e: React.FormEvent) => {
        e.preventDefault(); setSubmitting(true);
        try {
            const med = medicines.find(m => m.id === expiredForm.medicineId);
            const res = await fetch('/api/admin/expired-stock', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ medicineId: expiredForm.medicineId, medicineName: med?.name || '', quantity: Number(expiredForm.quantity), expiryDate: med?.expiryDate || new Date().toISOString().split('T')[0], location: expiredForm.location, movedBy: userName, batchNumber: expiredForm.batchNumber || undefined })
            });
            if (res.ok) { await fetchExpired(); await fetchMedicines(); setIsExpiredModalOpen(false); setExpiredForm({ medicineId: '', quantity: '', location: 'central', batchNumber: '' }); }
            else { const err = await res.json(); alert(err.error || 'Failed'); }
        } catch (e) { console.error(e); } finally { setSubmitting(false); }
    };

    const handleUpdateDisposal = async (e: React.FormEvent) => {
        e.preventDefault(); if (!disposalForm) return; setSubmitting(true);
        try {
            const res = await fetch('/api/admin/expired-stock', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: disposalForm.id, disposalDate: disposalForm.date, disposalNotes: disposalForm.notes }) });
            if (res.ok) { await fetchExpired(); setDisposalForm(null); }
        } catch (e) { console.error(e); } finally { setSubmitting(false); }
    };

    /* ─── Stock Adjustment Handler ─── */
    const handleStockAdjust = async (e: React.FormEvent) => {
        e.preventDefault(); setSubmitting(true);
        try {
            const med = medicines.find(m => m.id === adjustForm.medicineId);
            const res = await fetch('/api/admin/stock-adjustments', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ medicineId: adjustForm.medicineId, medicineName: med?.name || '', location: adjustForm.location, newQty: Number(adjustForm.newQty), adjustedBy: userName, reason: adjustForm.reason })
            });
            if (res.ok) { await fetchAdjustments(); await fetchMedicines(); setIsAdjustModalOpen(false); setAdjustForm({ medicineId: '', location: 'central', newQty: '', reason: '' }); }
            else { const err = await res.json(); alert(err.error || 'Failed'); }
        } catch (e) { console.error(e); } finally { setSubmitting(false); }
    };

    /* ─── Transfer Status UI helpers ─── */
    const TRANSFER_STEPS: Array<{ key: string; label: string; icon: React.ReactNode }> = [
        { key: 'requested', label: 'Requested', icon: <ClipboardList className="w-3.5 h-3.5" /> },
        { key: 'approved', label: 'Approved', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
        { key: 'in_transit', label: 'In Transit', icon: <Truck className="w-3.5 h-3.5" /> },
        { key: 'received', label: 'Received', icon: <Package className="w-3.5 h-3.5" /> },
    ];

    const stepIndex = (status: string) => TRANSFER_STEPS.findIndex(s => s.key === status);

    const statusColors: Record<string, string> = {
        requested: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
        approved: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300',
        in_transit: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300',
        received: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300',
        cancelled: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300',
    };

    if (loading) return <div className="p-8 text-gray-500">Loading inventory...</div>;

    const isSuperAdmin = userRole === 'SUPER_ADMIN';

    /* ── Branch-based transfer permission helpers ── */
    // Returns true if the logged-in user can approve or dispatch a transfer (= assigned to SENDING branch)
    const canApproveOrDispatch = (tr: StockTransferRequest) => {
        if (isSuperAdmin) return true;
        if (tr.fromLocation === 'central') return canEditInventory; // central managed by inventory editors
        return userClinicIds.includes(tr.fromLocation);
    };
    // Returns true if the logged-in user can confirm receipt (= assigned to RECEIVING branch)
    const canReceiveTransfer = (tr: StockTransferRequest) => {
        if (isSuperAdmin) return true;
        return userClinicIds.includes(tr.toLocation);
    };
    // Clinics the current user is allowed to request stock for (= their branches)
    const requestableToClinics = isSuperAdmin ? clinics : clinics.filter(c => userClinicIds.includes(c.id));

    /* ── Audit timeline format helper ── */
    const fmtDT = (iso?: string) => {
        if (!iso) return null;
        const d = new Date(iso);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
            d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    };

    /* ─── Filtered medicines ─── */
    const filteredMeds = [...medicines]
        .filter(med => !activeSearch || med.name.toLowerCase().includes(activeSearch.toLowerCase()) || (med.itemCode && med.itemCode.toLowerCase().includes(activeSearch.toLowerCase())))
        .sort((a, b) => a.name.localeCompare(b.name));

    /* ─── Annual waste summary ─── */
    const expiredThisYear = expiredRecords.filter(r => r.year === expiredYearFilter);
    const wasteByMed: Record<string, { name: string; qty: number }> = {};
    expiredThisYear.forEach(r => {
        if (!wasteByMed[r.medicineId]) wasteByMed[r.medicineId] = { name: r.medicineName, qty: 0 };
        wasteByMed[r.medicineId].qty += r.quantity;
    });

    return (
        <>
            {/* Inject print styles */}
            <style>{PRINT_STYLES}</style>

            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
                <div className="max-w-6xl mx-auto">

                    {/* ── Header ── */}
                    <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Inventory</h1>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Medicines &amp; consumables with per-branch stock tracking. Linked to Product Registry.</p>
                        </div>
                        <div className="flex flex-wrap gap-2 items-center justify-end">
                            {/* Search */}
                            <div className="flex gap-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <input type="text" placeholder="Search by name or code…" value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') setActiveSearch(searchTerm); }}
                                        className="pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none w-52" />
                                </div>
                                <button onClick={() => setActiveSearch(searchTerm)}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors">
                                    <Search className="w-4 h-4" /> Search
                                </button>
                            </div>
                            {/* Print */}
                            <button onClick={handlePrint}
                                className="bg-gray-700 hover:bg-gray-800 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors">
                                <Printer className="w-4 h-4" /> Print
                            </button>
                            {/* Transfer Request */}
                            <button onClick={() => setIsTransferModalOpen(true)}
                                className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors">
                                <Truck className="w-4 h-4" /> Transfer Request
                            </button>
                            {/* Adjust Stock */}
                            {canEditInventory && (
                                <button onClick={() => setIsAdjustModalOpen(true)}
                                    className="bg-violet-600 hover:bg-violet-700 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors">
                                    <SlidersHorizontal className="w-4 h-4" /> Adjust Stock
                                </button>
                            )}
                            {/* Expired Stock */}
                            {isSuperAdmin && (
                                <button onClick={() => setIsExpiredModalOpen(true)}
                                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors">
                                    <Archive className="w-4 h-4" /> Move to Expired
                                </button>
                            )}
                            {/* Add Item */}
                            <button onClick={() => setIsAddModalOpen(true)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors">
                                <Plus className="w-4 h-4" /> Add Item
                            </button>
                        </div>
                    </header>

                    {/* ── Tabs ── */}
                    <div className="flex gap-1 mb-4 bg-white dark:bg-gray-800 rounded-xl p-1 shadow-sm border border-gray-100 dark:border-gray-700 w-fit no-print">
                        {([
                            { id: 'inventory', label: 'Inventory', icon: <Pill className="w-4 h-4" />, count: medicines.length },
                            { id: 'transfers', label: 'Transfers', icon: <Truck className="w-4 h-4" />, count: transfers.filter(t => !['received', 'cancelled'].includes(t.status)).length },
                            { id: 'expired', label: 'Expired Stock', icon: <Archive className="w-4 h-4" />, count: expiredRecords.length },
                            { id: 'adjustments', label: 'Adjustments', icon: <SlidersHorizontal className="w-4 h-4" />, count: adjustments.length },
                        ] as const).map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                                {tab.icon} {tab.label}
                                {tab.count > 0 && <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === tab.id ? 'bg-white/30 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}`}>{tab.count}</span>}
                            </button>
                        ))}
                    </div>

                    {/* ════════════════════════════════════════════════════
                        TAB: INVENTORY
                    ════════════════════════════════════════════════════ */}
                    {activeTab === 'inventory' && (
                        <>
                            {/* ── Print Area ── */}
                            <div ref={printAreaRef} id="print-area">
                                <div className="hidden print:block mb-4">
                                    <h1>First Medical Center — Inventory Stock Report</h1>
                                    <p>Printed: {new Date().toLocaleString()} &nbsp;|&nbsp; Total items: {medicines.length}</p>
                                </div>
                                <table className="hidden print:table w-full text-xs">
                                    <thead>
                                        <tr>
                                            <th>Name</th><th>Code</th><th>Category</th><th>Unit Price</th>
                                            <th>Central</th>
                                            {clinics.map(c => <th key={c.id}>{c.name}</th>)}
                                            <th>In Transit</th><th>Total</th><th>Expiry</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...medicines].sort((a, b) => a.name.localeCompare(b.name)).map(med => (
                                            <tr key={med.id}>
                                                <td>{med.name}</td>
                                                <td>{med.itemCode || '—'}</td>
                                                <td>{med.category}</td>
                                                <td>{med.price} AED</td>
                                                <td>{med.centralStock}</td>
                                                {clinics.map(c => { const bs = (med.branchStock || []).find(b => b.clinicId === c.id); return <td key={c.id}>{bs?.quantity ?? 0}</td>; })}
                                                <td>{getInTransitQty(med.id)}</td>
                                                <td style={{ fontWeight: 600 }}>{getTotalStock(med)}</td>
                                                <td>{med.expiryDate || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* ── Medicine List (screen) ── */}
                                <div className="print:hidden bg-white dark:bg-gray-800 rounded-xl shadow-sm divide-y divide-gray-100 dark:divide-gray-700">
                                    {filteredMeds.length === 0 ? (
                                        <div className="text-center py-14 text-gray-400">
                                            {activeSearch ? 'No matches found.' : 'No items in inventory yet.'}
                                        </div>
                                    ) : filteredMeds.map(med => {
                                        const rp = getRegisteredProduct(med);
                                        const inTransit = getInTransitQty(med.id);
                                        const activeTrs = transfers.filter(t => t.medicineId === med.id && !['received', 'cancelled'].includes(t.status));
                                        return (
                                            <div key={med.id} className="p-5 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                                                {/* Top row */}
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                                        <div className={`p-2.5 rounded-lg flex-shrink-0 ${med.category === 'consumable' ? 'bg-orange-100 dark:bg-orange-900/30' : med.category === 'em_medicine' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                                                            <Pill className={`w-5 h-5 ${med.category === 'consumable' ? 'text-orange-600' : med.category === 'em_medicine' ? 'text-red-600' : 'text-green-600'}`} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                                                <h3 className="font-semibold text-gray-900 dark:text-white">{med.name}</h3>
                                                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${med.category === 'consumable' ? 'bg-orange-100 text-orange-700' : med.category === 'em_medicine' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                    {med.category === 'consumable' ? 'Consumable' : med.category === 'em_medicine' ? 'EM Medicine' : 'Medicine'}
                                                                </span>
                                                                {rp ? (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700" title={`Linked to ${rp.tradeName}`}>
                                                                        <ClipboardCheck className="w-3 h-3" /> Registered
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                                                                        <AlertTriangle className="w-3 h-3" /> Unregistered
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                                                <span className="flex items-center gap-1"><span className="text-[10px] font-semibold">د.إ</span>{med.price} AED</span>
                                                                {med.itemCode && <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"><Hash className="w-3 h-3" />{med.itemCode}</span>}
                                                                {med.purchaseUnit && <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600"><Boxes className="w-3 h-3" />{med.purchaseUnit}{med.itemsPerPurchaseUnit ? ` (${med.itemsPerPurchaseUnit})` : ''}</span>}
                                                                {med.consumableUnit && <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-600"><Droplets className="w-3 h-3" />{med.consumableUnit}</span>}
                                                                {med.expiryDate && (() => {
                                                                    const d = Math.ceil((new Date(med.expiryDate).getTime() - Date.now()) / 86400000);
                                                                    return <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${d <= 0 ? 'bg-red-100 text-red-700' : d <= 90 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                                                                        <CalendarClock className="w-3 h-3" />{d <= 0 ? 'EXPIRED' : d <= 90 ? `Exp in ${d}d` : `Exp: ${med.expiryDate}`}
                                                                    </span>;
                                                                })()}
                                                                {isAnyBelowMin(med) && <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-700"><AlertTriangle className="w-3 h-3" />Low Stock</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {/* Action buttons */}
                                                    <div className="flex items-center gap-1 flex-shrink-0">
                                                        {isAnyBelowMin(med) && (
                                                            <button onClick={() => handleToggleNotified(med)}
                                                                className={`p-2 rounded-full transition-colors ${med.isNotified ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100' : 'text-amber-500 hover:text-amber-700 hover:bg-amber-50'}`}
                                                                title={med.isNotified ? 'Alert acknowledged' : 'Acknowledge low-stock alert'}>
                                                                {med.isNotified ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                                                            </button>
                                                        )}
                                                        <button onClick={() => { setTransferForm({ ...transferForm, medicineId: med.id }); setIsTransferModalOpen(true); }}
                                                            className="text-amber-600 hover:text-amber-800 p-2 rounded-full hover:bg-amber-50" title="Transfer Request">
                                                            <Truck className="w-4 h-4" />
                                                        </button>
                                                        {canEditInventory && (
                                                            <button onClick={() => { setAdjustForm({ ...adjustForm, medicineId: med.id }); setIsAdjustModalOpen(true); }}
                                                                className="text-violet-500 hover:text-violet-700 p-2 rounded-full hover:bg-violet-50" title="Adjust Stock">
                                                                <SlidersHorizontal className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {isSuperAdmin && med.expiryDate && isExpired(med.expiryDate) && (
                                                            <button onClick={() => { setExpiredForm({ ...expiredForm, medicineId: med.id }); setIsExpiredModalOpen(true); }}
                                                                className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50" title="Move to Expired">
                                                                <Archive className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <button onClick={() => { setEditingMedicine({ ...med }); setIsEditModalOpen(true); }}
                                                            className="text-indigo-500 hover:text-indigo-700 p-2 rounded-full hover:bg-indigo-50" title="Edit">
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => handleDelete(med.id)}
                                                            className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50" title="Delete">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Registry info */}
                                                {rp && (
                                                    <div className="ml-14 mb-2 space-y-1">
                                                        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/15 text-indigo-600 dark:text-indigo-400"><Link2 className="w-3 h-3" />{rp.tradeName} ({rp.genericName})</span>
                                                            <span className="font-mono text-[10px]">{rp.registrationBody}: {rp.registrationNumber}</span>
                                                            {rp.registrationExpiry && <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${isExpired(rp.registrationExpiry) ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{isExpired(rp.registrationExpiry) ? '⛔ Reg. Expired' : `✓ Reg. until ${rp.registrationExpiry}`}</span>}
                                                            <span className="text-gray-400">Supplier: {getProductSuppliersStr(rp)}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Stock badges */}
                                                <div className="flex flex-wrap gap-2 ml-14">
                                                    <div className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300 shadow-sm">
                                                        <Boxes className="w-4 h-4" />Total: {getTotalStock(med)}
                                                    </div>
                                                    <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border ${isBelowMin(med.centralStock, med.minCentralStock) || med.centralStock <= 0 ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400' : isNearMin(med.centralStock, med.minCentralStock) || med.centralStock <= 10 ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-400'}`}>
                                                        <Warehouse className="w-3.5 h-3.5" />Central: {med.centralStock}{med.minCentralStock ? ` (min ${med.minCentralStock})` : ''}
                                                    </div>
                                                    {clinics.map(clinic => {
                                                        const bs = (med.branchStock || []).find(b => b.clinicId === clinic.id);
                                                        const qty = bs?.quantity ?? 0;
                                                        return (
                                                            <div key={clinic.id} className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border ${isBelowMin(qty, bs?.minQuantity) || qty <= 0 ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400' : isNearMin(qty, bs?.minQuantity) || qty <= 5 ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-teal-50 border-teal-200 text-teal-700 dark:bg-teal-900/20 dark:border-teal-800 dark:text-teal-400'}`}>
                                                                <MapPin className="w-3.5 h-3.5" />{clinic.name}: {qty}{bs?.minQuantity ? ` (min ${bs.minQuantity})` : ''}
                                                            </div>
                                                        );
                                                    })}
                                                    {inTransit > 0 && (
                                                        <div className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400">
                                                            <Truck className="w-3.5 h-3.5" />In Transit: {inTransit}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Active transfers inline */}
                                                {activeTrs.length > 0 && (
                                                    <div className="ml-14 mt-2 space-y-1">
                                                        {activeTrs.map(tr => (
                                                            <div key={tr.id} className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 text-xs">
                                                                <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${statusColors[tr.status]}`}>{tr.status.replace('_', ' ').toUpperCase()}</span>
                                                                <span className="text-gray-600 dark:text-gray-400">Qty: <strong>{tr.quantity}</strong></span>
                                                                <ChevronRight className="w-3 h-3 text-gray-400" />
                                                                <span><strong>{getClinicName(tr.fromLocation)}</strong> → <strong>{getClinicName(tr.toLocation)}</strong></span>
                                                                <span className="text-gray-400">by {tr.requestedBy}</span>
                                                                {/* Action buttons per status — branch-RBAC enforced */}
                                                                {tr.status === 'requested' && canApproveOrDispatch(tr) && (
                                                                    <button onClick={() => handleTransferAction(tr.id, 'approved')} className="ml-auto px-2 py-0.5 rounded bg-violet-600 text-white text-[10px] font-semibold hover:bg-violet-700 transition-colors" disabled={submitting}>Approve</button>
                                                                )}
                                                                {tr.status === 'approved' && canApproveOrDispatch(tr) && (
                                                                    <button onClick={() => handleTransferAction(tr.id, 'in_transit')} className="ml-auto px-2 py-0.5 rounded bg-amber-600 text-white text-[10px] font-semibold hover:bg-amber-700 transition-colors" disabled={submitting}>Dispatch</button>
                                                                )}
                                                                {tr.status === 'in_transit' && canReceiveTransfer(tr) && (
                                                                    <button onClick={() => handleTransferAction(tr.id, 'received')} className="ml-auto px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-semibold hover:bg-emerald-700 transition-colors" disabled={submitting}>Confirm Received</button>
                                                                )}
                                                                {['requested', 'approved', 'in_transit'].includes(tr.status) && isSuperAdmin && (
                                                                    <button onClick={() => { const r = prompt('Cancellation reason:'); if (r !== null) handleTransferAction(tr.id, 'cancelled', r); }} className="px-2 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-semibold hover:bg-red-200 transition-colors" disabled={submitting}>Cancel</button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}

                    {/* ════════════════════════════════════════════════════
                        TAB: TRANSFERS
                    ════════════════════════════════════════════════════ */}
                    {activeTab === 'transfers' && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Truck className="w-5 h-5 text-amber-500" />All Transfer Requests</h2>
                                <button onClick={() => setIsTransferModalOpen(true)} className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5"><Plus className="w-4 h-4" />New Request</button>
                            </div>
                            {transfers.length === 0 ? <div className="text-center py-14 text-gray-400">No transfer requests yet.</div> : (
                                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {transfers.map(tr => {
                                        const med = medicines.find(m => m.id === tr.medicineId);
                                        const si = stepIndex(tr.status);
                                        return (
                                            <div key={tr.id} className="p-4">
                                                <div className="flex flex-wrap items-start justify-between gap-3">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColors[tr.status]}`}>{tr.status.replace('_', ' ').toUpperCase()}</span>
                                                            <span className="font-semibold text-gray-900 dark:text-white">{med?.name || tr.medicineId}</span>
                                                            <span className="text-sm text-gray-500">× {tr.quantity}</span>
                                                        </div>
                                                        <div className="text-xs text-gray-500 flex flex-wrap gap-2">
                                                            <span><strong>{getClinicName(tr.fromLocation)}</strong> → <strong>{getClinicName(tr.toLocation)}</strong></span>
                                                            {tr.notes && <span className="text-gray-400">Note: {tr.notes}</span>}
                                                        </div>

                                                        {/* ── Full Audit Timeline ── */}
                                                        <div className="mt-2 space-y-1">
                                                            {[
                                                                { label: 'Requested by', actor: tr.requestedBy, time: tr.requestedAt, color: 'text-blue-600', dot: 'bg-blue-500' },
                                                                { label: 'Approved by', actor: tr.approvedBy, time: tr.approvedAt, color: 'text-violet-600', dot: 'bg-violet-500' },
                                                                { label: 'Dispatched by', actor: tr.transportedBy, time: tr.dispatchedAt, color: 'text-amber-600', dot: 'bg-amber-500' },
                                                                { label: 'Received by', actor: tr.receivedBy, time: tr.receivedAt, color: 'text-emerald-600', dot: 'bg-emerald-500' },
                                                                { label: 'Cancelled by', actor: tr.cancelledBy, time: undefined, color: 'text-red-600', dot: 'bg-red-500' },
                                                            ].map((step, si2) => (
                                                                (step.actor || step.time) ? (
                                                                    <div key={si2} className="flex items-start gap-2 text-[11px]">
                                                                        <span className={`mt-0.5 flex-shrink-0 w-2 h-2 rounded-full ${step.dot}`} />
                                                                        <span className={`font-semibold ${step.color}`}>{step.label}:</span>
                                                                        <span className="text-gray-700 dark:text-gray-300 font-medium">{step.actor || '—'}</span>
                                                                        {step.time && <span className="text-gray-400 ml-auto whitespace-nowrap">{fmtDT(step.time)}</span>}
                                                                    </div>
                                                                ) : null
                                                            ))}
                                                            {tr.cancellationReason && (
                                                                <div className="flex items-center gap-2 text-[11px] text-red-500">
                                                                    <span className="w-2 h-2 rounded-full bg-red-300 flex-shrink-0" />
                                                                    <span>Reason: {tr.cancellationReason}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {/* Step progress bar */}
                                                    {tr.status !== 'cancelled' && (
                                                        <div className="flex items-center gap-1">
                                                            {TRANSFER_STEPS.map((step, idx) => (
                                                                <React.Fragment key={step.key}>
                                                                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold transition-all ${idx <= si ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
                                                                        {step.icon}{step.label}
                                                                    </div>
                                                                    {idx < TRANSFER_STEPS.length - 1 && <ChevronRight className={`w-3 h-3 ${idx < si ? 'text-indigo-500' : 'text-gray-300'}`} />}
                                                                </React.Fragment>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                {/* Action row — branch-RBAC enforced */}
                                                {!['received', 'cancelled'].includes(tr.status) && (
                                                    <div className="flex gap-2 mt-2">
                                                        {tr.status === 'requested' && canApproveOrDispatch(tr) && <button onClick={() => handleTransferAction(tr.id, 'approved')} className="px-3 py-1 rounded bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700" disabled={submitting}>✓ Approve</button>}
                                                        {tr.status === 'approved' && canApproveOrDispatch(tr) && <button onClick={() => handleTransferAction(tr.id, 'in_transit')} className="px-3 py-1 rounded bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700" disabled={submitting}>🚚 Mark Dispatched</button>}
                                                        {tr.status === 'in_transit' && canReceiveTransfer(tr) && <button onClick={() => handleTransferAction(tr.id, 'received')} className="px-3 py-1 rounded bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700" disabled={submitting}>📦 Mark Received</button>}
                                                        {isSuperAdmin && <button onClick={() => { const r = prompt('Cancellation reason:'); if (r !== null) handleTransferAction(tr.id, 'cancelled', r); }} className="px-3 py-1 rounded bg-red-100 text-red-700 text-xs font-semibold hover:bg-red-200" disabled={submitting}>✕ Cancel</button>}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ════════════════════════════════════════════════════
                        TAB: EXPIRED STOCK
                    ════════════════════════════════════════════════════ */}
                    {activeTab === 'expired' && (
                        <div className="space-y-4">
                            {/* Annual summary */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><BarChart3 className="w-5 h-5 text-red-500" />Annual Waste Summary</h2>
                                    <div className="flex items-center gap-2">
                                        <select value={expiredYearFilter} onChange={e => setExpiredYearFilter(Number(e.target.value))} className="p-1.5 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600">
                                            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                        {isSuperAdmin && <button onClick={() => setIsExpiredModalOpen(true)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5"><Plus className="w-4 h-4" />Move to Expired</button>}
                                    </div>
                                </div>
                                {Object.keys(wasteByMed).length === 0 ? (
                                    <p className="text-gray-400 text-sm">No expired stock quarantined in {expiredYearFilter}.</p>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                        {Object.values(wasteByMed).map((w, i) => (
                                            <div key={i} className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
                                                <div className="text-xs text-red-600 dark:text-red-400 font-medium truncate">{w.name}</div>
                                                <div className="text-2xl font-bold text-red-700 dark:text-red-300">{w.qty}</div>
                                                <div className="text-[10px] text-red-500">units wasted</div>
                                            </div>
                                        ))}
                                        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 flex flex-col justify-center">
                                            <div className="text-xs text-gray-500 font-medium">Total Waste {expiredYearFilter}</div>
                                            <div className="text-2xl font-bold text-gray-800 dark:text-white">{expiredThisYear.reduce((s, r) => s + r.quantity, 0)}</div>
                                            <div className="text-[10px] text-gray-400">units across {expiredThisYear.length} record(s)</div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Records table */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                                <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                                    <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Archive className="w-5 h-5 text-red-500" />Expired Stock Records ({expiredYearFilter})</h2>
                                </div>
                                {expiredThisYear.length === 0 ? <div className="text-center py-10 text-gray-400">No records for {expiredYearFilter}.</div> : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 dark:bg-gray-700/50">
                                                <tr className="text-xs text-gray-500 uppercase tracking-wide">
                                                    <th className="px-4 py-3 text-left">Medicine</th><th className="px-4 py-3 text-left">Qty</th><th className="px-4 py-3 text-left">Location</th><th className="px-4 py-3 text-left">Expiry</th><th className="px-4 py-3 text-left">Moved By</th><th className="px-4 py-3 text-left">Moved At</th><th className="px-4 py-3 text-left">Disposal</th><th className="px-4 py-3 text-left">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                {expiredThisYear.map(r => (
                                                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{r.medicineName}</td>
                                                        <td className="px-4 py-3 text-red-600 font-semibold">{r.quantity}</td>
                                                        <td className="px-4 py-3 text-gray-500">{getClinicName(r.location)}</td>
                                                        <td className="px-4 py-3 text-gray-500">{r.expiryDate}</td>
                                                        <td className="px-4 py-3 text-gray-500">{r.movedBy}</td>
                                                        <td className="px-4 py-3 text-gray-500">{new Date(r.movedAt).toLocaleDateString()}</td>
                                                        <td className="px-4 py-3">{r.disposalDate ? <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3" />{r.disposalDate}</span> : <span className="text-gray-400 text-xs">Pending</span>}</td>
                                                        <td className="px-4 py-3">
                                                            {isSuperAdmin && !r.disposalDate && (
                                                                <button onClick={() => setDisposalForm({ id: r.id, date: new Date().toISOString().split('T')[0], notes: '' })} className="text-xs text-indigo-600 hover:underline">Record Disposal</button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ════════════════════════════════════════════════════
                        TAB: ADJUSTMENTS
                    ════════════════════════════════════════════════════ */}
                    {activeTab === 'adjustments' && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><SlidersHorizontal className="w-5 h-5 text-violet-500" />Stock Adjustment Audit Trail</h2>
                                {canEditInventory && <button onClick={() => setIsAdjustModalOpen(true)} className="bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5"><Plus className="w-4 h-4" />New Adjustment</button>}
                            </div>
                            {adjustments.length === 0 ? <div className="text-center py-14 text-gray-400">No adjustments recorded yet.</div> : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                                            <tr className="text-xs text-gray-500 uppercase tracking-wide">
                                                <th className="px-4 py-3 text-left">Medicine</th><th className="px-4 py-3 text-left">Location</th><th className="px-4 py-3 text-left">Before</th><th className="px-4 py-3 text-left">After</th><th className="px-4 py-3 text-left">Δ</th><th className="px-4 py-3 text-left">Adjusted By</th><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Reason</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                            {adjustments.map(a => {
                                                const delta = a.newQty - a.previousQty;
                                                return (
                                                    <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{a.medicineName}</td>
                                                        <td className="px-4 py-3 text-gray-500">{getClinicName(a.location)}</td>
                                                        <td className="px-4 py-3 text-gray-500">{a.previousQty}</td>
                                                        <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{a.newQty}</td>
                                                        <td className="px-4 py-3"><span className={`font-semibold ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : 'text-gray-400'}`}>{delta > 0 ? '+' : ''}{delta}</span></td>
                                                        <td className="px-4 py-3 text-gray-500">{a.adjustedBy}</td>
                                                        <td className="px-4 py-3 text-gray-500">{new Date(a.adjustedAt).toLocaleString()}</td>
                                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-xs truncate" title={a.reason}>{a.reason}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>

            {/* ════════════════════════════════════════════════════════════
                MODALS
            ════════════════════════════════════════════════════════════ */}

            {/* ── Transfer Request Modal ── */}
            {isTransferModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 shadow-xl">
                        <h2 className="text-xl font-bold mb-1 flex items-center gap-2"><Truck className="w-5 h-5 text-amber-500" />New Transfer Request</h2>
                        <p className="text-sm text-gray-500 mb-4">Stock will be reserved from source when approved by an admin.</p>

                        {/* Step indicator */}
                        <div className="flex items-center gap-1 mb-5 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-800">
                            {TRANSFER_STEPS.map((step, idx) => (
                                <React.Fragment key={step.key}>
                                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold ${idx === 0 ? 'bg-amber-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>{step.icon}{step.label}</div>
                                    {idx < TRANSFER_STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-gray-300" />}
                                </React.Fragment>
                            ))}
                        </div>

                        <form onSubmit={handleTransferRequest} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Item *</label>
                                <select required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={transferForm.medicineId} onChange={e => setTransferForm({ ...transferForm, medicineId: e.target.value })}>
                                    <option value="">Select item…</option>
                                    {[...medicines].sort((a, b) => a.name.localeCompare(b.name)).map(m => <option key={m.id} value={m.id}>{m.name} (Central: {m.centralStock})</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">From *</label>
                                    <select required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={transferForm.fromLocation} onChange={e => setTransferForm({ ...transferForm, fromLocation: e.target.value })}>
                                        <option value="central">Central Store</option>
                                        {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">To Branch *</label>
                                    <select required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={transferForm.toLocation} onChange={e => setTransferForm({ ...transferForm, toLocation: e.target.value })}>
                                        <option value="">Select branch…</option>
                                        {clinics.filter(c => c.id !== transferForm.fromLocation).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Quantity *</label>
                                <input required type="number" min="1" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={transferForm.quantity} onChange={e => setTransferForm({ ...transferForm, quantity: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Notes</label>
                                <input type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={transferForm.notes} onChange={e => setTransferForm({ ...transferForm, notes: e.target.value })} placeholder="Optional notes" />
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                                ℹ️ Stock will be deducted from source once an Admin <strong>approves</strong> this request. You will see it reflected in the Transfers tab.
                            </div>
                            <div className="flex justify-end gap-3 mt-2">
                                <button type="button" onClick={() => setIsTransferModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
                                <button type="submit" disabled={submitting} className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50">{submitting ? 'Submitting…' : 'Submit Request'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Move to Expired Modal ── */}
            {isExpiredModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-xl">
                        <h2 className="text-xl font-bold mb-1 flex items-center gap-2"><Archive className="w-5 h-5 text-red-500" />Move to Expired Stock</h2>
                        <p className="text-sm text-gray-500 mb-4">This will remove the quantity from active stock and log it in the expired stock register.</p>
                        <form onSubmit={handleMoveToExpired} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Item *</label>
                                <select required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={expiredForm.medicineId} onChange={e => setExpiredForm({ ...expiredForm, medicineId: e.target.value })}>
                                    <option value="">Select item…</option>
                                    {[...medicines].sort((a, b) => a.name.localeCompare(b.name)).map(m => <option key={m.id} value={m.id}>{m.name}{m.expiryDate ? ` — Exp: ${m.expiryDate}` : ''}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Location *</label>
                                    <select required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={expiredForm.location} onChange={e => setExpiredForm({ ...expiredForm, location: e.target.value })}>
                                        <option value="central">Central Store</option>
                                        {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Quantity to Move *</label>
                                    <input required type="number" min="1" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={expiredForm.quantity} onChange={e => setExpiredForm({ ...expiredForm, quantity: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Batch Number (optional)</label>
                                <input type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={expiredForm.batchNumber} onChange={e => setExpiredForm({ ...expiredForm, batchNumber: e.target.value })} placeholder="e.g. BT-A001" />
                            </div>
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-lg text-xs text-red-700 dark:text-red-300">
                                ⚠️ This action is irreversible. The quantity will be permanently deducted from active stock.
                            </div>
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setIsExpiredModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
                                <button type="submit" disabled={submitting} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">{submitting ? 'Moving…' : 'Move to Expired'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Stock Adjustment Modal ── */}
            {isAdjustModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-xl">
                        <h2 className="text-xl font-bold mb-1 flex items-center gap-2"><SlidersHorizontal className="w-5 h-5 text-violet-500" />Adjust Stock</h2>
                        <p className="text-sm text-gray-500 mb-4">Set the corrected quantity. A full audit record will be created.</p>
                        <form onSubmit={handleStockAdjust} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Item *</label>
                                <select required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={adjustForm.medicineId} onChange={e => setAdjustForm({ ...adjustForm, medicineId: e.target.value })}>
                                    <option value="">Select item…</option>
                                    {[...medicines].sort((a, b) => a.name.localeCompare(b.name)).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Location *</label>
                                    <select required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={adjustForm.location} onChange={e => setAdjustForm({ ...adjustForm, location: e.target.value })}>
                                        <option value="central">Central Store</option>
                                        {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        New Quantity *
                                        {adjustForm.medicineId && adjustForm.location && (() => {
                                            const med = medicines.find(m => m.id === adjustForm.medicineId);
                                            if (!med) return null;
                                            const current = adjustForm.location === 'central' ? med.centralStock : ((med.branchStock || []).find(b => b.clinicId === adjustForm.location)?.quantity ?? 0);
                                            return <span className="text-xs text-gray-400 ml-1">(current: {current})</span>;
                                        })()}
                                    </label>
                                    <input required type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={adjustForm.newQty} onChange={e => setAdjustForm({ ...adjustForm, newQty: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Reason / Explanation <span className="text-red-500">*</span></label>
                                <textarea required rows={3} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 resize-none" value={adjustForm.reason} onChange={e => setAdjustForm({ ...adjustForm, reason: e.target.value })} placeholder="e.g. Physical count mismatch after stock-take on 15 Apr 2026" />
                            </div>
                            <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 p-3 rounded-lg text-xs text-violet-700 dark:text-violet-300">
                                🔒 This adjustment will be permanently logged with your name, timestamp and reason for audit purposes.
                            </div>
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setIsAdjustModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
                                <button type="submit" disabled={submitting} className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">{submitting ? 'Saving…' : 'Apply Adjustment'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Disposal Record Modal ── */}
            {disposalForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-xl">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><FlaskConical className="w-5 h-5 text-gray-500" />Record Disposal</h2>
                        <form onSubmit={handleUpdateDisposal} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Disposal Date *</label>
                                <input required type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={disposalForm.date} onChange={e => setDisposalForm({ ...disposalForm, date: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Disposal Notes</label>
                                <textarea rows={3} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 resize-none" value={disposalForm.notes} onChange={e => setDisposalForm({ ...disposalForm, notes: e.target.value })} placeholder="e.g. Incinerated via medical waste contractor on …" />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setDisposalForm(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
                                <button type="submit" disabled={submitting} className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">{submitting ? 'Saving…' : 'Save Disposal'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Add Medicine Modal ── */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4">Add Item to Inventory</h2>
                        <form onSubmit={handleAdd} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">1. Category *</label>
                                <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 font-medium" value={newMedicine.category} onChange={e => setNewMedicine({ ...newMedicine, category: e.target.value as 'medicine' | 'consumable' | 'em_medicine', registeredProductId: '', name: '', itemCode: '', price: '', purchaseUnit: '', itemsPerPurchaseUnit: '', consumableUnit: '' })}>
                                    <option value="medicine">Medicine</option>
                                    <option value="consumable">Consumable</option>
                                    <option value="em_medicine">EM Medicine</option>
                                </select>
                            </div>
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3 space-y-2">
                                <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5"><ClipboardCheck className="w-4 h-4" />2. Select from Product Registry</label>
                                <select className="w-full p-2 border border-indigo-200 dark:border-indigo-700 rounded-md text-sm dark:bg-gray-700" value={newMedicine.registeredProductId} onChange={e => handleRegisteredProductSelect(e.target.value)}>
                                    <option value="">— Select registered product (optional) —</option>
                                    {getUnlinkedProducts().filter(rp => rp.category === newMedicine.category).sort((a, b) => a.tradeName.localeCompare(b.tradeName)).map(rp => (
                                        <option key={rp.id} value={rp.id} disabled={isExpired(rp.registrationExpiry)}>{rp.tradeName} ({rp.itemCode}) — {rp.registrationBody}{isExpired(rp.registrationExpiry) ? ' ⛔ EXPIRED' : ''}</option>
                                    ))}
                                </select>
                                {newMedicine.registeredProductId && (() => {
                                    const rp = registeredProducts.find(p => p.id === newMedicine.registeredProductId);
                                    if (!rp) return null;
                                    return <div className="text-xs text-indigo-600 dark:text-indigo-400"><div className="flex items-center gap-1"><Link2 className="w-3 h-3" />{rp.genericName} · {rp.registrationBody}: {rp.registrationNumber}</div><div className="text-[10px] text-indigo-500 mt-0.5">🔒 Registry fields locked.</div></div>;
                                })()}
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Name *</label>
                                <input required type="text" className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 ${newMedicine.registeredProductId ? 'opacity-70 cursor-not-allowed bg-gray-100 dark:bg-gray-800' : ''}`} value={newMedicine.name} onChange={e => setNewMedicine({ ...newMedicine, name: e.target.value })} disabled={!!newMedicine.registeredProductId} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium mb-1">Item Code</label><input type="text" className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 ${newMedicine.registeredProductId ? 'opacity-70 cursor-not-allowed bg-gray-100 dark:bg-gray-800' : ''}`} value={newMedicine.itemCode} onChange={e => setNewMedicine({ ...newMedicine, itemCode: e.target.value })} disabled={!!newMedicine.registeredProductId} /></div>
                                <div><label className="block text-sm font-medium mb-1">Unit Price (AED) *</label><input required type="number" min="0" step="0.01" className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 ${newMedicine.registeredProductId ? 'opacity-70 cursor-not-allowed bg-gray-100 dark:bg-gray-800' : ''}`} value={newMedicine.price} onChange={e => setNewMedicine({ ...newMedicine, price: e.target.value })} disabled={!!newMedicine.registeredProductId} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-indigo-700 dark:text-indigo-400">Number of Purchase Units *</label>
                                    <input required type="number" min="1" className="w-full p-2 border-2 border-indigo-300 dark:border-indigo-600 rounded-md dark:bg-gray-700" value={newMedicine.purchasedUnits} onChange={e => setNewMedicine({ ...newMedicine, purchasedUnits: e.target.value })} placeholder="e.g. 5" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Central Stock (auto)</label>
                                    <div className="w-full p-2 border rounded-md bg-gray-100 dark:bg-gray-800 font-bold text-lg text-center">{(Number(newMedicine.purchasedUnits) || 0) * (Number(newMedicine.numberOfStoredType) || 1)}</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium mb-1">Batch Number</label><input type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={newMedicine.batchNumber} onChange={e => setNewMedicine({ ...newMedicine, batchNumber: e.target.value })} /></div>
                                <div><label className="block text-sm font-medium mb-1">Expiry Date</label><input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={newMedicine.expiryDate} onChange={e => setNewMedicine({ ...newMedicine, expiryDate: e.target.value })} /></div>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 rounded-lg text-sm text-blue-700 dark:text-blue-300">ℹ️ Items are added to the <strong>central store</strong>. Use Transfer Request to send stock to branches.</div>
                            <div className="flex justify-end gap-3 mt-4">
                                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
                                <button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">{submitting ? 'Adding…' : 'Add Item'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Edit Medicine Modal ── */}
            {isEditModalOpen && editingMedicine && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4">Edit Item</h2>
                        <form onSubmit={handleUpdate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Name *</label>
                                <input required type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={editingMedicine.name} onChange={e => setEditingMedicine({ ...editingMedicine, name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium mb-1">Item Code</label><input type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={editingMedicine.itemCode || ''} onChange={e => setEditingMedicine({ ...editingMedicine, itemCode: e.target.value || undefined })} /></div>
                                <div><label className="block text-sm font-medium mb-1">Price (AED) *</label><input required type="number" min="0" step="0.01" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={editingMedicine.price} onChange={e => setEditingMedicine({ ...editingMedicine, price: Number(e.target.value) })} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium mb-1">Central Stock</label><input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={editingMedicine.centralStock} onChange={e => setEditingMedicine({ ...editingMedicine, centralStock: Number(e.target.value) })} /></div>
                                <div><label className="block text-sm font-medium mb-1">Min Central Stock</label><input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={editingMedicine.minCentralStock ?? ''} onChange={e => setEditingMedicine({ ...editingMedicine, minCentralStock: e.target.value ? Number(e.target.value) : undefined })} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium mb-1">Category</label><select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={editingMedicine.category || 'medicine'} onChange={e => setEditingMedicine({ ...editingMedicine, category: e.target.value as 'medicine' | 'consumable' | 'em_medicine' })}><option value="medicine">Medicine</option><option value="consumable">Consumable</option><option value="em_medicine">EM Medicine</option></select></div>
                                <div><label className="block text-sm font-medium mb-1">Expiry Date</label><input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={editingMedicine.expiryDate || ''} onChange={e => setEditingMedicine({ ...editingMedicine, expiryDate: e.target.value })} /></div>
                            </div>
                            {(editingMedicine.branchStock || []).length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium mb-2">Branch Stock &amp; Minimums</label>
                                    <div className="space-y-2">
                                        {editingMedicine.branchStock.map((bs, idx) => (
                                            <div key={bs.clinicId} className="flex items-center gap-2 text-sm">
                                                <span className="flex-1 text-gray-700 dark:text-gray-300 truncate">{getClinicName(bs.clinicId)}</span>
                                                <span className="text-gray-500 w-14 text-right">Qty: {bs.quantity}</span>
                                                <input type="number" min="0" className="w-20 p-1.5 text-xs border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                                    value={bs.minQuantity ?? ''}
                                                    onChange={e => { const updated = [...editingMedicine.branchStock]; updated[idx] = { ...updated[idx], minQuantity: e.target.value ? Number(e.target.value) : undefined }; setEditingMedicine({ ...editingMedicine, branchStock: updated }); }}
                                                    placeholder="Min" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-end gap-3 mt-4">
                                <button type="button" onClick={() => { setIsEditModalOpen(false); setEditingMedicine(null); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
                                <button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">{submitting ? 'Saving…' : 'Save Changes'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Pill, Package, CalendarClock, Warehouse, ArrowRightLeft, MapPin, AlertTriangle, BellOff, Bell, Hash, Boxes, Droplets, ClipboardCheck, Link2, ExternalLink, Search } from 'lucide-react';
import { Medicine, Clinic, RegisteredProduct, Supplier } from '@/lib/data';

export default function MedicinesPage() {
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [clinics, setClinics] = useState<Clinic[]>([]);
    const [registeredProducts, setRegisteredProducts] = useState<RegisteredProduct[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDistributeOpen, setIsDistributeOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [newMedicine, setNewMedicine] = useState({ name: '', price: '', centralStock: '', expiryDate: '', category: 'medicine' as 'medicine' | 'consumable' | 'em_medicine', minCentralStock: '', itemCode: '', purchaseUnit: '', itemsPerPurchaseUnit: '', consumableUnit: '', registeredProductId: '', batchNumber: '', storedType: '', numberOfStoredType: '', consumableItemsInside: '', purchasedUnits: '' });
    const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
    const [distributeForm, setDistributeForm] = useState({ medicineId: '', fromClinicId: '', toClinicId: '', quantity: '', distributedDate: new Date().toISOString().split('T')[0], notes: '' });

    useEffect(() => {
        Promise.all([
            fetch('/api/admin/medicines').then(r => r.json()),
            fetch('/api/admin/clinics').then(r => r.json()),
            fetch('/api/admin/registered-products').then(r => r.json()),
            fetch('/api/admin/suppliers').then(r => r.json()),
        ]).then(([meds, cls, rps, sups]) => {
            setMedicines(Array.isArray(meds) ? meds : []);
            setClinics(Array.isArray(cls) ? cls : []);
            setRegisteredProducts(Array.isArray(rps) ? rps : []);
            setSuppliers(Array.isArray(sups) ? sups : []);
        }).catch(e => console.error(e)).finally(() => setLoading(false));
    }, []);

    const fetchMedicines = async () => {
        const res = await fetch('/api/admin/medicines');
        const data = await res.json();
        setMedicines(Array.isArray(data) ? data : []);
    };

    // When selecting a registered product, auto-fill fields
    const handleRegisteredProductSelect = (rpId: string) => {
        const rp = registeredProducts.find(p => p.id === rpId);
        if (rp) {
            setNewMedicine({
                ...newMedicine,
                registeredProductId: rpId,
                name: rp.tradeName,
                itemCode: rp.itemCode,
                price: String(rp.consumableItemsInside && Number(rp.consumableItemsInside) > 0 ? +(Number(rp.registeredPrice) / Number(rp.consumableItemsInside)).toFixed(2) : rp.registeredPrice),
                category: rp.category === 'em_medicine' ? 'medicine' : rp.category,
                purchaseUnit: rp.purchaseUnit,
                itemsPerPurchaseUnit: String(rp.consumableItemsInside),
                consumableUnit: rp.consumableUnit,
                storedType: rp.storedType || '',
                numberOfStoredType: String(rp.numberOfStoredType || ''),
                consumableItemsInside: String(rp.consumableItemsInside || ''),
                minCentralStock: String(rp.minCentralStock || ''),
            });
        } else {
            setNewMedicine({ ...newMedicine, registeredProductId: '' });
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await fetch('/api/admin/medicines', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newMedicine.name,
                    price: Number(newMedicine.price),
                    centralStock: (Number(newMedicine.purchasedUnits) || 0) * (Number(newMedicine.numberOfStoredType) || 1),
                    branchStock: [],
                    expiryDate: newMedicine.expiryDate || undefined,
                    category: newMedicine.category,
                    minCentralStock: newMedicine.minCentralStock ? Number(newMedicine.minCentralStock) : undefined,
                    itemCode: newMedicine.itemCode || undefined,
                    purchaseUnit: newMedicine.purchaseUnit || undefined,
                    itemsPerPurchaseUnit: newMedicine.itemsPerPurchaseUnit ? Number(newMedicine.itemsPerPurchaseUnit) : undefined,
                    consumableUnit: newMedicine.consumableUnit || undefined,
                    registeredProductId: newMedicine.registeredProductId || undefined,
                    batchNumber: newMedicine.batchNumber || undefined,
                    storedType: newMedicine.storedType || undefined,
                    numberOfStoredType: newMedicine.numberOfStoredType ? Number(newMedicine.numberOfStoredType) : undefined,
                    consumableItemsInside: newMedicine.consumableItemsInside ? Number(newMedicine.consumableItemsInside) : undefined,
                })
            });
            if (res.ok) {
                await fetchMedicines();
                setIsAddModalOpen(false);
                setNewMedicine({ name: '', price: '', centralStock: '', expiryDate: '', category: 'medicine' as 'medicine' | 'consumable' | 'em_medicine', minCentralStock: '', itemCode: '', purchaseUnit: '', itemsPerPurchaseUnit: '', consumableUnit: '', registeredProductId: '', batchNumber: '', storedType: '', numberOfStoredType: '', consumableItemsInside: '', purchasedUnits: '' });
            } else alert('Failed to add medicine');
        } catch (e) { console.error(e); } finally { setSubmitting(false); }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingMedicine) return;
        setSubmitting(true);
        try {
            const res = await fetch('/api/admin/medicines', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingMedicine.id,
                    name: editingMedicine.name,
                    price: Number(editingMedicine.price),
                    centralStock: Number(editingMedicine.centralStock),
                    branchStock: editingMedicine.branchStock,
                    expiryDate: editingMedicine.expiryDate || undefined,
                    category: editingMedicine.category,
                    minCentralStock: editingMedicine.minCentralStock !== undefined ? editingMedicine.minCentralStock : undefined,
                    itemCode: editingMedicine.itemCode || undefined,
                    purchaseUnit: editingMedicine.purchaseUnit || undefined,
                    itemsPerPurchaseUnit: editingMedicine.itemsPerPurchaseUnit !== undefined ? editingMedicine.itemsPerPurchaseUnit : undefined,
                    consumableUnit: editingMedicine.consumableUnit || undefined,
                    registeredProductId: editingMedicine.registeredProductId || undefined,
                    batchNumber: editingMedicine.batchNumber || undefined,
                    storedType: editingMedicine.storedType || undefined,
                    numberOfStoredType: editingMedicine.numberOfStoredType !== undefined ? editingMedicine.numberOfStoredType : undefined,
                    consumableItemsInside: editingMedicine.consumableItemsInside !== undefined ? editingMedicine.consumableItemsInside : undefined,
                })
            });
            if (res.ok) {
                await fetchMedicines();
                setIsEditModalOpen(false);
                setEditingMedicine(null);
            } else alert('Failed to update');
        } catch (e) { console.error(e); } finally { setSubmitting(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this item?')) return;
        try {
            const res = await fetch(`/api/admin/medicines?id=${id}`, { method: 'DELETE' });
            if (res.ok) await fetchMedicines();
            else alert('Failed to delete');
        } catch (e) { console.error(e); }
    };

    const handleDistribute = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await fetch('/api/admin/distribution', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    medicineId: distributeForm.medicineId,
                    fromClinicId: distributeForm.fromClinicId || undefined,
                    toClinicId: distributeForm.toClinicId,
                    quantity: Number(distributeForm.quantity),
                    distributedDate: distributeForm.distributedDate,
                    notes: distributeForm.notes || undefined
                })
            });
            if (res.ok) {
                await fetchMedicines();
                setIsDistributeOpen(false);
                setDistributeForm({ medicineId: '', fromClinicId: '', toClinicId: '', quantity: '', distributedDate: new Date().toISOString().split('T')[0], notes: '' });
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to distribute');
            }
        } catch (e) { console.error(e); } finally { setSubmitting(false); }
    };

    const getClinicName = (id: string) => clinics.find(c => c.id === id)?.name || id;
    const getTotalStock = (med: Medicine) => med.centralStock + (med.branchStock || []).reduce((s, b) => s + b.quantity, 0);
    const isBelowMin = (qty: number, min?: number) => min !== undefined && min > 0 && qty < min;
    const isNearMin = (qty: number, min?: number) => min !== undefined && min > 0 && qty >= min && qty <= min * 1.5;
    const isAnyBelowMin = (med: Medicine) => isBelowMin(med.centralStock, med.minCentralStock) || (med.branchStock || []).some(bs => isBelowMin(bs.quantity, bs.minQuantity));

    const getRegisteredProduct = (med: Medicine) => med.registeredProductId ? registeredProducts.find(rp => rp.id === med.registeredProductId) : undefined;
    const getSupplierName = (supplierId: string) => suppliers.find(s => s.id === supplierId)?.name || supplierId;
    const isExpired = (date: string) => new Date(date) < new Date();

    // Get unlinked registered products (not yet in inventory)
    const getUnlinkedProducts = () => {
        const linkedIds = medicines.map(m => m.registeredProductId).filter(Boolean);
        return registeredProducts.filter(rp => !linkedIds.includes(rp.id));
    };

    const getProductSuppliersStr = (rp: RegisteredProduct) => {
        const sIds = rp.registeredSupplierIds?.length ? rp.registeredSupplierIds : (rp.registeredSupplierId ? [rp.registeredSupplierId] : []);
        if (sIds.length === 0) return 'None';
        return sIds.map(id => getSupplierName(id)).join(', ');
    };

    const handleToggleNotified = async (med: Medicine) => {
        try {
            await fetch('/api/admin/medicines', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: med.id, isNotified: !med.isNotified })
            });
            await fetchMedicines();
        } catch (e) { console.error(e); }
    };

    if (loading) return <div className="p-8">Loading inventory...</div>;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-5xl mx-auto">
                <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Inventory</h1>
                        <p className="text-gray-600 dark:text-gray-400">Medicines & consumables with per-branch stock tracking. Linked to Product Registry.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Search by name or code..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full sm:w-64 pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                            />
                        </div>
                        <button onClick={() => setIsDistributeOpen(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors">
                            <ArrowRightLeft className="w-4 h-4" /> Distribute to Branch
                        </button>
                        <button onClick={() => setIsAddModalOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors">
                            <Plus className="w-4 h-4" /> Add Item
                        </button>
                    </div>
                </header>

                {/* Medicine List */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {medicines.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">No items in the inventory yet.</div>
                        ) : [...medicines]
                            .filter(med => 
                                med.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                (med.itemCode && med.itemCode.toLowerCase().includes(searchTerm.toLowerCase()))
                            )
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(med => {
                            const rp = getRegisteredProduct(med);
                            return (
                                <div key={med.id} className="p-5 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                                    {/* Top Row: Name, category, price, actions */}
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2.5 rounded-lg ${med.category === 'consumable' ? 'bg-orange-100 dark:bg-orange-900/30' : med.category === 'em_medicine' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                                                <Pill className={`w-5 h-5 ${med.category === 'consumable' ? 'text-orange-600 dark:text-orange-400' : med.category === 'em_medicine' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold text-gray-900 dark:text-white">{med.name}</h3>
                                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${med.category === 'consumable' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : med.category === 'em_medicine' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                                        {med.category === 'consumable' ? 'Consumable' : med.category === 'em_medicine' ? 'EM Medicine' : 'Medicine'}
                                                    </span>
                                                    {/* Registry Link Badge */}
                                                    {rp ? (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" title={`Linked to ${rp.tradeName} (${rp.registrationNumber})`}>
                                                            <ClipboardCheck className="w-3 h-3" /> Registered
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                                            <AlertTriangle className="w-3 h-3" /> Unregistered
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 mt-0.5 text-sm text-gray-500">
                                                    <span className="flex items-center gap-1"><span className="text-xs font-semibold">د.إ</span> {med.price} AED</span>
                                                    {med.itemCode && <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"><Hash className="w-3 h-3" />{med.itemCode}</span>}
                                                    {med.purchaseUnit && <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"><Boxes className="w-3 h-3" />{med.purchaseUnit}{med.itemsPerPurchaseUnit ? ` (${med.itemsPerPurchaseUnit})` : ''}</span>}
                                                    {med.consumableUnit && <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400"><Droplets className="w-3 h-3" />{med.consumableUnit}</span>}
                                                    {med.expiryDate && (() => {
                                                        const daysLeft = Math.ceil((new Date(med.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                                                        return (
                                                            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${daysLeft <= 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                                : daysLeft <= 90 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                                                }`}>
                                                                <CalendarClock className="w-3 h-3" />
                                                                {daysLeft <= 0 ? 'Expired' : daysLeft <= 90 ? `Expires in ${daysLeft}d` : `Exp: ${med.expiryDate}`}
                                                            </span>
                                                        );
                                                    })()}
                                                    <span className="font-medium text-gray-700 dark:text-gray-300">Total: {getTotalStock(med)}</span>
                                                    {isAnyBelowMin(med) ? (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                                            <AlertTriangle className="w-3 h-3" /> Low Stock
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {/* Notified checkbox */}
                                            {isAnyBelowMin(med) && (
                                                <button onClick={() => handleToggleNotified(med)}
                                                    className={`p-2 rounded-full transition-colors ${med.isNotified ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700' : 'text-amber-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20'}`}
                                                    title={med.isNotified ? 'Alert acknowledged — click to reset' : 'Click to acknowledge low-stock alert'}>
                                                    {med.isNotified ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                                                </button>
                                            )}
                                            <button onClick={() => { setDistributeForm({ ...distributeForm, medicineId: med.id }); setIsDistributeOpen(true); }}
                                                className="text-emerald-500 hover:text-emerald-700 p-2 rounded-full hover:bg-emerald-50 dark:hover:bg-emerald-900/20" title="Distribute to Branch">
                                                <ArrowRightLeft className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => { setEditingMedicine({ ...med }); setIsEditModalOpen(true); }}
                                                className="text-indigo-500 hover:text-indigo-700 p-2 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/20" title="Edit">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(med.id)}
                                                className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Registration Info Row */}
                                    {rp && (
                                        <div className="ml-14 mb-2 space-y-1.5">
                                            <div className="flex flex-wrap gap-3 items-center text-xs text-gray-500">
                                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${rp.category === 'consumable' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : rp.category === 'em_medicine' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                                    {rp.category === 'consumable' ? 'Consumable' : rp.category === 'em_medicine' ? 'EM Medicine' : 'Medicine'}
                                                </span>
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/15 text-indigo-600 dark:text-indigo-400">
                                                    <Link2 className="w-3 h-3" /> {rp.tradeName} ({rp.genericName})
                                                </span>
                                                <span className="font-mono text-[10px]">{rp.registrationBody}: {rp.registrationNumber}</span>
                                                {rp.registrationExpiry && (
                                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${isExpired(rp.registrationExpiry) ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
                                                        {isExpired(rp.registrationExpiry) ? '⛔ Reg. Expired' : `✓ Reg. until ${rp.registrationExpiry}`}
                                                    </span>
                                                )}
                                                <span className="text-gray-400">Supplier: {getProductSuppliersStr(rp)}</span>
                                                {rp.registeredSubAgent && <span className="text-gray-400">via {rp.registeredSubAgent}</span>}
                                            </div>
                                            {/* Purchase & Consumable Parameters */}
                                            <div className="flex flex-wrap gap-2 items-center text-[10px]">
                                                {rp.purchaseUnit && (
                                                    <span className="inline-flex items-center gap-1 font-medium px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400">
                                                        <Boxes className="w-3 h-3" /> Purchase Unit: {rp.purchaseUnit}
                                                    </span>
                                                )}
                                                {rp.storedType && (
                                                    <span className="inline-flex items-center gap-1 font-medium px-1.5 py-0.5 rounded-full bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-900/20 dark:text-fuchsia-400">
                                                        Stored Type: {rp.storedType}
                                                    </span>
                                                )}
                                                {rp.numberOfStoredType > 0 && (
                                                    <span className="inline-flex items-center gap-1 font-medium px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400">
                                                        No. of Stored Type: {rp.numberOfStoredType}
                                                    </span>
                                                )}
                                                {rp.consumableItemsInside > 0 && (
                                                    <span className="inline-flex items-center gap-1 font-medium px-1.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-400">
                                                        Consumable Items Inside: {rp.consumableItemsInside}
                                                    </span>
                                                )}
                                                {rp.consumableUnit && (
                                                    <span className="inline-flex items-center gap-1 font-medium px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400">
                                                        <Droplets className="w-3 h-3" /> Consumable Unit: {rp.consumableUnit}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Stock Breakdown Row */}
                                    <div className="flex flex-wrap gap-2 ml-14">
                                        {/* Total Stock */}
                                        <div className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300 shadow-sm">
                                            <Boxes className="w-4 h-4" />
                                            Total Stock: {getTotalStock(med)}
                                        </div>

                                        {/* Central Stock */}
                                        <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border ${isBelowMin(med.centralStock, med.minCentralStock) || med.centralStock <= 0 ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
                                            : isNearMin(med.centralStock, med.minCentralStock) || med.centralStock <= 10 ? 'bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-400'
                                                : 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-400'
                                            }`}>
                                            <Warehouse className="w-3.5 h-3.5" />
                                            Central: {med.centralStock}{med.minCentralStock ? ` (min ${med.minCentralStock})` : ''}
                                        </div>

                                        {/* Branch Stock */}
                                        {(med.branchStock || []).map(bs => (
                                            <div key={bs.clinicId} className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border ${isBelowMin(bs.quantity, bs.minQuantity) || bs.quantity <= 0 ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
                                                : isNearMin(bs.quantity, bs.minQuantity) || bs.quantity <= 5 ? 'bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-400'
                                                    : 'bg-teal-50 border-teal-200 text-teal-700 dark:bg-teal-900/20 dark:border-teal-800 dark:text-teal-400'
                                                }`}>
                                                <MapPin className="w-3.5 h-3.5" />
                                                {getClinicName(bs.clinicId)}: {bs.quantity}{bs.minQuantity ? ` (min ${bs.minQuantity})` : ''}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Add Modal */}
                {isAddModalOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
                            <h2 className="text-xl font-bold mb-4">Add Item to Inventory</h2>
                            <form onSubmit={handleAdd} className="space-y-4">
                                {/* Step 1: Choose Category */}
                                <div>
                                    <label className="block text-sm font-medium mb-1">1. Category *</label>
                                    <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 font-medium"
                                        value={newMedicine.category} onChange={e => setNewMedicine({ ...newMedicine, category: e.target.value as 'medicine' | 'consumable' | 'em_medicine', registeredProductId: '', name: '', itemCode: '', price: '', purchaseUnit: '', itemsPerPurchaseUnit: '', consumableUnit: '' })}>
                                        <option value="medicine">Medicine</option>
                                        <option value="consumable">Consumable</option>
                                        <option value="em_medicine">EM Medicine</option>
                                    </select>
                                </div>

                                {/* Step 2: Link to Product Registry (filtered by category, sorted A-Z) */}
                                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3 space-y-2">
                                    <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                                        <ClipboardCheck className="w-4 h-4" /> 2. Select from Product Registry
                                    </label>
                                    <select className="w-full p-2 border border-indigo-200 dark:border-indigo-700 rounded-md text-sm dark:bg-gray-700"
                                        value={newMedicine.registeredProductId} onChange={e => handleRegisteredProductSelect(e.target.value)}>
                                        <option value="">— Select registered product (optional) —</option>
                                        {getUnlinkedProducts()
                                            .filter(rp => rp.category === newMedicine.category)
                                            .sort((a, b) => a.tradeName.localeCompare(b.tradeName))
                                            .map(rp => (
                                                <option key={rp.id} value={rp.id} disabled={isExpired(rp.registrationExpiry)}>
                                                    {rp.tradeName} ({rp.itemCode}) — {rp.registrationBody}{isExpired(rp.registrationExpiry) ? ' ⛔ EXPIRED' : ''}
                                                </option>
                                            ))}
                                    </select>
                                    {newMedicine.registeredProductId && (() => {
                                        const rp = registeredProducts.find(p => p.id === newMedicine.registeredProductId);
                                        if (!rp) return null;
                                        return (
                                            <div className="text-xs text-indigo-600 dark:text-indigo-400 space-y-0.5">
                                                <div className="flex items-center gap-1"><Link2 className="w-3 h-3" /> {rp.genericName} · {rp.registrationBody}: {rp.registrationNumber}</div>
                                                <div>Supplier: {getProductSuppliersStr(rp)} {rp.registeredSubAgent ? `via ${rp.registeredSubAgent}` : ''}</div>
                                                <div className="text-[10px] text-indigo-500 flex items-center gap-1">🔒 Registry fields are locked. Only enter purchased units below.</div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">Name *</label>
                                    <input required type="text" className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 ${newMedicine.registeredProductId ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-70' : ''}`}
                                        value={newMedicine.name} onChange={e => setNewMedicine({ ...newMedicine, name: e.target.value })} placeholder="e.g. Hyaluronic Acid Serum" disabled={!!newMedicine.registeredProductId} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Item Code</label>
                                        <input type="text" className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 ${newMedicine.registeredProductId ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-70' : ''}`}
                                            value={newMedicine.itemCode} onChange={e => setNewMedicine({ ...newMedicine, itemCode: e.target.value })} placeholder="e.g. MED-001" disabled={!!newMedicine.registeredProductId} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Consumable Unit Price (AED) *</label>
                                        <input required type="number" min="0" step="0.01" className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 ${newMedicine.registeredProductId ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-70' : ''}`}
                                            value={newMedicine.price} onChange={e => setNewMedicine({ ...newMedicine, price: e.target.value })} disabled={!!newMedicine.registeredProductId} />
                                    </div>
                                </div>
                                {/* Number of Purchase Unit & Central Stock */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-indigo-700 dark:text-indigo-400">Number of Purchase Unit *</label>
                                        <input required type="number" min="1" className="w-full p-2 border-2 border-indigo-300 dark:border-indigo-600 rounded-md dark:bg-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                            value={newMedicine.purchasedUnits} onChange={e => setNewMedicine({ ...newMedicine, purchasedUnits: e.target.value })} placeholder="e.g. 5" />
                                        <p className="text-[10px] text-gray-500 mt-0.5">How many {newMedicine.purchaseUnit || 'units'} purchased</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Central Stock (auto-calculated)</label>
                                        <div className="w-full p-2 border rounded-md bg-gray-100 dark:bg-gray-800 dark:border-gray-600 font-bold text-lg text-center">
                                            {(Number(newMedicine.purchasedUnits) || 0) * (Number(newMedicine.numberOfStoredType) || 1)}
                                        </div>
                                        <p className="text-[10px] text-gray-500 mt-0.5">{newMedicine.purchasedUnits || '0'} {newMedicine.purchaseUnit || 'units'} × {newMedicine.numberOfStoredType || '1'} {newMedicine.storedType || 'items'} each</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Purchase Unit</label>
                                        <select className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 ${newMedicine.registeredProductId ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-70' : ''}`}
                                            value={newMedicine.purchaseUnit} onChange={e => setNewMedicine({ ...newMedicine, purchaseUnit: e.target.value })} disabled={!!newMedicine.registeredProductId}>
                                            <option value="">Select...</option>
                                            <option value="Box">Box</option>
                                            <option value="Vial">Vial</option>
                                            <option value="Bottle">Bottle</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Stored Type</label>
                                        <select className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 ${newMedicine.registeredProductId ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-70' : ''}`}
                                            value={newMedicine.storedType} onChange={e => setNewMedicine({ ...newMedicine, storedType: e.target.value })} disabled={!!newMedicine.registeredProductId}>
                                            <option value="">Select...</option>
                                            <option value="Packet">Packet</option>
                                            <option value="Bottle">Bottle</option>
                                            <option value="Vial">Vial</option>
                                            <option value="Prefilled Syringe">Prefilled Syringe</option>
                                            <option value="Strips">Strips</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">No. of Stored Type</label>
                                        <input type="number" min="0" className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 ${newMedicine.registeredProductId ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-70' : ''}`}
                                            value={newMedicine.numberOfStoredType} onChange={e => setNewMedicine({ ...newMedicine, numberOfStoredType: e.target.value })} placeholder="e.g. 10" disabled={!!newMedicine.registeredProductId} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Consumable Items Inside</label>
                                        <input type="number" min="0" className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 ${newMedicine.registeredProductId ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-70' : ''}`}
                                            value={newMedicine.consumableItemsInside} onChange={e => setNewMedicine({ ...newMedicine, consumableItemsInside: e.target.value })} placeholder="e.g. 100" disabled={!!newMedicine.registeredProductId} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Consumable Unit</label>
                                        <select className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 ${newMedicine.registeredProductId ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-70' : ''}`}
                                            value={newMedicine.consumableUnit} onChange={e => setNewMedicine({ ...newMedicine, consumableUnit: e.target.value })} disabled={!!newMedicine.registeredProductId}>
                                            <option value="">Select...</option>
                                            <option value="ml">ml</option>
                                            <option value="Vial">Vial</option>
                                            <option value="Prefilled Syringe">Prefilled Syringe</option>
                                            <option value="pcs">pcs</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Batch Number</label>
                                        <input type="text" className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 ${newMedicine.registeredProductId ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-70' : ''}`}
                                            value={newMedicine.batchNumber} onChange={e => setNewMedicine({ ...newMedicine, batchNumber: e.target.value })} placeholder="e.g. BT-A001" disabled={!!newMedicine.registeredProductId} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Expiry Date</label>
                                        <input type="date" className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 ${newMedicine.registeredProductId ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-70' : ''}`}
                                            value={newMedicine.expiryDate} onChange={e => setNewMedicine({ ...newMedicine, expiryDate: e.target.value })} disabled={!!newMedicine.registeredProductId} />
                                    </div>
                                </div>
                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                                    ℹ️ Items are added to the <strong>central store</strong>. Use &quot;Distribute to Branch&quot; to send stock to clinics.
                                </div>
                                <div className="flex justify-end gap-3 mt-6">
                                    <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
                                    <button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                                        {submitting ? 'Adding...' : 'Add Item'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Edit Modal */}
                {isEditModalOpen && editingMedicine && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
                            <h2 className="text-xl font-bold mb-4">Edit Item</h2>
                            <form onSubmit={handleUpdate} className="space-y-4">
                                {/* Show current registry link */}
                                <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-3 space-y-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                        <ClipboardCheck className="w-4 h-4" /> Product Registry Link
                                    </label>
                                    <select className="w-full p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600"
                                        value={editingMedicine.registeredProductId || ''}
                                        onChange={e => setEditingMedicine({ ...editingMedicine, registeredProductId: e.target.value || undefined })}>
                                        <option value="">— Not linked —</option>
                                        {registeredProducts.map(rp => (
                                            <option key={rp.id} value={rp.id}>
                                                {rp.tradeName} ({rp.itemCode}) — {rp.registrationBody}
                                            </option>
                                        ))}
                                    </select>
                                    {editingMedicine.registeredProductId && (() => {
                                        const rp = registeredProducts.find(p => p.id === editingMedicine.registeredProductId);
                                        if (!rp) return null;
                                        return (
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                {rp.genericName} · Reg: {rp.registrationNumber} · Supplier: {getProductSuppliersStr(rp)}
                                            </div>
                                        );
                                    })()}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">Name *</label>
                                    <input required type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={editingMedicine.name} onChange={e => setEditingMedicine({ ...editingMedicine, name: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Item Code</label>
                                        <input type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingMedicine.itemCode || ''} onChange={e => setEditingMedicine({ ...editingMedicine, itemCode: e.target.value || undefined })} placeholder="e.g. MED-001" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Price (AED) *</label>
                                        <input required type="number" min="0" step="0.01" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingMedicine.price} onChange={e => setEditingMedicine({ ...editingMedicine, price: Number(e.target.value) })} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Central Stock</label>
                                        <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingMedicine.centralStock} onChange={e => setEditingMedicine({ ...editingMedicine, centralStock: Number(e.target.value) })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Category</label>
                                        <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingMedicine.category || 'medicine'} onChange={e => setEditingMedicine({ ...editingMedicine, category: e.target.value as 'medicine' | 'consumable' | 'em_medicine' })}>
                                            <option value="medicine">Medicine</option>
                                            <option value="consumable">Consumable</option>
                                            <option value="em_medicine">EM Medicine</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Purchase Unit</label>
                                        <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingMedicine.purchaseUnit || ''} onChange={e => setEditingMedicine({ ...editingMedicine, purchaseUnit: e.target.value || undefined })}>
                                            <option value="">Select...</option>
                                            <option value="Box">Box</option>
                                            <option value="Vial">Vial</option>
                                            <option value="Bottle">Bottle</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Stored Type</label>
                                        <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingMedicine.storedType || ''} onChange={e => setEditingMedicine({ ...editingMedicine, storedType: e.target.value || undefined })}>
                                            <option value="">Select...</option>
                                            <option value="Packet">Packet</option>
                                            <option value="Bottle">Bottle</option>
                                            <option value="Vial">Vial</option>
                                            <option value="Prefilled Syringe">Prefilled Syringe</option>
                                            <option value="Strips">Strips</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">No. of Stored Type</label>
                                        <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingMedicine.numberOfStoredType ?? ''} onChange={e => setEditingMedicine({ ...editingMedicine, numberOfStoredType: e.target.value ? Number(e.target.value) : undefined })} placeholder="e.g. 10" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Consumable Items Inside</label>
                                        <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingMedicine.consumableItemsInside ?? ''} onChange={e => setEditingMedicine({ ...editingMedicine, consumableItemsInside: e.target.value ? Number(e.target.value) : undefined })} placeholder="e.g. 100" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Consumable Unit</label>
                                        <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingMedicine.consumableUnit || ''} onChange={e => setEditingMedicine({ ...editingMedicine, consumableUnit: e.target.value || undefined })}>
                                            <option value="">Select...</option>
                                            <option value="ml">ml</option>
                                            <option value="Vial">Vial</option>
                                            <option value="Prefilled Syringe">Prefilled Syringe</option>
                                            <option value="pcs">pcs</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Batch Number</label>
                                        <input type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingMedicine.batchNumber || ''} onChange={e => setEditingMedicine({ ...editingMedicine, batchNumber: e.target.value || undefined })} placeholder="e.g. BT-A001" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Expiry Date</label>
                                        <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={editingMedicine.expiryDate || ''} onChange={e => setEditingMedicine({ ...editingMedicine, expiryDate: e.target.value })} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Min Central Stock</label>
                                    <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={editingMedicine.minCentralStock ?? ''} onChange={e => setEditingMedicine({ ...editingMedicine, minCentralStock: e.target.value ? Number(e.target.value) : undefined })} placeholder="Alert threshold" />
                                </div>
                                {/* Branch Stock with per-branch min */}
                                {(editingMedicine.branchStock || []).length > 0 && (
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Branch Stock & Minimums</label>
                                        <div className="space-y-2">
                                            {editingMedicine.branchStock.map((bs, idx) => (
                                                <div key={bs.clinicId} className="flex items-center gap-2 text-sm">
                                                    <span className="flex-1 text-gray-700 dark:text-gray-300 truncate">{getClinicName(bs.clinicId)}</span>
                                                    <span className="text-gray-500 w-14 text-right">Qty: {bs.quantity}</span>
                                                    <input type="number" min="0" className="w-20 p-1.5 text-xs border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                                        value={bs.minQuantity ?? ''}
                                                        onChange={e => {
                                                            const updated = [...editingMedicine.branchStock];
                                                            updated[idx] = { ...updated[idx], minQuantity: e.target.value ? Number(e.target.value) : undefined };
                                                            setEditingMedicine({ ...editingMedicine, branchStock: updated });
                                                        }}
                                                        placeholder="Min" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="flex justify-end gap-3 mt-6">
                                    <button type="button" onClick={() => { setIsEditModalOpen(false); setEditingMedicine(null); }} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
                                    <button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                                        {submitting ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Transfer / Distribute Modal */}
                {isDistributeOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 shadow-xl">
                            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                <ArrowRightLeft className="w-5 h-5 text-emerald-600" />
                                {distributeForm.fromClinicId ? 'Transfer Between Branches' : 'Distribute to Branch'}
                            </h2>
                            <form onSubmit={handleDistribute} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Item *</label>
                                    <select required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={distributeForm.medicineId} onChange={e => setDistributeForm({ ...distributeForm, medicineId: e.target.value })}>
                                        <option value="">Select item...</option>
                                        {medicines.map(m => (
                                            <option key={m.id} value={m.id}>{m.name} (Central: {m.centralStock})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">From *</label>
                                        <select required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={distributeForm.fromClinicId} onChange={e => setDistributeForm({ ...distributeForm, fromClinicId: e.target.value })}>
                                            <option value="">Central Store</option>
                                            {clinics.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">To Branch *</label>
                                        <select required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={distributeForm.toClinicId} onChange={e => setDistributeForm({ ...distributeForm, toClinicId: e.target.value })}>
                                            <option value="">Select branch...</option>
                                            {clinics.filter(c => c.id !== distributeForm.fromClinicId).map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Quantity *</label>
                                        <input required type="number" min="1" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={distributeForm.quantity} onChange={e => setDistributeForm({ ...distributeForm, quantity: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Date *</label>
                                        <input required type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={distributeForm.distributedDate} onChange={e => setDistributeForm({ ...distributeForm, distributedDate: e.target.value })} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Notes</label>
                                    <input type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={distributeForm.notes} onChange={e => setDistributeForm({ ...distributeForm, notes: e.target.value })} placeholder="Optional notes" />
                                </div>
                                {distributeForm.medicineId && (() => {
                                    const med = medicines.find(m => m.id === distributeForm.medicineId);
                                    if (!med) return null;
                                    return (
                                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3 rounded-lg text-sm">
                                            <div className="font-medium text-emerald-800 dark:text-emerald-300 mb-1">Current Stock:</div>
                                            <div className="flex flex-wrap gap-2 text-xs text-emerald-700 dark:text-emerald-400">
                                                <span className={`px-2 py-1 rounded ${!distributeForm.fromClinicId ? 'bg-emerald-200 dark:bg-emerald-800 font-bold' : 'bg-white dark:bg-gray-800'}`}>🏢 Central: {med.centralStock}</span>
                                                {(med.branchStock || []).map(bs => (
                                                    <span key={bs.clinicId} className={`px-2 py-1 rounded ${distributeForm.fromClinicId === bs.clinicId ? 'bg-emerald-200 dark:bg-emerald-800 font-bold' : 'bg-white dark:bg-gray-800'}`}>📍 {getClinicName(bs.clinicId)}: {bs.quantity}</span>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}
                                <div className="flex justify-end gap-3 mt-6">
                                    <button type="button" onClick={() => setIsDistributeOpen(false)} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
                                    <button type="submit" disabled={submitting} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                                        {submitting ? 'Transferring...' : distributeForm.fromClinicId ? 'Transfer Stock' : 'Distribute Stock'}
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

'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, FileText, Package, CreditCard, Filter, ChevronDown, ChevronRight, Receipt, AlertTriangle, Upload, Download, Eye } from 'lucide-react';
import { Medicine, Supplier, PurchaseRecord, PurchaseLineItem, RegisteredProduct } from '@/lib/data';

interface LineItemForm {
    registeredProductId: string;
    medicineId: string;
    quantity: string;
    unitPrice: string;
    focQuantity: string;
    batchNumber: string;
    expiryDate: string;
}

const emptyLineItem: LineItemForm = {
    registeredProductId: '', medicineId: '', quantity: '', unitPrice: '', focQuantity: '', batchNumber: '', expiryDate: ''
};

const isExpired = (expiry: string) => new Date(expiry) < new Date();

export default function PurchasesPage() {
    const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [registeredProducts, setRegisteredProducts] = useState<RegisteredProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [expandedBill, setExpandedBill] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [invoiceFile, setInvoiceFile] = useState<{ base64: string; name: string } | null>(null);

    // Filters
    const [filterMedicine, setFilterMedicine] = useState('');
    const [filterSupplier, setFilterSupplier] = useState('');

    // Bill-level form
    const [billForm, setBillForm] = useState({
        supplierId: '', billNumber: '', purchaseDate: '',
        chequeNumber: '', chequeDate: '', taxAmount: '', notes: ''
    });
    // Line items
    const [lineItems, setLineItems] = useState<LineItemForm[]>([{ ...emptyLineItem }]);

    useEffect(() => {
        Promise.all([
            fetch('/api/admin/purchases').then(r => r.json()),
            fetch('/api/admin/medicines').then(r => r.json()),
            fetch('/api/admin/suppliers').then(r => r.json()),
            fetch('/api/admin/registered-products').then(r => r.json()),
        ]).then(([p, m, s, rp]) => {
            setPurchases(Array.isArray(p) ? p : []);
            setMedicines(Array.isArray(m) ? m : []);
            setSuppliers(Array.isArray(s) ? s : []);
            setRegisteredProducts(Array.isArray(rp) ? rp : []);
        }).catch(e => console.error(e)).finally(() => setLoading(false));
    }, []);

    const fetchPurchases = async () => {
        const params = new URLSearchParams();
        if (filterMedicine) params.set('medicineId', filterMedicine);
        if (filterSupplier) params.set('supplierId', filterSupplier);
        const res = await fetch(`/api/admin/purchases?${params}`);
        const data = await res.json();
        setPurchases(Array.isArray(data) ? data : []);
        const mRes = await fetch('/api/admin/medicines');
        const mData = await mRes.json();
        setMedicines(Array.isArray(mData) ? mData : []);
    };

    // Calculate subtotal from line items
    const calcSubtotal = () => lineItems.reduce((sum, li) => sum + (Number(li.quantity) || 0) * (Number(li.unitPrice) || 0), 0);
    const calcTotal = () => calcSubtotal() + (Number(billForm.taxAmount) || 0);

    // Validate purchase against registered product rules
    const validatePurchase = (): string[] => {
        const errors: string[] = [];
        const selectedSupplier = billForm.supplierId;

        lineItems.forEach((li, idx) => {
            if (!li.registeredProductId) return;
            const rp = registeredProducts.find(p => p.id === li.registeredProductId);
            if (!rp) return;

            // Check registration expiry
            if (isExpired(rp.registrationExpiry)) {
                errors.push(`Item ${idx + 1} (${rp.tradeName}): Registration expired on ${rp.registrationExpiry}. Cannot purchase.`);
            }

            // Check supplier matches
            if (selectedSupplier && rp.registeredSupplierId !== selectedSupplier) {
                const regSupplierName = suppliers.find(s => s.id === rp.registeredSupplierId)?.name || 'Unknown';
                errors.push(`Item ${idx + 1} (${rp.tradeName}): Registered supplier is "${regSupplierName}", but purchase supplier is different.`);
            }
        });

        return errors;
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        // Validate at least one item has product & qty
        const validItems = lineItems.filter(li => li.registeredProductId && Number(li.quantity) > 0);
        if (validItems.length === 0) { alert('Add at least one item with a product and quantity'); return; }

        // Run validation
        const errors = validatePurchase();
        if (errors.length > 0) {
            setValidationErrors(errors);
            return;
        }
        setValidationErrors([]);

        setSubmitting(true);
        try {
            const subtotal = calcSubtotal();
            const totalAmount = calcTotal();
            const res = await fetch('/api/admin/purchases', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...billForm,
                    items: validItems.map(li => ({
                        medicineId: li.medicineId || li.registeredProductId,
                        registeredProductId: li.registeredProductId || undefined,
                        quantity: Number(li.quantity),
                        unitPrice: Number(li.unitPrice) || 0,
                        focQuantity: Number(li.focQuantity) || 0,
                        batchNumber: li.batchNumber || undefined,
                        expiryDate: li.expiryDate || undefined
                    })),
                    subtotal,
                    taxAmount: Number(billForm.taxAmount) || 0,
                    totalAmount,
                    invoiceFileBase64: invoiceFile?.base64 || undefined,
                    invoiceFileName: invoiceFile?.name || undefined,
                })
            });
            if (res.ok) {
                await fetchPurchases();
                setIsAddOpen(false);
                setBillForm({ supplierId: '', billNumber: '', purchaseDate: '', chequeNumber: '', chequeDate: '', taxAmount: '', notes: '' });
                setLineItems([{ ...emptyLineItem }]);
                setInvoiceFile(null);
            } else alert('Failed to add purchase');
        } catch (e) { console.error(e); } finally { setSubmitting(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this purchase record?')) return;
        try {
            const res = await fetch(`/api/admin/purchases?id=${id}`, { method: 'DELETE' });
            if (res.ok) await fetchPurchases();
            else alert('Failed to delete');
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (!loading) fetchPurchases();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterMedicine, filterSupplier]);

    const getMedicineName = (id: string) => {
        const med = medicines.find(m => m.id === id);
        if (med) return med.name;
        const rp = registeredProducts.find(p => p.id === id);
        if (rp) return rp.tradeName;
        return id;
    };
    const getSupplierName = (id: string) => suppliers.find(s => s.id === id)?.name || id;

    const handleProductSelect = (idx: number, rpId: string) => {
        const rp = registeredProducts.find(p => p.id === rpId);
        setLineItems(prev => prev.map((li, i) => {
            if (i !== idx) return li;
            return {
                ...li,
                registeredProductId: rpId,
                medicineId: rp?.linkedMedicineId || '',
                unitPrice: rp ? String(rp.registeredPrice) : li.unitPrice,
            };
        }));
        // Clear validation errors when selection changes
        setValidationErrors([]);
    };

    const updateLineItem = (idx: number, field: keyof LineItemForm, value: string) => {
        setLineItems(prev => prev.map((li, i) => i === idx ? { ...li, [field]: value } : li));
    };
    const removeLineItem = (idx: number) => {
        setLineItems(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx));
    };
    const addLineItem = () => setLineItems(prev => [...prev, { ...emptyLineItem }]);

    const handleInvoiceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { alert('Invoice file must be under 5MB'); return; }
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            setInvoiceFile({ base64, name: file.name });
        };
        reader.readAsDataURL(file);
    };

    const downloadInvoice = (purchase: PurchaseRecord) => {
        if (!purchase.invoiceFileBase64 || !purchase.invoiceFileName) return;
        const ext = purchase.invoiceFileName.split('.').pop()?.toLowerCase();
        const mimeMap: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };
        const mime = mimeMap[ext || ''] || 'application/octet-stream';
        const byteChars = atob(purchase.invoiceFileBase64);
        const byteArr = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteArr], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = purchase.invoiceFileName;
        a.click();
        URL.revokeObjectURL(url);
    };

    const viewInvoice = (purchase: PurchaseRecord) => {
        if (!purchase.invoiceFileBase64 || !purchase.invoiceFileName) return;
        const ext = purchase.invoiceFileName.split('.').pop()?.toLowerCase();
        const mimeMap: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };
        const mime = mimeMap[ext || ''] || 'application/octet-stream';
        const byteChars = atob(purchase.invoiceFileBase64);
        const byteArr = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteArr], { type: mime });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    };

    // Filter registered products by selected supplier
    const getAvailableProducts = () => {
        if (!billForm.supplierId) return registeredProducts;
        return registeredProducts.filter(rp => rp.registeredSupplierId === billForm.supplierId);
    };

    if (loading) return <div className="p-8">Loading purchases...</div>;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-7xl mx-auto">
                <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Purchase Records</h1>
                        <p className="text-gray-600 dark:text-gray-400">Track purchases from suppliers. Only registered products can be purchased.</p>
                    </div>
                    <button onClick={() => setIsAddOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-700 transition-colors">
                        <Plus className="w-4 h-4" /> Record New Purchase
                    </button>
                </header>

                {/* Filters */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6 flex flex-wrap gap-4 items-end">
                    <div className="flex items-center gap-2 text-sm text-gray-500"><Filter className="w-4 h-4" /> Filters:</div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Medicine/Consumable</label>
                        <select className="p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600" value={filterMedicine} onChange={e => setFilterMedicine(e.target.value)}>
                            <option value="">All</option>
                            {medicines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Supplier</label>
                        <select className="p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600" value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}>
                            <option value="">All</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                </div>

                {/* Purchase Table — Bill Rows */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-700/50">
                                <tr>
                                    <th className="text-left p-4 font-medium text-gray-500 w-8"></th>
                                    <th className="text-left p-4 font-medium text-gray-500">Date</th>
                                    <th className="text-left p-4 font-medium text-gray-500">Bill #</th>
                                    <th className="text-left p-4 font-medium text-gray-500">Supplier</th>
                                    <th className="text-center p-4 font-medium text-gray-500">Items</th>
                                    <th className="text-right p-4 font-medium text-gray-500">Subtotal</th>
                                    <th className="text-right p-4 font-medium text-gray-500">Tax</th>
                                    <th className="text-right p-4 font-medium text-gray-500">Total (AED)</th>
                                    <th className="text-left p-4 font-medium text-gray-500">Cheque</th>
                                    <th className="text-center p-4 font-medium text-gray-500">Invoice</th>
                                    <th className="text-center p-4 font-medium text-gray-500"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {purchases.length === 0 ? (
                                    <tr><td colSpan={11} className="text-center py-12 text-gray-500">No purchase records found.</td></tr>
                                ) : purchases.map(p => (
                                    <React.Fragment key={p.id}>
                                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer" onClick={() => setExpandedBill(expandedBill === p.id ? null : p.id)}>
                                            <td className="p-4 text-gray-500">
                                                {expandedBill === p.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                            </td>
                                            <td className="p-4 text-gray-700 dark:text-gray-300">{p.purchaseDate}</td>
                                            <td className="p-4">
                                                <span className="inline-flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md font-medium">
                                                    <FileText className="w-3 h-3" /> {p.billNumber}
                                                </span>
                                            </td>
                                            <td className="p-4 text-gray-700 dark:text-gray-300">{getSupplierName(p.supplierId)}</td>
                                            <td className="p-4 text-center">
                                                <span className="inline-flex items-center gap-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">
                                                    <Package className="w-3 h-3" /> {p.items.length} item{p.items.length !== 1 ? 's' : ''}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right text-gray-600 dark:text-gray-400">{p.subtotal.toLocaleString()}</td>
                                            <td className="p-4 text-right text-gray-600 dark:text-gray-400">
                                                {(p.taxAmount || 0) > 0 ? p.taxAmount?.toLocaleString() : '—'}
                                            </td>
                                            <td className="p-4 text-right font-bold text-indigo-600 dark:text-indigo-400">
                                                <span className="inline-flex items-center gap-1"><span className="text-xs font-semibold">د.إ</span> {p.totalAmount.toLocaleString()} AED</span>
                                            </td>
                                            <td className="p-4 text-gray-600 dark:text-gray-400 text-xs">
                                                {p.chequeNumber ? (
                                                    <span className="inline-flex items-center gap-1"><CreditCard className="w-3 h-3" /> {p.chequeNumber}{p.chequeDate ? ` (${p.chequeDate})` : ''}</span>
                                                ) : <span className="text-gray-400">—</span>}
                                            </td>
                                            <td className="p-4 text-center" onClick={e => e.stopPropagation()}>
                                                {p.invoiceFileBase64 ? (
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button onClick={() => viewInvoice(p)} className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20" title="View Invoice">
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => downloadInvoice(p)} className="text-green-500 hover:text-green-700 p-1 rounded hover:bg-green-50 dark:hover:bg-green-900/20" title="Download Invoice">
                                                            <Download className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : <span className="text-gray-400 text-xs">—</span>}
                                            </td>
                                            <td className="p-4 text-center" onClick={e => e.stopPropagation()}>
                                                <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:text-red-700 p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                        {/* Expanded line items */}
                                        {expandedBill === p.id && (
                                            <tr>
                                                <td colSpan={11} className="bg-gray-50/80 dark:bg-gray-700/30 p-0">
                                                    <div className="px-12 py-3">
                                                        <table className="w-full text-xs">
                                                            <thead>
                                                                <tr className="text-gray-500">
                                                                    <th className="text-left pb-2 font-medium">Item</th>
                                                                    <th className="text-right pb-2 font-medium">Qty</th>
                                                                    <th className="text-right pb-2 font-medium">Unit Price</th>
                                                                    <th className="text-right pb-2 font-medium">FOC</th>
                                                                    <th className="text-left pb-2 font-medium">Batch #</th>
                                                                    <th className="text-left pb-2 font-medium">Expiry</th>
                                                                    <th className="text-right pb-2 font-medium">Line Total</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                                                                {p.items.map((item, idx) => (
                                                                    <tr key={idx}>
                                                                        <td className="py-2 font-medium text-gray-900 dark:text-white">{getMedicineName(item.medicineId)}</td>
                                                                        <td className="py-2 text-right">{item.quantity}</td>
                                                                        <td className="py-2 text-right">{item.unitPrice.toFixed(2)}</td>
                                                                        <td className="py-2 text-right">{(item.focQuantity || 0) > 0 ? <span className="text-green-600">{item.focQuantity}</span> : '—'}</td>
                                                                        <td className="py-2">{item.batchNumber || '—'}</td>
                                                                        <td className="py-2">{item.expiryDate || '—'}</td>
                                                                        <td className="py-2 text-right font-medium">{(item.quantity * item.unitPrice).toLocaleString()} AED</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                        {p.notes && <p className="mt-2 text-xs text-gray-500 italic">Notes: {p.notes}</p>}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Add Purchase Modal */}
                {isAddOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-lg">
                                    <Receipt className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Record New Purchase</h2>
                            </div>
                            <form onSubmit={handleAdd} className="space-y-5">
                                {/* Bill-level fields */}
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Supplier *</label>
                                        <select required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={billForm.supplierId} onChange={e => {
                                                setBillForm({ ...billForm, supplierId: e.target.value });
                                                // Reset line items when supplier changes
                                                setLineItems([{ ...emptyLineItem }]);
                                                setValidationErrors([]);
                                            }}>
                                            <option value="">Select supplier...</option>
                                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Bill Number *</label>
                                        <input required type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={billForm.billNumber} onChange={e => setBillForm({ ...billForm, billNumber: e.target.value })} placeholder="e.g. INV-2026-025" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Purchase Date *</label>
                                        <input required type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={billForm.purchaseDate} onChange={e => setBillForm({ ...billForm, purchaseDate: e.target.value })} />
                                    </div>
                                </div>

                                {/* Line Items */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="text-sm font-medium text-gray-900 dark:text-white">Bill Items (from Product Registry)</label>
                                        <button type="button" onClick={addLineItem} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                                            <Plus className="w-3.5 h-3.5" /> Add Item
                                        </button>
                                    </div>

                                    {!billForm.supplierId && (
                                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-lg text-sm text-amber-700 dark:text-amber-300 mb-3">
                                            ⚠️ Select a supplier first to see available registered products.
                                        </div>
                                    )}

                                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                        {/* Header */}
                                        <div className="grid grid-cols-12 gap-2 bg-gray-50 dark:bg-gray-700/50 px-3 py-2 text-xs font-medium text-gray-500">
                                            <div className="col-span-3">Registered Product *</div>
                                            <div className="col-span-1">Qty *</div>
                                            <div className="col-span-2">Unit Price</div>
                                            <div className="col-span-1">FOC</div>
                                            <div className="col-span-2">Batch #</div>
                                            <div className="col-span-2">Expiry</div>
                                            <div className="col-span-1"></div>
                                        </div>
                                        {/* Rows */}
                                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                            {lineItems.map((li, idx) => {
                                                const selectedProduct = registeredProducts.find(p => p.id === li.registeredProductId);
                                                const productExpired = selectedProduct && isExpired(selectedProduct.registrationExpiry);
                                                const supplierMismatch = selectedProduct && billForm.supplierId && selectedProduct.registeredSupplierId !== billForm.supplierId;

                                                return (
                                                    <div key={idx} className={`grid grid-cols-12 gap-2 px-3 py-2 items-center ${productExpired || supplierMismatch ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                                                        <div className="col-span-3">
                                                            <select required className={`w-full p-1.5 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 ${productExpired ? 'border-red-400' : ''}`}
                                                                value={li.registeredProductId} onChange={e => handleProductSelect(idx, e.target.value)}>
                                                                <option value="">Select product...</option>
                                                                {getAvailableProducts().map(rp => (
                                                                    <option key={rp.id} value={rp.id} disabled={isExpired(rp.registrationExpiry)}>
                                                                        {rp.tradeName} ({rp.itemCode}){isExpired(rp.registrationExpiry) ? ' ⛔ EXPIRED' : ''}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            {productExpired && (
                                                                <div className="flex items-center gap-1 text-xs text-red-600 mt-0.5">
                                                                    <AlertTriangle className="w-3 h-3" /> Registration expired
                                                                </div>
                                                            )}
                                                            {supplierMismatch && (
                                                                <div className="flex items-center gap-1 text-xs text-red-600 mt-0.5">
                                                                    <AlertTriangle className="w-3 h-3" /> Supplier mismatch
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="col-span-1">
                                                            <input required type="number" min="1" className="w-full p-1.5 border rounded text-sm dark:bg-gray-700 dark:border-gray-600"
                                                                value={li.quantity} onChange={e => updateLineItem(idx, 'quantity', e.target.value)} />
                                                        </div>
                                                        <div className="col-span-2">
                                                            <input type="number" min="0" step="0.01" className="w-full p-1.5 border rounded text-sm dark:bg-gray-700 dark:border-gray-600"
                                                                value={li.unitPrice} onChange={e => updateLineItem(idx, 'unitPrice', e.target.value)} placeholder="0.00" />
                                                        </div>
                                                        <div className="col-span-1">
                                                            <input type="number" min="0" className="w-full p-1.5 border rounded text-sm dark:bg-gray-700 dark:border-gray-600"
                                                                value={li.focQuantity} onChange={e => updateLineItem(idx, 'focQuantity', e.target.value)} placeholder="0" />
                                                        </div>
                                                        <div className="col-span-2">
                                                            <input type="text" className="w-full p-1.5 border rounded text-sm dark:bg-gray-700 dark:border-gray-600"
                                                                value={li.batchNumber} onChange={e => updateLineItem(idx, 'batchNumber', e.target.value)} placeholder="BT-XXX" />
                                                        </div>
                                                        <div className="col-span-2">
                                                            <input type="date" className="w-full p-1.5 border rounded text-sm dark:bg-gray-700 dark:border-gray-600"
                                                                value={li.expiryDate} onChange={e => updateLineItem(idx, 'expiryDate', e.target.value)} />
                                                        </div>
                                                        <div className="col-span-1 text-center">
                                                            <button type="button" onClick={() => removeLineItem(idx)} disabled={lineItems.length <= 1}
                                                                className="text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed p-1">
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* Validation Errors */}
                                {validationErrors.length > 0 && (
                                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
                                        <div className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300 mb-2">
                                            <AlertTriangle className="w-4 h-4" /> Cannot record this purchase:
                                        </div>
                                        <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-400 space-y-1">
                                            {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
                                        </ul>
                                    </div>
                                )}

                                {/* Payment details row */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Tax Paid (AED)</label>
                                        <input type="number" min="0" step="0.01" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={billForm.taxAmount} onChange={e => setBillForm({ ...billForm, taxAmount: e.target.value })} placeholder="0.00" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Cheque Number</label>
                                        <input type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={billForm.chequeNumber} onChange={e => setBillForm({ ...billForm, chequeNumber: e.target.value })} placeholder="CHQ-XXXX" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Cheque Date</label>
                                        <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={billForm.chequeDate} onChange={e => setBillForm({ ...billForm, chequeDate: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Notes</label>
                                        <input type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={billForm.notes} onChange={e => setBillForm({ ...billForm, notes: e.target.value })} placeholder="Optional..." />
                                    </div>
                                </div>

                                {/* Invoice Upload */}
                                <div>
                                    <label className="block text-sm font-medium mb-1">Invoice File (PDF/JPG/PNG)</label>
                                    <div className="flex items-center gap-3">
                                        <label className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors">
                                            <Upload className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm text-gray-600 dark:text-gray-300">
                                                {invoiceFile ? invoiceFile.name : 'Choose file...'}
                                            </span>
                                            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleInvoiceUpload} />
                                        </label>
                                        {invoiceFile && (
                                            <button type="button" onClick={() => setInvoiceFile(null)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                                        )}
                                    </div>
                                </div>

                                {/* Totals Summary */}
                                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2">
                                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                                        <span>Subtotal ({lineItems.filter(li => li.registeredProductId).length} item{lineItems.filter(li => li.registeredProductId).length !== 1 ? 's' : ''})</span>
                                        <span className="font-medium">{calcSubtotal().toLocaleString(undefined, { minimumFractionDigits: 2 })} AED</span>
                                    </div>
                                    {(Number(billForm.taxAmount) || 0) > 0 && (
                                        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                                            <span>Tax</span>
                                            <span className="font-medium">{Number(billForm.taxAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} AED</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-base font-bold text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-600 pt-2">
                                        <span>Total</span>
                                        <span className="text-indigo-600 dark:text-indigo-400">{calcTotal().toLocaleString(undefined, { minimumFractionDigits: 2 })} AED</span>
                                    </div>
                                </div>

                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                                    ℹ️ Stock will automatically increase by <strong>Quantity + FOC</strong> for each item when this purchase is recorded.
                                </div>

                                <div className="flex justify-end gap-3">
                                    <button type="button" onClick={() => { setIsAddOpen(false); setValidationErrors([]); }} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
                                    <button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                                        {submitting ? 'Recording...' : 'Record Purchase'}
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

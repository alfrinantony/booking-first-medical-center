'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Edit2, Package, Search, AlertTriangle, CheckCircle, FileText, Upload, X, Truck, ClipboardList, Hash } from 'lucide-react';
import { RegisteredProduct, Supplier, ProductCategory, StoredType } from '@/lib/data';

const CATEGORIES: { value: ProductCategory; label: string }[] = [
    { value: 'medicine', label: 'Medicine' },
    { value: 'consumable', label: 'Consumable' },
    { value: 'em_medicine', label: 'EM Medicine' },
];

const STORED_TYPES: StoredType[] = ['Packet', 'Bottle', 'Vial', 'Prefilled Syringe', 'Strips'];

const categoryBadge = (cat: ProductCategory) => {
    const map: Record<ProductCategory, string> = {
        medicine: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
        consumable: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
        em_medicine: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    };
    const labelMap: Record<ProductCategory, string> = { medicine: 'Medicine', consumable: 'Consumable', em_medicine: 'EM Medicine' };
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[cat]}`}>{labelMap[cat]}</span>;
};

const isExpired = (expiry: string) => new Date(expiry) < new Date();

interface ProductForm {
    tradeName: string;
    genericName: string;
    itemCode: string;
    registeredPrice: string;
    category: ProductCategory;
    purchaseUnit: string;
    storedType: StoredType;
    numberOfStoredType: string;
    consumableItemsInside: string;
    consumableUnit: string;
    registrationBody: string;
    registrationNumber: string;
    registrationExpiry: string;
    registeredSupplierId: string;
    registeredSubAgent: string;
    pdfFileName: string;
    minCentralStock: string;
    minAlMuraqabatStock: string;
    minAlQiyadahStock: string;
    minSiliconOasisStock: string;
}

const emptyForm: ProductForm = {
    tradeName: '', genericName: '', itemCode: '', registeredPrice: '',
    category: 'medicine', purchaseUnit: '', storedType: 'Packet',
    numberOfStoredType: '', consumableItemsInside: '', consumableUnit: '',
    registrationBody: '', registrationNumber: '', registrationExpiry: '',
    registeredSupplierId: '', registeredSubAgent: '', pdfFileName: '',
    minCentralStock: '', minAlMuraqabatStock: '', minAlQiyadahStock: '', minSiliconOasisStock: ''
};

export default function ProductRegistryPage() {
    const [products, setProducts] = useState<RegisteredProduct[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [form, setForm] = useState<ProductForm>({ ...emptyForm });
    const [editing, setEditing] = useState<RegisteredProduct | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const editFileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        Promise.all([
            fetch('/api/admin/registered-products').then(r => r.json()),
            fetch('/api/admin/suppliers').then(r => r.json()),
        ]).then(([p, s]) => {
            setProducts(Array.isArray(p) ? p : []);
            setSuppliers(Array.isArray(s) ? s : []);
        }).catch(e => console.error(e)).finally(() => setLoading(false));
    }, []);

    const fetchProducts = async () => {
        const res = await fetch('/api/admin/registered-products');
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : []);
    };

    const getSupplierName = (id: string) => suppliers.find(s => s.id === id)?.name || id;

    const handleUpload = async (file: File, isEdit: boolean) => {
        if (file.size > 1 * 1024 * 1024) {
            setUploadError('File must be less than 1MB');
            return;
        }
        if (file.type !== 'application/pdf') {
            setUploadError('Only PDF files are allowed');
            return;
        }
        setUploading(true);
        setUploadError('');
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/admin/registered-products/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (res.ok) {
                if (isEdit && editing) {
                    setEditing({ ...editing, pdfFileName: data.fileName });
                } else {
                    setForm(prev => ({ ...prev, pdfFileName: data.fileName }));
                }
            } else {
                setUploadError(data.error || 'Upload failed');
            }
        } catch { setUploadError('Upload failed'); }
        finally { setUploading(false); }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await fetch('/api/admin/registered-products', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    registeredPrice: Number(form.registeredPrice) || 0,
                    numberOfStoredType: Number(form.numberOfStoredType) || 0,
                    consumableItemsInside: Number(form.consumableItemsInside) || 0,
                    minCentralStock: form.minCentralStock ? Number(form.minCentralStock) : undefined,
                    minAlMuraqabatStock: form.minAlMuraqabatStock ? Number(form.minAlMuraqabatStock) : undefined,
                    minAlQiyadahStock: form.minAlQiyadahStock ? Number(form.minAlQiyadahStock) : undefined,
                    minSiliconOasisStock: form.minSiliconOasisStock ? Number(form.minSiliconOasisStock) : undefined,
                })
            });
            if (res.ok) { await fetchProducts(); setIsAddOpen(false); setForm({ ...emptyForm }); }
            else alert('Failed to add product');
        } catch (e) { console.error(e); } finally { setSubmitting(false); }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;
        setSubmitting(true);
        try {
            const res = await fetch('/api/admin/registered-products', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editing)
            });
            if (res.ok) { await fetchProducts(); setIsEditOpen(false); setEditing(null); }
            else alert('Failed to update product');
        } catch (e) { console.error(e); } finally { setSubmitting(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this registered product?')) return;
        try {
            const res = await fetch(`/api/admin/registered-products?id=${id}`, { method: 'DELETE' });
            if (res.ok) await fetchProducts();
            else alert('Failed to delete');
        } catch (e) { console.error(e); }
    };

    const filtered = products.filter(p => {
        if (filterCategory && p.category !== filterCategory) return false;
        if (search) {
            const q = search.toLowerCase();
            return p.tradeName.toLowerCase().includes(q) || p.genericName.toLowerCase().includes(q) || p.itemCode.toLowerCase().includes(q);
        }
        return true;
    }).sort((a, b) => a.tradeName.localeCompare(b.tradeName));

    if (loading) return <div className="p-8">Loading product registry...</div>;

    const renderFormFields = (
        values: ProductForm | RegisteredProduct,
        onChange: (field: string, value: string | number) => void,
        isEditMode: boolean
    ) => (
        <div className="space-y-4">
            {/* Names Row */}
            <div className="grid grid-cols-3 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Trade Name *</label>
                    <input required type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                        value={values.tradeName} onChange={e => onChange('tradeName', e.target.value)} placeholder="e.g. Botulinum Toxin Type A" />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Generic Name *</label>
                    <input required type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                        value={values.genericName} onChange={e => onChange('genericName', e.target.value)} placeholder="e.g. Botulinum Toxin" />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Item Code *</label>
                    <input required type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 font-mono"
                        value={values.itemCode} onChange={e => onChange('itemCode', e.target.value.toUpperCase())} placeholder="e.g. BTX-001" />
                </div>
            </div>

            {/* Category, Price, Purchase Unit */}
            <div className="grid grid-cols-4 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Category *</label>
                    <select required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                        value={values.category} onChange={e => onChange('category', e.target.value)}>
                        {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Registered Price (AED) *</label>
                    <input required type="number" min="0" step="0.01" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                        value={values.registeredPrice} onChange={e => onChange('registeredPrice', e.target.value)} placeholder="0.00" />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Purchase Unit</label>
                    <input type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                        value={values.purchaseUnit} onChange={e => onChange('purchaseUnit', e.target.value)} placeholder="e.g. Box, Pack" />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Stored Type *</label>
                    <select required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                        value={values.storedType} onChange={e => onChange('storedType', e.target.value)}>
                        {STORED_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
            </div>

            {/* Quantities */}
            <div className="grid grid-cols-3 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">No. of Stored Type</label>
                    <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                        value={values.numberOfStoredType} onChange={e => onChange('numberOfStoredType', e.target.value)} placeholder="e.g. 10" />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Consumable Items Inside</label>
                    <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                        value={values.consumableItemsInside} onChange={e => onChange('consumableItemsInside', e.target.value)} placeholder="e.g. 100" />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Consumable Unit</label>
                    <input type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                        value={values.consumableUnit} onChange={e => onChange('consumableUnit', e.target.value)} placeholder="e.g. ml, units, tablets" />
                </div>
            </div>

            {/* Min Stock per Location */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Minimum Stock Levels</h3>
                <div className="grid grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Central</label>
                        <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                            value={values.minCentralStock} onChange={e => onChange('minCentralStock', e.target.value)} placeholder="0" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Al Muraqabat</label>
                        <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                            value={(values as any).minAlMuraqabatStock ?? ''} onChange={e => onChange('minAlMuraqabatStock', e.target.value)} placeholder="0" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Al Qiyadah</label>
                        <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                            value={(values as any).minAlQiyadahStock ?? ''} onChange={e => onChange('minAlQiyadahStock', e.target.value)} placeholder="0" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Silicon Oasis</label>
                        <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                            value={(values as any).minSiliconOasisStock ?? ''} onChange={e => onChange('minSiliconOasisStock', e.target.value)} placeholder="0" />
                    </div>
                </div>
            </div>

            {/* Registration Details */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Registration Details</h3>
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Registration Body *</label>
                        <input required type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                            value={values.registrationBody} onChange={e => onChange('registrationBody', e.target.value)} placeholder="e.g. MOH, DHA, HAAD" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Registration Number *</label>
                        <input required type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 font-mono"
                            value={values.registrationNumber} onChange={e => onChange('registrationNumber', e.target.value)} placeholder="e.g. MOH-DRG-2024-0451" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Registration Expiry *</label>
                        <input required type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                            value={values.registrationExpiry} onChange={e => onChange('registrationExpiry', e.target.value)} />
                    </div>
                </div>
            </div>

            {/* Supplier & Sub-Agent */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Registered Supplier *</label>
                    <select required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                        value={values.registeredSupplierId} onChange={e => onChange('registeredSupplierId', e.target.value)}>
                        <option value="">Select supplier...</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Sub-Agent / Distributor</label>
                    <input type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                        value={values.registeredSubAgent || ''} onChange={e => onChange('registeredSubAgent', e.target.value)} placeholder="e.g. Allergan ME" />
                </div>
            </div>

            {/* PDF Upload */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Registration Document (PDF, max 1MB)</h3>
                {(isEditMode ? editing?.pdfFileName : form.pdfFileName) ? (
                    <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 rounded-lg">
                        <FileText className="w-5 h-5 text-green-600" />
                        <span className="text-sm text-green-700 dark:text-green-300 flex-1 font-mono truncate">
                            {isEditMode ? editing?.pdfFileName : form.pdfFileName}
                        </span>
                        <button type="button" onClick={() => {
                            if (isEditMode && editing) setEditing({ ...editing, pdfFileName: undefined });
                            else setForm(prev => ({ ...prev, pdfFileName: '' }));
                        }} className="text-red-500 hover:text-red-700 p-1"><X className="w-4 h-4" /></button>
                    </div>
                ) : (
                    <div>
                        <input
                            ref={isEditMode ? editFileInputRef : fileInputRef}
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) handleUpload(f, isEditMode);
                            }}
                        />
                        <button type="button" disabled={uploading}
                            onClick={() => (isEditMode ? editFileInputRef : fileInputRef).current?.click()}
                            className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 transition-colors disabled:opacity-50">
                            <Upload className="w-4 h-4" />
                            {uploading ? 'Uploading...' : 'Upload PDF'}
                        </button>
                        {uploadError && <p className="text-sm text-red-500 mt-1">{uploadError}</p>}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-7xl mx-auto">
                <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Product Registry</h1>
                        <p className="text-gray-600 dark:text-gray-400">Registered medicines & consumables. Only registered products can be purchased.</p>
                    </div>
                    <button onClick={() => { setForm({ ...emptyForm }); setIsAddOpen(true); }}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-700 transition-colors">
                        <Plus className="w-4 h-4" /> Register Product
                    </button>
                </header>

                {/* Search & Filters */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6 flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input type="text" className="w-full pl-9 p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600"
                                placeholder="Trade name, generic name, or item code..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                        <select className="p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600"
                            value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                            <option value="">All</option>
                            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                    </div>
                </div>

                {/* Product Table */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-700/50">
                                <tr>
                                    <th className="text-left p-4 font-medium text-gray-500">Trade Name / Generic</th>
                                    <th className="text-left p-4 font-medium text-gray-500">Item Code</th>
                                    <th className="text-left p-4 font-medium text-gray-500">Category</th>
                                    <th className="text-right p-4 font-medium text-gray-500">Price (AED)</th>
                                    <th className="text-left p-4 font-medium text-gray-500">Stored Type</th>
                                    <th className="text-right p-4 font-medium text-gray-500">Min Stock</th>
                                    <th className="text-left p-4 font-medium text-gray-500">Supplier</th>
                                    <th className="text-left p-4 font-medium text-gray-500">Registration</th>
                                    <th className="text-center p-4 font-medium text-gray-500">Status</th>
                                    <th className="text-center p-4 font-medium text-gray-500">Doc</th>
                                    <th className="text-center p-4 font-medium text-gray-500"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={10} className="text-center py-12 text-gray-500">No registered products found.</td></tr>
                                ) : filtered.map(p => (
                                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                                        <td className="p-4">
                                            <div className="font-medium text-gray-900 dark:text-white">{p.tradeName}</div>
                                            <div className="text-xs text-gray-500">{p.genericName}</div>
                                        </td>
                                        <td className="p-4 font-mono text-xs">{p.itemCode}</td>
                                        <td className="p-4">{categoryBadge(p.category)}</td>
                                        <td className="p-4 text-right font-medium">{p.registeredPrice.toLocaleString()} AED</td>
                                        <td className="p-4">
                                            <div className="text-xs">{p.numberOfStoredType}x {p.storedType}</div>
                                            <div className="text-xs text-gray-500">{p.consumableItemsInside} {p.consumableUnit} each</div>
                                        </td>
                                        <td className="p-4 text-right font-mono text-sm">{p.minCentralStock ?? '—'}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-1.5 text-xs">
                                                <Truck className="w-3.5 h-3.5 text-gray-400" />
                                                <span>{getSupplierName(p.registeredSupplierId)}</span>
                                            </div>
                                            {p.registeredSubAgent && <div className="text-xs text-gray-500 ml-5">via {p.registeredSubAgent}</div>}
                                        </td>
                                        <td className="p-4">
                                            <div className="text-xs font-mono">{p.registrationNumber}</div>
                                            <div className="text-xs text-gray-500">{p.registrationBody} · Exp: {p.registrationExpiry}</div>
                                        </td>
                                        <td className="p-4 text-center">
                                            {isExpired(p.registrationExpiry) ? (
                                                <span className="inline-flex items-center gap-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-1 rounded-full font-medium">
                                                    <AlertTriangle className="w-3 h-3" /> Expired
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded-full font-medium">
                                                    <CheckCircle className="w-3 h-3" /> Active
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            {p.pdfFileName ? (
                                                <a href={`/uploads/registrations/${p.pdfFileName}`} target="_blank" rel="noopener noreferrer"
                                                    className="text-indigo-500 hover:text-indigo-700" title="View PDF">
                                                    <FileText className="w-4 h-4" />
                                                </a>
                                            ) : <span className="text-gray-300">—</span>}
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex gap-1 justify-center">
                                                <button onClick={() => { setEditing({ ...p }); setIsEditOpen(true); }}
                                                    className="text-indigo-500 hover:text-indigo-700 p-1.5 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/20" title="Edit">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(p.id)}
                                                    className="text-red-500 hover:text-red-700 p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Add Modal */}
                {isAddOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-3xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-lg">
                                    <Package className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Register New Product</h2>
                            </div>
                            <form onSubmit={handleAdd}>
                                {renderFormFields(form, (field, value) => setForm(prev => ({ ...prev, [field]: value })), false)}
                                <div className="flex justify-end gap-3 mt-6">
                                    <button type="button" onClick={() => setIsAddOpen(false)}
                                        className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
                                    <button type="submit" disabled={submitting}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                                        {submitting ? 'Registering...' : 'Register Product'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Edit Modal */}
                {isEditOpen && editing && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-3xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-lg">
                                    <Edit2 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                </div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Registered Product</h2>
                            </div>
                            <form onSubmit={handleUpdate}>
                                {renderFormFields(editing, (field, value) => setEditing(prev => prev ? { ...prev, [field]: value } : prev), true)}
                                <div className="flex justify-end gap-3 mt-6">
                                    <button type="button" onClick={() => { setIsEditOpen(false); setEditing(null); }}
                                        className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
                                    <button type="submit" disabled={submitting}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
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

'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, FileText, Search, Filter, Calendar, DollarSign, User, Phone, Mail, Building2, X, ChevronDown, CreditCard, Banknote, Upload, Download } from 'lucide-react';
import { BranchContract, ContractType, Clinic, ChequeEntry, CashInstallmentEntry } from '@/lib/data';

const CONTRACT_TYPES: ContractType[] = [
    'Rental Contract',
    'Pest Control Contract',
    'Cleaning Contract',
    'Medical Waste Contract',
    'Bio Medical Equipment Contract',
    'Parking Contract',
    'Advertisement Contract',
    'Warranty Contract of Medical Equipments',
    'Software',
    'Other',
];

interface ContractForm {
    clinicId: string;
    contractType: ContractType;
    contractTitle: string;
    companyName: string;
    contractAmount: string;
    taxAmount: string;
    startDate: string;
    endDate: string;
    paymentMethod: 'cheque' | 'cash';
    accountNumber: string;
    bankName: string;
    trnNumber: string;
    emailId: string;
    contactPerson1: string;
    contactPerson1Phone: string;
    contactPerson1Whatsapp: string;
    contactPerson2: string;
    contactPerson2Phone: string;
    contactPerson2Whatsapp: string;
    notes: string;
}

const emptyForm: ContractForm = {
    clinicId: '', contractType: 'Rental Contract', contractTitle: '', companyName: '',
    contractAmount: '', taxAmount: '', startDate: '', endDate: '',
    paymentMethod: 'cheque',
    accountNumber: '', bankName: '', trnNumber: '',
    emailId: '',
    contactPerson1: '', contactPerson1Phone: '', contactPerson1Whatsapp: '',
    contactPerson2: '', contactPerson2Phone: '', contactPerson2Whatsapp: '',
    notes: '',
};

const contractTypeColors: Record<ContractType, string> = {
    'Rental Contract': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    'Pest Control Contract': 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    'Cleaning Contract': 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
    'Medical Waste Contract': 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    'Bio Medical Equipment Contract': 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    'Parking Contract': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    'Advertisement Contract': 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
    'Warranty Contract of Medical Equipments': 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
    'Software': 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300',
    'Other': 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
};

export default function BranchContractsPage() {
    const [contracts, setContracts] = useState<BranchContract[]>([]);
    const [clinics, setClinics] = useState<Clinic[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [form, setForm] = useState<ContractForm>({ ...emptyForm });
    const [formCheques, setFormCheques] = useState<ChequeEntry[]>([{ chequeNumber: '', date: '', amount: 0 }]);
    const [editCheques, setEditCheques] = useState<ChequeEntry[]>([]);
    const [formCashInstallments, setFormCashInstallments] = useState<CashInstallmentEntry[]>([{ date: '', amount: 0 }]);
    const [editCashInstallments, setEditCashInstallments] = useState<CashInstallmentEntry[]>([]);
    const [editing, setEditing] = useState<BranchContract | null>(null);
    const [viewing, setViewing] = useState<BranchContract | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [search, setSearch] = useState('');
    const [filterBranch, setFilterBranch] = useState('');
    const [filterType, setFilterType] = useState('');

    useEffect(() => {
        Promise.all([
            fetch('/api/admin/contracts').then(r => r.json()),
            fetch('/api/admin/clinics').then(r => r.json()),
        ]).then(([c, cl]) => {
            setContracts(c);
            setClinics(cl);
        }).finally(() => setLoading(false));
    }, []);

    const fetchContracts = async () => {
        const res = await fetch('/api/admin/contracts');
        if (res.ok) setContracts(await res.json());
    };

    const getClinicName = (id: string) => clinics.find(c => c.id === id)?.name || 'Unknown Branch';

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload: Record<string, unknown> = {
                ...form,
                contractAmount: Number(form.contractAmount) || 0,
                taxAmount: form.taxAmount ? Number(form.taxAmount) : undefined,
            };
            if (form.paymentMethod === 'cheque') {
                payload.cheques = formCheques.filter(c => c.date || c.amount).map(c => ({
                    chequeNumber: c.chequeNumber || undefined,
                    date: c.date,
                    amount: Number(c.amount) || 0,
                }));
                delete payload.cashInstallments;
            } else {
                payload.cashInstallments = formCashInstallments.filter(c => c.date || c.amount).map(c => ({
                    date: c.date,
                    amount: Number(c.amount) || 0,
                }));
                delete payload.cheques;
            }
            const res = await fetch('/api/admin/contracts', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                await fetchContracts();
                setIsAddOpen(false);
                setForm({ ...emptyForm });
                setFormCheques([{ chequeNumber: '', date: '', amount: 0 }]);
                setFormCashInstallments([{ date: '', amount: 0 }]);
            } else alert('Failed to add contract');
        } catch (e) { console.error(e); } finally { setSubmitting(false); }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;
        setSubmitting(true);
        try {
            const payload = {
                ...editing,
                cheques: editing.paymentMethod === 'cheque'
                    ? editCheques.filter(c => c.date || c.amount).map(c => ({
                        chequeNumber: c.chequeNumber || undefined,
                        date: c.date,
                        amount: Number(c.amount) || 0,
                    }))
                    : undefined,
                cashInstallments: editing.paymentMethod === 'cash'
                    ? editCashInstallments.filter(c => c.date || c.amount).map(c => ({
                        date: c.date,
                        amount: Number(c.amount) || 0,
                    }))
                    : undefined,
            };
            const res = await fetch('/api/admin/contracts', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (res.ok) { await fetchContracts(); setIsEditOpen(false); setEditing(null); }
            else alert('Failed to update contract');
        } catch (e) { console.error(e); } finally { setSubmitting(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this contract?')) return;
        try {
            const res = await fetch(`/api/admin/contracts?id=${id}`, { method: 'DELETE' });
            if (res.ok) await fetchContracts();
        } catch (e) { console.error(e); }
    };

    const openEdit = (c: BranchContract) => {
        setEditing({ ...c });
        setEditCheques(c.cheques && c.cheques.length > 0 ? [...c.cheques] : [{ chequeNumber: '', date: '', amount: 0 }]);
        setEditCashInstallments(c.cashInstallments && c.cashInstallments.length > 0 ? [...c.cashInstallments] : [{ date: '', amount: 0 }]);
        setIsEditOpen(true);
    };

    const openView = (c: BranchContract) => {
        setViewing(c);
        setIsViewOpen(true);
    };

    const isExpired = (endDate: string) => new Date(endDate) < new Date();
    const isExpiringSoon = (endDate: string) => {
        const diff = (new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        return diff > 0 && diff <= 30;
    };

    const filtered = contracts.filter(c => {
        if (filterBranch && c.clinicId !== filterBranch) return false;
        if (filterType && c.contractType !== filterType) return false;
        if (search) {
            const q = search.toLowerCase();
            return c.contractTitle.toLowerCase().includes(q) ||
                c.contractType.toLowerCase().includes(q) ||
                (c.contactPerson1 || '').toLowerCase().includes(q) ||
                (c.contactPerson2 || '').toLowerCase().includes(q);
        }
        return true;
    });

    const renderFormFields = (
        values: ContractForm | BranchContract,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onChange: (field: string, value: any) => void,
        cheques: ChequeEntry[],
        setCheques: (cheques: ChequeEntry[]) => void,
        cashInstallments: CashInstallmentEntry[],
        setCashInstallments: (items: CashInstallmentEntry[]) => void,
    ) => (
        <div className="space-y-5">
            {/* Branch & Type */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Branch *</label>
                    <select required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                        value={values.clinicId} onChange={e => onChange('clinicId', e.target.value)}>
                        <option value="">Select Branch...</option>
                        {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Contract Type *</label>
                    <select required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                        value={values.contractType} onChange={e => onChange('contractType', e.target.value)}>
                        {CONTRACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
            </div>

            {/* Title & Company */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Contract Title *</label>
                    <input required type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                        value={values.contractTitle} onChange={e => onChange('contractTitle', e.target.value)} placeholder="e.g. Annual Office Lease" />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Company Name</label>
                    <input type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                        value={values.companyName} onChange={e => onChange('companyName', e.target.value)} placeholder="e.g. ABC Services LLC" />
                </div>
            </div>

            {/* Amount & Tax */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Contract Amount (AED) *</label>
                    <input required type="number" min="0" step="0.01" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                        value={values.contractAmount} onChange={e => onChange('contractAmount', e.target.value)} placeholder="0.00" />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Tax Amount (AED)</label>
                    <input type="number" min="0" step="0.01" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                        value={values.taxAmount} onChange={e => onChange('taxAmount', e.target.value)} placeholder="0.00" />
                </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Start Date *</label>
                    <input required type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                        value={values.startDate} onChange={e => onChange('startDate', e.target.value)} />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">End Date *</label>
                    <input required type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                        value={values.endDate} onChange={e => onChange('endDate', e.target.value)} />
                </div>
            </div>

            {/* Payment Info */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Payment Details
                </h3>

                {/* Payment Method Toggle */}
                <div className="flex gap-2 mb-4">
                    <button type="button" onClick={() => onChange('paymentMethod', 'cheque')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${values.paymentMethod === 'cheque'
                            ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300'
                            : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-650'
                            }`}>
                        <CreditCard className="w-4 h-4" /> Cheque
                    </button>
                    <button type="button" onClick={() => onChange('paymentMethod', 'cash')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${values.paymentMethod === 'cash'
                            ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300'
                            : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-650'
                            }`}>
                        <Banknote className="w-4 h-4" /> Cash
                    </button>
                </div>

                {/* Cheque Mode */}
                {values.paymentMethod === 'cheque' && (
                    <div className="space-y-3 mb-4">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cheques</label>
                            <button type="button" onClick={() => {
                                const updated = [...cheques, { chequeNumber: '', date: '', amount: 0 }];
                                setCheques(updated);
                            }} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                                <Plus className="w-3 h-3" /> Add Cheque
                            </button>
                        </div>
                        {cheques.map((ch, i) => (
                            <div key={i} className="bg-gray-50 dark:bg-gray-750 p-3 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-gray-500">Cheque {i + 1}</span>
                                    {cheques.length > 1 && (
                                        <button type="button" onClick={() => {
                                            const updated = cheques.filter((_, idx) => idx !== i);
                                            setCheques(updated);
                                        }} className="text-xs text-red-500 hover:text-red-700"><X className="w-3.5 h-3.5" /></button>
                                    )}
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium mb-1">Cheque No.</label>
                                        <input type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                            value={ch.chequeNumber || ''} onChange={e => {
                                                const updated = [...cheques];
                                                updated[i] = { ...updated[i], chequeNumber: e.target.value };
                                                setCheques(updated);
                                            }} placeholder="e.g. 001234" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1">Date</label>
                                        <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                            value={ch.date} onChange={e => {
                                                const updated = [...cheques];
                                                updated[i] = { ...updated[i], date: e.target.value };
                                                setCheques(updated);
                                            }} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1">Amount (AED)</label>
                                        <input type="number" min="0" step="0.01" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                            value={ch.amount || ''} onChange={e => {
                                                const updated = [...cheques];
                                                updated[i] = { ...updated[i], amount: Number(e.target.value) || 0 };
                                                setCheques(updated);
                                            }} placeholder="0.00" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Cash Mode */}
                {values.paymentMethod === 'cash' && (
                    <div className="space-y-3 mb-4">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cash Installments</label>
                            <button type="button" onClick={() => {
                                setCashInstallments([...cashInstallments, { date: '', amount: 0 }]);
                            }} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                                <Plus className="w-3 h-3" /> Add Installment
                            </button>
                        </div>
                        {cashInstallments.map((inst, i) => (
                            <div key={i} className="bg-gray-50 dark:bg-gray-750 p-3 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-gray-500">Installment {i + 1}</span>
                                    {cashInstallments.length > 1 && (
                                        <button type="button" onClick={() => {
                                            setCashInstallments(cashInstallments.filter((_, idx) => idx !== i));
                                        }} className="text-xs text-red-500 hover:text-red-700"><X className="w-3.5 h-3.5" /></button>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium mb-1">Due Date</label>
                                        <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                            value={inst.date} onChange={e => {
                                                const updated = [...cashInstallments];
                                                updated[i] = { ...updated[i], date: e.target.value };
                                                setCashInstallments(updated);
                                            }} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1">Amount (AED)</label>
                                        <input type="number" min="0" step="0.01" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                            value={inst.amount || ''} onChange={e => {
                                                const updated = [...cashInstallments];
                                                updated[i] = { ...updated[i], amount: Number(e.target.value) || 0 };
                                                setCashInstallments(updated);
                                            }} placeholder="0.00" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Bank & Account */}
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Account Number</label>
                        <input type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                            value={values.accountNumber} onChange={e => onChange('accountNumber', e.target.value)} placeholder="Account number" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Bank Name</label>
                        <input type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                            value={values.bankName} onChange={e => onChange('bankName', e.target.value)} placeholder="e.g. Emirates NBD" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">TRN Number</label>
                        <input type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                            value={values.trnNumber} onChange={e => onChange('trnNumber', e.target.value)} placeholder="Tax Registration Number" />
                    </div>
                </div>
            </div>

            {/* Contact Info */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" /> Contact Information
                </h3>

                {/* Contact Person 1 */}
                <div className="bg-gray-50 dark:bg-gray-750 p-3 rounded-lg mb-3">
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Contact Person 1</div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-medium mb-1">Name</label>
                            <input type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                value={values.contactPerson1} onChange={e => onChange('contactPerson1', e.target.value)} placeholder="Full name" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1">Contact Number</label>
                            <input type="tel" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                value={values.contactPerson1Phone} onChange={e => onChange('contactPerson1Phone', e.target.value)} placeholder="+971 xx xxx xxxx" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1">WhatsApp</label>
                            <input type="tel" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                value={values.contactPerson1Whatsapp} onChange={e => onChange('contactPerson1Whatsapp', e.target.value)} placeholder="+971 xx xxx xxxx" />
                        </div>
                    </div>
                </div>

                {/* Contact Person 2 */}
                <div className="bg-gray-50 dark:bg-gray-750 p-3 rounded-lg mb-3">
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Contact Person 2</div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-medium mb-1">Name</label>
                            <input type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                value={values.contactPerson2} onChange={e => onChange('contactPerson2', e.target.value)} placeholder="Full name" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1">Contact Number</label>
                            <input type="tel" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                value={values.contactPerson2Phone} onChange={e => onChange('contactPerson2Phone', e.target.value)} placeholder="+971 xx xxx xxxx" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1">WhatsApp</label>
                            <input type="tel" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                value={values.contactPerson2Whatsapp} onChange={e => onChange('contactPerson2Whatsapp', e.target.value)} placeholder="+971 xx xxx xxxx" />
                        </div>
                    </div>
                </div>

                {/* Email */}
                <div>
                    <label className="block text-sm font-medium mb-1">Email ID</label>
                    <input type="email" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                        value={values.emailId} onChange={e => onChange('emailId', e.target.value)} placeholder="email@example.com" />
                </div>
            </div>

            {/* Contract PDF */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <Upload className="w-4 h-4" /> Contract PDF (max 1 MB)
                </h3>
                {('contractPdfName' in values && (values as BranchContract).contractPdfName) ? (
                    <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-750 p-3 rounded-lg">
                        <FileText className="w-5 h-5 text-red-500" />
                        <span className="text-sm font-medium flex-1 truncate">{(values as BranchContract).contractPdfName}</span>
                        <button type="button" onClick={() => { onChange('contractPdfBase64', undefined); onChange('contractPdfName', undefined); }}
                            className="text-xs text-red-500 hover:text-red-700">Remove</button>
                    </div>
                ) : (
                    <input type="file" accept=".pdf" className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 dark:file:bg-indigo-900/30 dark:file:text-indigo-400"
                        onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 1024 * 1024) {
                                alert('File size must be under 1 MB');
                                e.target.value = '';
                                return;
                            }
                            if (file.type !== 'application/pdf') {
                                alert('Only PDF files are allowed');
                                e.target.value = '';
                                return;
                            }
                            const reader = new FileReader();
                            reader.onload = () => {
                                onChange('contractPdfBase64', reader.result as string);
                                onChange('contractPdfName', file.name);
                            };
                            reader.readAsDataURL(file);
                        }} />
                )}
            </div>

            {/* Notes */}
            <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea rows={2} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                    value={values.notes} onChange={e => onChange('notes', e.target.value)} placeholder="Any additional notes..." />
            </div>
        </div>
    );

    if (loading) return <div className="p-8">Loading contracts...</div>;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                            <FileText className="w-8 h-8 text-indigo-600" />
                            Branch Contracts
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            Manage contracts for each branch — rental, pest control, cleaning, medical waste, and more.
                        </p>
                    </div>
                    <button onClick={() => { setForm({ ...emptyForm }); setIsAddOpen(true); }}
                        className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm">
                        <Plus className="w-4 h-4" /> Add Contract
                    </button>
                </header>

                {/* Filters */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input type="text" placeholder="Search contracts..."
                                className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <div className="relative">
                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <select className="pl-10 pr-8 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 appearance-none"
                                value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
                                <option value="">All Branches</option>
                                {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <select className="pl-10 pr-8 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 appearance-none"
                                value={filterType} onChange={e => setFilterType(e.target.value)}>
                                <option value="">All Types</option>
                                {CONTRACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                        <div className="text-sm text-gray-500 dark:text-gray-400">Total Contracts</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{contracts.length}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                        <div className="text-sm text-gray-500 dark:text-gray-400">Active</div>
                        <div className="text-2xl font-bold text-green-600 mt-1">{contracts.filter(c => !isExpired(c.endDate)).length}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                        <div className="text-sm text-gray-500 dark:text-gray-400">Expiring Soon</div>
                        <div className="text-2xl font-bold text-amber-600 mt-1">{contracts.filter(c => isExpiringSoon(c.endDate)).length}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                        <div className="text-sm text-gray-500 dark:text-gray-400">Total Value (AED)</div>
                        <div className="text-2xl font-bold text-indigo-600 mt-1">{contracts.reduce((s, c) => s + (c.contractAmount || 0), 0).toLocaleString()}</div>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="text-left p-4 font-medium text-gray-500 text-sm">Contract</th>
                                    <th className="text-left p-4 font-medium text-gray-500 text-sm">Branch</th>
                                    <th className="text-left p-4 font-medium text-gray-500 text-sm">Type</th>
                                    <th className="text-right p-4 font-medium text-gray-500 text-sm">Amount (AED)</th>
                                    <th className="text-right p-4 font-medium text-gray-500 text-sm">Tax (AED)</th>
                                    <th className="text-left p-4 font-medium text-gray-500 text-sm">Duration</th>
                                    <th className="text-left p-4 font-medium text-gray-500 text-sm">Contact</th>
                                    <th className="text-center p-4 font-medium text-gray-500 text-sm">Status</th>
                                    <th className="text-center p-4 font-medium text-gray-500 text-sm"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={8} className="text-center py-12 text-gray-500">
                                        {contracts.length === 0 ? 'No contracts yet. Click "Add Contract" to get started.' : 'No contracts match your filters.'}
                                    </td></tr>
                                ) : filtered.map(c => (
                                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer" onClick={() => openView(c)}>
                                        <td className="p-4">
                                            <div className="font-medium text-gray-900 dark:text-white">{c.contractTitle}</div>
                                            {c.companyName && <div className="text-xs text-gray-500">{c.companyName}</div>}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-1.5 text-sm">
                                                <Building2 className="w-3.5 h-3.5 text-gray-400" />
                                                {getClinicName(c.clinicId)}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`inline-flex text-xs px-2 py-1 rounded-full font-medium ${contractTypeColors[c.contractType] || contractTypeColors.Other}`}>
                                                {c.contractType}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right font-medium tabular-nums">{(c.contractAmount || 0).toLocaleString()}</td>
                                        <td className="p-4 text-right text-gray-500 tabular-nums">{c.taxAmount ? c.taxAmount.toLocaleString() : '—'}</td>
                                        <td className="p-4 text-sm">
                                            <div>{c.startDate}</div>
                                            <div className="text-xs text-gray-500">to {c.endDate}</div>
                                        </td>
                                        <td className="p-4">
                                            {c.contactPerson1 && <div className="text-sm">{c.contactPerson1}</div>}
                                            {c.contactPerson1Phone && <div className="text-xs text-gray-500">{c.contactPerson1Phone}</div>}
                                        </td>
                                        <td className="p-4 text-center">
                                            {isExpired(c.endDate) ? (
                                                <span className="inline-flex items-center gap-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-1 rounded-full font-medium">Expired</span>
                                            ) : isExpiringSoon(c.endDate) ? (
                                                <span className="inline-flex items-center gap-1 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-1 rounded-full font-medium">Expiring Soon</span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded-full font-medium">Active</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center gap-1 justify-center">
                                                <button onClick={e => { e.stopPropagation(); openEdit(c); }}
                                                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button onClick={e => { e.stopPropagation(); handleDelete(c.id); }}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
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
            </div>

            {/* ---- Add Modal ---- */}
            {isAddOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-3xl w-full p-6 shadow-xl my-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold">Add New Contract</h2>
                            <button onClick={() => setIsAddOpen(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleAdd}>
                            {renderFormFields(form, (field, value) => setForm(prev => ({ ...prev, [field]: value })), formCheques, setFormCheques, formCashInstallments, setFormCashInstallments)}
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setIsAddOpen(false)} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
                                <button type="submit" disabled={submitting} className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium">
                                    {submitting ? 'Adding...' : 'Add Contract'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ---- Edit Modal ---- */}
            {isEditOpen && editing && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-3xl w-full p-6 shadow-xl my-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold">Edit Contract</h2>
                            <button onClick={() => setIsEditOpen(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleUpdate}>
                            {renderFormFields(editing, (field, value) => setEditing(prev => prev ? { ...prev, [field]: value } : prev), editCheques, setEditCheques, editCashInstallments, setEditCashInstallments)}
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setIsEditOpen(false)} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
                                <button type="submit" disabled={submitting} className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium">
                                    {submitting ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ---- View Modal ---- */}
            {isViewOpen && viewing && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full p-6 shadow-xl my-8">
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{viewing.contractTitle}</h2>
                                <span className={`inline-flex text-xs px-2 py-1 rounded-full font-medium mt-1 ${contractTypeColors[viewing.contractType]}`}>{viewing.contractType}</span>
                            </div>
                            <button onClick={() => setIsViewOpen(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="bg-gray-50 dark:bg-gray-750 p-3 rounded-lg">
                                <div className="text-gray-500 text-xs mb-1">Branch</div>
                                <div className="font-medium">{getClinicName(viewing.clinicId)}</div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-750 p-3 rounded-lg">
                                <div className="text-gray-500 text-xs mb-1">Amount</div>
                                <div className="font-medium text-lg">{(viewing.contractAmount || 0).toLocaleString()} AED</div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-750 p-3 rounded-lg">
                                <div className="text-gray-500 text-xs mb-1">Tax Amount</div>
                                <div className="font-medium text-lg">{viewing.taxAmount ? `${viewing.taxAmount.toLocaleString()} AED` : '—'}</div>
                            </div>
                            {viewing.companyName && (
                                <div className="bg-gray-50 dark:bg-gray-750 p-3 rounded-lg col-span-2">
                                    <div className="text-gray-500 text-xs mb-1">Company</div>
                                    <div className="font-medium">{viewing.companyName}</div>
                                </div>
                            )}
                            <div className="bg-gray-50 dark:bg-gray-750 p-3 rounded-lg">
                                <div className="text-gray-500 text-xs mb-1">Start Date</div>
                                <div className="font-medium flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-gray-400" />{viewing.startDate}</div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-750 p-3 rounded-lg">
                                <div className="text-gray-500 text-xs mb-1">End Date</div>
                                <div className="font-medium flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-gray-400" />{viewing.endDate}</div>
                            </div>
                        </div>

                        {/* Payment */}
                        <div className="mt-5 border-t border-gray-200 dark:border-gray-700 pt-4">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4" /> Payment Details</h3>
                            <div className="text-sm mb-2">
                                <span className="text-gray-500">Method:</span> <strong className="capitalize">{viewing.paymentMethod || 'N/A'}</strong>
                            </div>

                            {viewing.paymentMethod === 'cheque' && viewing.cheques && viewing.cheques.length > 0 && (
                                <div className="space-y-2 mb-3">
                                    {viewing.cheques.map((ch, i) => (
                                        <div key={i} className="bg-gray-50 dark:bg-gray-750 p-2.5 rounded-lg flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs font-semibold text-gray-400">#{i + 1}</span>
                                                {ch.chequeNumber && <span className="text-gray-500">Cheque No: <strong>{ch.chequeNumber}</strong></span>}
                                                <span className="text-gray-500">Date: <strong>{ch.date}</strong></span>
                                            </div>
                                            <strong>{(ch.amount || 0).toLocaleString()} AED</strong>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {viewing.paymentMethod === 'cash' && viewing.cashInstallments && viewing.cashInstallments.length > 0 && (
                                <div className="space-y-2 mb-3">
                                    {viewing.cashInstallments.map((inst, i) => (
                                        <div key={i} className="bg-gray-50 dark:bg-gray-750 p-2.5 rounded-lg flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs font-semibold text-gray-400">#{i + 1}</span>
                                                <span className="text-gray-500">Due: <strong>{inst.date}</strong></span>
                                            </div>
                                            <strong>{(inst.amount || 0).toLocaleString()} AED</strong>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3 text-sm">
                                {viewing.accountNumber && <div><span className="text-gray-500">Account No:</span> <strong>{viewing.accountNumber}</strong></div>}
                                {viewing.bankName && <div><span className="text-gray-500">Bank:</span> <strong>{viewing.bankName}</strong></div>}
                                {viewing.trnNumber && <div><span className="text-gray-500">TRN:</span> <strong>{viewing.trnNumber}</strong></div>}
                            </div>
                        </div>

                        {/* Contact */}
                        <div className="mt-5 border-t border-gray-200 dark:border-gray-700 pt-4">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><User className="w-4 h-4" /> Contact Information</h3>
                            <div className="space-y-3 text-sm">
                                {viewing.contactPerson1 && (
                                    <div className="bg-gray-50 dark:bg-gray-750 p-2.5 rounded-lg">
                                        <div className="font-medium flex items-center gap-1.5 mb-1"><User className="w-3.5 h-3.5 text-gray-400" />{viewing.contactPerson1}</div>
                                        <div className="flex gap-4 text-xs text-gray-500 ml-5">
                                            {viewing.contactPerson1Phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{viewing.contactPerson1Phone}</span>}
                                            {viewing.contactPerson1Whatsapp && <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-green-500" />{viewing.contactPerson1Whatsapp}</span>}
                                        </div>
                                    </div>
                                )}
                                {viewing.contactPerson2 && (
                                    <div className="bg-gray-50 dark:bg-gray-750 p-2.5 rounded-lg">
                                        <div className="font-medium flex items-center gap-1.5 mb-1"><User className="w-3.5 h-3.5 text-gray-400" />{viewing.contactPerson2}</div>
                                        <div className="flex gap-4 text-xs text-gray-500 ml-5">
                                            {viewing.contactPerson2Phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{viewing.contactPerson2Phone}</span>}
                                            {viewing.contactPerson2Whatsapp && <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-green-500" />{viewing.contactPerson2Whatsapp}</span>}
                                        </div>
                                    </div>
                                )}
                                {viewing.emailId && <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-gray-400" />{viewing.emailId}</div>}
                            </div>
                        </div>

                        {viewing.notes && (
                            <div className="mt-5 border-t border-gray-200 dark:border-gray-700 pt-4">
                                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Notes</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">{viewing.notes}</p>
                            </div>
                        )}

                        {viewing.contractPdfBase64 && (
                            <div className="mt-5 border-t border-gray-200 dark:border-gray-700 pt-4">
                                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><FileText className="w-4 h-4" /> Contract PDF</h3>
                                <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-750 p-3 rounded-lg">
                                    <FileText className="w-5 h-5 text-red-500" />
                                    <span className="text-sm font-medium flex-1 truncate">{viewing.contractPdfName || 'contract.pdf'}</span>
                                    <a href={viewing.contractPdfBase64} download={viewing.contractPdfName || 'contract.pdf'}
                                        className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                                        <Download className="w-4 h-4" /> Download
                                    </a>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => { setIsViewOpen(false); openEdit(viewing); }}
                                className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 font-medium flex items-center gap-2">
                                <Edit2 className="w-4 h-4" /> Edit
                            </button>
                            <button onClick={() => setIsViewOpen(false)}
                                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

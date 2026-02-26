'use client';

import React, { useState, useEffect } from 'react';
import { Phone, Search, Plus, Edit2, Trash2, X, Clock, User, Building2, Stethoscope, ChevronDown, Eye, PhoneCall, CalendarDays } from 'lucide-react';
import { CallAgentSummary } from '@/lib/data';

interface SummaryForm {
    customerId: string;
    customerName: string;
    customerNumber: string;
    timestamp: string;
    callDuration: string;
    summary: string;
    nextSteps: string;
    branch: string;
    doctor: string;
    service: string;
    packageDetails: string;
    offerer: string;
}

const emptyForm: SummaryForm = {
    customerId: '', customerName: '', customerNumber: '',
    timestamp: '', callDuration: '', summary: '', nextSteps: '',
    branch: '', doctor: '', service: '', packageDetails: '', offerer: '',
};

function formatDuration(seconds: number): string {
    if (!seconds) return '0s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatDateTime(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('en-AE', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function CallAgentSummaryPage() {
    const [summaries, setSummaries] = useState<CallAgentSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [form, setForm] = useState<SummaryForm>({ ...emptyForm });
    const [editing, setEditing] = useState<CallAgentSummary | null>(null);
    const [viewing, setViewing] = useState<CallAgentSummary | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [search, setSearch] = useState('');
    const [filterBranch, setFilterBranch] = useState('');

    useEffect(() => {
        fetch('/api/admin/call-agent-summaries')
            .then(r => r.json())
            .then(setSummaries)
            .finally(() => setLoading(false));
    }, []);

    const fetchSummaries = async () => {
        const res = await fetch('/api/admin/call-agent-summaries');
        if (res.ok) setSummaries(await res.json());
    };

    /* ── CRUD ── */
    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = {
                ...form,
                callDuration: Number(form.callDuration) || 0,
                timestamp: form.timestamp ? new Date(form.timestamp).toISOString() : new Date().toISOString(),
            };
            const res = await fetch('/api/admin/call-agent-summaries', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                await fetchSummaries();
                setIsAddOpen(false);
                setForm({ ...emptyForm });
            } else alert('Failed to add summary');
        } catch (e) { console.error(e); } finally { setSubmitting(false); }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;
        setSubmitting(true);
        try {
            const res = await fetch('/api/admin/call-agent-summaries', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...editing,
                    callDuration: Number(editing.callDuration) || 0,
                }),
            });
            if (res.ok) { await fetchSummaries(); setIsEditOpen(false); setEditing(null); }
            else alert('Failed to update summary');
        } catch (e) { console.error(e); } finally { setSubmitting(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this call summary?')) return;
        try {
            const res = await fetch(`/api/admin/call-agent-summaries?id=${id}`, { method: 'DELETE' });
            if (res.ok) await fetchSummaries();
        } catch (e) { console.error(e); }
    };

    const openEdit = (s: CallAgentSummary) => {
        setEditing({ ...s });
        setIsEditOpen(true);
    };

    const openView = (s: CallAgentSummary) => {
        setViewing(s);
        setIsViewOpen(true);
    };

    /* ── Derive unique branch list from data ── */
    const branches = Array.from(new Set(summaries.map(s => s.branch).filter(Boolean)));

    /* ── Filtering ── */
    const filtered = summaries.filter(s => {
        if (filterBranch && s.branch !== filterBranch) return false;
        if (search) {
            const q = search.toLowerCase();
            return (
                s.customerName.toLowerCase().includes(q) ||
                s.customerId.toLowerCase().includes(q) ||
                s.customerNumber.includes(q) ||
                s.summary.toLowerCase().includes(q) ||
                (s.doctor || '').toLowerCase().includes(q) ||
                (s.service || '').toLowerCase().includes(q) ||
                (s.offerer || '').toLowerCase().includes(q)
            );
        }
        return true;
    });

    /* ── Stats ── */
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayCount = summaries.filter(s => s.timestamp?.slice(0, 10) === todayStr).length;
    const avgDuration = summaries.length > 0
        ? Math.round(summaries.reduce((acc, s) => acc + (s.callDuration || 0), 0) / summaries.length)
        : 0;

    /* ── Reusable form fields ── */
    const renderFormFields = (
        values: SummaryForm | CallAgentSummary,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onChange: (field: string, value: any) => void,
    ) => (
        <div className="space-y-5">
            {/* Customer Info */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" /> Customer Information
                </h3>
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Customer ID *</label>
                        <input required type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                            value={values.customerId} onChange={e => onChange('customerId', e.target.value)} placeholder="e.g. C001" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Name *</label>
                        <input required type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                            value={values.customerName} onChange={e => onChange('customerName', e.target.value)} placeholder="Full name" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Phone Number *</label>
                        <input required type="tel" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                            value={values.customerNumber} onChange={e => onChange('customerNumber', e.target.value)} placeholder="+971 xx xxx xxxx" />
                    </div>
                </div>
            </div>

            {/* Call Details */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <PhoneCall className="w-4 h-4" /> Call Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Timestamp</label>
                        <input type="datetime-local" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                            value={typeof values.timestamp === 'string' && values.timestamp.includes('T')
                                ? values.timestamp.slice(0, 16)
                                : values.timestamp}
                            onChange={e => onChange('timestamp', e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Call Duration (seconds)</label>
                        <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                            value={values.callDuration} onChange={e => onChange('callDuration', e.target.value)} placeholder="e.g. 180" />
                    </div>
                </div>
                <div className="mt-3">
                    <label className="block text-sm font-medium mb-1">Summary *</label>
                    <textarea required rows={3} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                        value={values.summary} onChange={e => onChange('summary', e.target.value)}
                        placeholder="Main discussion recap..." />
                </div>
                <div className="mt-3">
                    <label className="block text-sm font-medium mb-1">Next Steps / Follow-ups</label>
                    <textarea rows={2} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                        value={values.nextSteps || ''} onChange={e => onChange('nextSteps', e.target.value)}
                        placeholder="Actions needed after this call..." />
                </div>
            </div>

            {/* Service Info */}
            <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <Building2 className="w-4 h-4" /> Service Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Branch</label>
                        <input type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                            value={values.branch || ''} onChange={e => onChange('branch', e.target.value)} placeholder="e.g. Al Muraqabat" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Doctor</label>
                        <input type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                            value={values.doctor || ''} onChange={e => onChange('doctor', e.target.value)} placeholder="e.g. Dr. Ahmed" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Service</label>
                        <input type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                            value={values.service || ''} onChange={e => onChange('service', e.target.value)} placeholder="e.g. Pico Laser" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Offerer</label>
                        <input type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                            value={values.offerer || ''} onChange={e => onChange('offerer', e.target.value)} placeholder="Agent / Staff name" />
                    </div>
                </div>
                <div className="mt-3">
                    <label className="block text-sm font-medium mb-1">Package Details</label>
                    <input type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                        value={values.packageDetails || ''} onChange={e => onChange('packageDetails', e.target.value)}
                        placeholder="e.g. Gold Package — 5 sessions" />
                </div>
            </div>
        </div>
    );

    if (loading) return <div className="p-8">Loading call summaries...</div>;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                            <Phone className="w-8 h-8 text-indigo-600" />
                            Call Agent Summary
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            Track and review AI call agent communications with customers.
                        </p>
                    </div>
                    <button onClick={() => { setForm({ ...emptyForm }); setIsAddOpen(true); }}
                        className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm">
                        <Plus className="w-4 h-4" /> Add Summary
                    </button>
                </header>

                {/* Stat Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                        <div className="text-sm text-gray-500 dark:text-gray-400">Total Calls</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{summaries.length}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                        <div className="text-sm text-gray-500 dark:text-gray-400">Today&apos;s Calls</div>
                        <div className="text-2xl font-bold text-indigo-600 mt-1">{todayCount}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                        <div className="text-sm text-gray-500 dark:text-gray-400">Avg Duration</div>
                        <div className="text-2xl font-bold text-teal-600 mt-1">{formatDuration(avgDuration)}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                        <div className="text-sm text-gray-500 dark:text-gray-400">Unique Customers</div>
                        <div className="text-2xl font-bold text-amber-600 mt-1">
                            {new Set(summaries.map(s => s.customerId)).size}
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input type="text" placeholder="Search by name, ID, phone, summary..."
                                className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        {branches.length > 0 && (
                            <div className="relative">
                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <select className="pl-10 pr-8 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 appearance-none"
                                    value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
                                    <option value="">All Branches</option>
                                    {branches.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="text-left p-4 font-medium text-gray-500 text-sm">Customer</th>
                                    <th className="text-left p-4 font-medium text-gray-500 text-sm">Phone</th>
                                    <th className="text-left p-4 font-medium text-gray-500 text-sm">Date / Time</th>
                                    <th className="text-left p-4 font-medium text-gray-500 text-sm">Duration</th>
                                    <th className="text-left p-4 font-medium text-gray-500 text-sm">Branch</th>
                                    <th className="text-left p-4 font-medium text-gray-500 text-sm">Service</th>
                                    <th className="text-left p-4 font-medium text-gray-500 text-sm max-w-xs">Summary</th>
                                    <th className="text-center p-4 font-medium text-gray-500 text-sm"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={8} className="text-center py-12 text-gray-500">
                                        {summaries.length === 0
                                            ? 'No call summaries yet. Click "Add Summary" to get started or use the external API.'
                                            : 'No summaries match your search.'}
                                    </td></tr>
                                ) : filtered.map(s => (
                                    <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer" onClick={() => openView(s)}>
                                        <td className="p-4">
                                            <div className="font-medium text-gray-900 dark:text-white">{s.customerName}</div>
                                            <div className="text-xs text-gray-500">{s.customerId}</div>
                                        </td>
                                        <td className="p-4 text-sm">{s.customerNumber}</td>
                                        <td className="p-4 text-sm">
                                            <div className="flex items-center gap-1.5">
                                                <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
                                                {formatDateTime(s.timestamp)}
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm">
                                            <span className="inline-flex items-center gap-1 text-xs bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 px-2 py-1 rounded-full font-medium">
                                                <Clock className="w-3 h-3" /> {formatDuration(s.callDuration)}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm">{s.branch || '—'}</td>
                                        <td className="p-4 text-sm">{s.service || '—'}</td>
                                        <td className="p-4 text-sm max-w-xs truncate">{s.summary}</td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center gap-1 justify-center">
                                                <button onClick={e => { e.stopPropagation(); openView(s); }}
                                                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors">
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button onClick={e => { e.stopPropagation(); openEdit(s); }}
                                                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button onClick={e => { e.stopPropagation(); handleDelete(s.id); }}
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

            {/* ── Add Modal ── */}
            {isAddOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-3xl w-full p-6 shadow-xl my-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold">Add Call Summary</h2>
                            <button onClick={() => setIsAddOpen(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleAdd}>
                            {renderFormFields(form, (field, value) => setForm(prev => ({ ...prev, [field]: value })))}
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setIsAddOpen(false)} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
                                <button type="submit" disabled={submitting} className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium">
                                    {submitting ? 'Adding...' : 'Add Summary'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Edit Modal ── */}
            {isEditOpen && editing && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-3xl w-full p-6 shadow-xl my-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold">Edit Call Summary</h2>
                            <button onClick={() => setIsEditOpen(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleUpdate}>
                            {renderFormFields(editing, (field, value) => setEditing(prev => prev ? { ...prev, [field]: value } : prev))}
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

            {/* ── View Modal ── */}
            {isViewOpen && viewing && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full p-6 shadow-xl my-8">
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{viewing.customerName}</h2>
                                <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                                    <span>{viewing.customerId}</span> · <span>{viewing.customerNumber}</span>
                                </div>
                            </div>
                            <button onClick={() => setIsViewOpen(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>

                        {/* Call Info */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="bg-gray-50 dark:bg-gray-750 p-3 rounded-lg">
                                <div className="text-gray-500 text-xs mb-1">Timestamp</div>
                                <div className="font-medium flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 text-gray-400" />{formatDateTime(viewing.timestamp)}</div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-750 p-3 rounded-lg">
                                <div className="text-gray-500 text-xs mb-1">Call Duration</div>
                                <div className="font-medium flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-gray-400" />{formatDuration(viewing.callDuration)}</div>
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="mt-4">
                            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Summary</div>
                            <div className="bg-gray-50 dark:bg-gray-750 p-3 rounded-lg text-sm whitespace-pre-wrap">{viewing.summary}</div>
                        </div>

                        {viewing.nextSteps && (
                            <div className="mt-3">
                                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Next Steps</div>
                                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg text-sm whitespace-pre-wrap text-indigo-800 dark:text-indigo-300">{viewing.nextSteps}</div>
                            </div>
                        )}

                        {/* Service Details */}
                        <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                <Stethoscope className="w-4 h-4" /> Service Details
                            </h3>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                {viewing.branch && (
                                    <div className="bg-gray-50 dark:bg-gray-750 p-2.5 rounded-lg">
                                        <span className="text-gray-500 text-xs">Branch:</span> <strong>{viewing.branch}</strong>
                                    </div>
                                )}
                                {viewing.doctor && (
                                    <div className="bg-gray-50 dark:bg-gray-750 p-2.5 rounded-lg">
                                        <span className="text-gray-500 text-xs">Doctor:</span> <strong>{viewing.doctor}</strong>
                                    </div>
                                )}
                                {viewing.service && (
                                    <div className="bg-gray-50 dark:bg-gray-750 p-2.5 rounded-lg">
                                        <span className="text-gray-500 text-xs">Service:</span> <strong>{viewing.service}</strong>
                                    </div>
                                )}
                                {viewing.offerer && (
                                    <div className="bg-gray-50 dark:bg-gray-750 p-2.5 rounded-lg">
                                        <span className="text-gray-500 text-xs">Offerer:</span> <strong>{viewing.offerer}</strong>
                                    </div>
                                )}
                                {viewing.packageDetails && (
                                    <div className="bg-gray-50 dark:bg-gray-750 p-2.5 rounded-lg col-span-2">
                                        <span className="text-gray-500 text-xs">Package:</span> <strong>{viewing.packageDetails}</strong>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="mt-4 text-xs text-gray-400 text-right">
                            Created: {formatDateTime(viewing.createdAt)}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

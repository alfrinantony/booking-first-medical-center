'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    FileText, Printer, CheckCircle, XCircle, Trash2,
    Clock, AlertTriangle, ChevronDown, Eye, Send
} from 'lucide-react';
import type { LetterType, LetterStatus, EmployeeLetter } from '@/lib/hr-letters-store';
import { LETTER_TYPE_LABELS } from '@/lib/hr-constants';

interface Employee {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    designation: string;
    department: string;
    joiningDate: string;
    sickLeavesTaken: number;
    status: string;
}

const STATUS_COLORS: Record<LetterStatus, { bg: string; text: string; label: string }> = {
    DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' },
    PENDING_APPROVAL: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending Approval' },
    APPROVED: { bg: 'bg-green-100', text: 'text-green-700', label: 'Approved' },
    REJECTED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' },
};

export default function LettersPage() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [letters, setLetters] = useState<EmployeeLetter[]>([]);
    const [loading, setLoading] = useState(true);

    // Generate form
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [letterType, setLetterType] = useState<LetterType>('SALARY_CERTIFICATE');
    const [issuedDate, setIssuedDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState('');
    const [sickLeaves, setSickLeaves] = useState<number>(0);
    const [disciplinaryActions, setDisciplinaryActions] = useState('');
    const [generating, setGenerating] = useState(false);

    // Preview
    const [previewLetter, setPreviewLetter] = useState<EmployeeLetter | null>(null);

    // Filters
    const [filterType, setFilterType] = useState<string>('');
    const [filterStatus, setFilterStatus] = useState<string>('');

    const loadEmployees = useCallback(async () => {
        const res = await fetch('/api/admin/hr/employees?');
        if (res.ok) setEmployees(await res.json());
    }, []);

    const loadLetters = useCallback(async () => {
        const params = new URLSearchParams();
        if (filterType) params.set('letterType', filterType);
        if (filterStatus) params.set('status', filterStatus);
        const res = await fetch(`/api/admin/hr/letters?${params}`);
        if (res.ok) setLetters(await res.json());
    }, [filterType, filterStatus]);

    useEffect(() => {
        Promise.all([loadEmployees(), loadLetters()]).then(() => setLoading(false));
    }, [loadEmployees, loadLetters]);

    // Auto-fill sick leaves when employee changes
    useEffect(() => {
        if (selectedEmployee && letterType === 'EXPERIENCE_CERTIFICATE') {
            const emp = employees.find(e => e.id === selectedEmployee);
            if (emp) setSickLeaves(emp.sickLeavesTaken || 0);
        }
    }, [selectedEmployee, letterType, employees]);

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmployee || !letterType) return;
        setGenerating(true);

        try {
            const body: any = {
                employeeId: selectedEmployee,
                letterType,
                issuedDate,
                generatedBy: 'HR Department',
            };
            if (letterType === 'EXPERIENCE_CERTIFICATE') {
                body.endDate = endDate;
                body.sickLeavesTaken = sickLeaves;
                body.disciplinaryActions = disciplinaryActions;
            }

            const res = await fetch('/api/admin/hr/letters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                await loadLetters();
                setDisciplinaryActions('');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setGenerating(false);
        }
    };

    const handleApprove = async (id: string) => {
        await fetch(`/api/admin/hr/letters/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'approve', approvedBy: 'CEO' }),
        });
        loadLetters();
    };

    const handleReject = async (id: string) => {
        const reason = prompt('Reason for rejection:');
        if (reason === null) return;
        await fetch(`/api/admin/hr/letters/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reject', rejectedReason: reason }),
        });
        loadLetters();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this letter?')) return;
        await fetch(`/api/admin/hr/letters/${id}`, { method: 'DELETE' });
        loadLetters();
    };

    const handlePrint = (letter: EmployeeLetter) => {
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${LETTER_TYPE_LABELS[letter.letterType]} - ${letter.referenceNumber}</title>
                <style>
                    @media print { body { margin: 0; } @page { margin: 20mm; } }
                    body { font-family: 'Times New Roman', serif; }
                </style>
            </head>
            <body>${letter.content}</body>
            </html>
        `);
        win.document.close();
        setTimeout(() => win.print(), 300);
    };

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <FileText className="w-7 h-7 text-indigo-600" />
                        Employee Letters
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Generate and manage employee certificates</p>
                </div>
            </div>

            {/* Generate Form */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Send className="w-5 h-5 text-indigo-600" />
                    Generate Certificate
                </h3>
                <form onSubmit={handleGenerate} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Employee</label>
                            <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)} required>
                                <option value="">Select employee...</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.employeeCode} — {emp.firstName} {emp.lastName}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Certificate Type</label>
                            <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                value={letterType} onChange={e => setLetterType(e.target.value as LetterType)}>
                                {Object.entries(LETTER_TYPE_LABELS).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Issue Date</label>
                            <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                value={issuedDate} onChange={e => setIssuedDate(e.target.value)} required />
                        </div>
                        <div className="flex items-end">
                            <button type="submit" disabled={!selectedEmployee || generating}
                                className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2">
                                <FileText className="w-4 h-4" />
                                {generating ? 'Generating...' : 'Generate'}
                            </button>
                        </div>
                    </div>

                    {/* Experience Certificate extras */}
                    {letterType === 'EXPERIENCE_CERTIFICATE' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-800">
                            <div>
                                <label className="block text-xs font-medium text-amber-700 mb-1">Last Working Day</label>
                                <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={endDate} onChange={e => setEndDate(e.target.value)} required />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-amber-700 mb-1">Sick Leaves Taken</label>
                                <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={sickLeaves} onChange={e => setSickLeaves(Number(e.target.value))} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-amber-700 mb-1">Disciplinary Actions <span className="text-[10px] text-gray-400">(excl. suspension/warning)</span></label>
                                <input type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    placeholder="e.g., 1 written reprimand"
                                    value={disciplinaryActions} onChange={e => setDisciplinaryActions(e.target.value)} />
                            </div>
                        </div>
                    )}
                </form>
            </div>

            {/* Filters + Letters Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between flex-wrap gap-3">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Generated Letters</h3>
                    <div className="flex gap-2">
                        <select className="p-1.5 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-xs"
                            value={filterType} onChange={e => setFilterType(e.target.value)}>
                            <option value="">All Types</option>
                            {Object.entries(LETTER_TYPE_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                        <select className="p-1.5 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-xs"
                            value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                            <option value="">All Statuses</option>
                            <option value="PENDING_APPROVAL">Pending</option>
                            <option value="APPROVED">Approved</option>
                            <option value="REJECTED">Rejected</option>
                        </select>
                    </div>
                </div>

                {letters.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No letters generated yet.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th className="text-left p-3 text-xs font-medium text-gray-500">Ref #</th>
                                    <th className="text-left p-3 text-xs font-medium text-gray-500">Employee</th>
                                    <th className="text-left p-3 text-xs font-medium text-gray-500">Type</th>
                                    <th className="text-left p-3 text-xs font-medium text-gray-500">Date</th>
                                    <th className="text-left p-3 text-xs font-medium text-gray-500">Status</th>
                                    <th className="text-center p-3 text-xs font-medium text-gray-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {letters.map(letter => {
                                    const sc = STATUS_COLORS[letter.status];
                                    return (
                                        <tr key={letter.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="p-3 font-mono text-xs text-indigo-600 font-medium">{letter.referenceNumber}</td>
                                            <td className="p-3">
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">{letter.employeeName}</div>
                                                <div className="text-xs text-gray-500">{letter.employeeCode}</div>
                                            </td>
                                            <td className="p-3 text-sm">{LETTER_TYPE_LABELS[letter.letterType]}</td>
                                            <td className="p-3 text-sm text-gray-600">{new Date(letter.issuedDate).toLocaleDateString('en-GB')}</td>
                                            <td className="p-3">
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.bg} ${sc.text}`}>
                                                    {sc.label}
                                                </span>
                                                {letter.approvedBy && (
                                                    <span className="text-[10px] text-gray-400 ml-1">by {letter.approvedBy}</span>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button onClick={() => setPreviewLetter(letter)}
                                                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded" title="Preview">
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    {letter.status === 'APPROVED' && (
                                                        <button onClick={() => handlePrint(letter)}
                                                            className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Print">
                                                            <Printer className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {letter.status === 'PENDING_APPROVAL' && (
                                                        <>
                                                            <button onClick={() => handleApprove(letter.id)}
                                                                className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Approve (CEO)">
                                                                <CheckCircle className="w-4 h-4" />
                                                            </button>
                                                            <button onClick={() => handleReject(letter.id)}
                                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Reject">
                                                                <XCircle className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                    <button onClick={() => handleDelete(letter.id)}
                                                        className="p-1.5 text-red-400 hover:bg-red-50 rounded" title="Delete">
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
                )}
            </div>

            {/* Preview Modal */}
            {previewLetter && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto">
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
                            <div>
                                <h3 className="font-semibold text-gray-900 dark:text-white">{LETTER_TYPE_LABELS[previewLetter.letterType]}</h3>
                                <p className="text-xs text-gray-500">{previewLetter.referenceNumber} · {previewLetter.employeeName}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {previewLetter.status === 'APPROVED' && (
                                    <button onClick={() => handlePrint(previewLetter)}
                                        className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 hover:bg-green-700">
                                        <Printer className="w-3.5 h-3.5" /> Print
                                    </button>
                                )}
                                {previewLetter.status === 'PENDING_APPROVAL' && (
                                    <button onClick={() => { handleApprove(previewLetter.id); setPreviewLetter(null); }}
                                        className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 hover:bg-green-700">
                                        <CheckCircle className="w-3.5 h-3.5" /> Approve
                                    </button>
                                )}
                                <button onClick={() => setPreviewLetter(null)}
                                    className="text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-gray-50">
                                    Close
                                </button>
                            </div>
                        </div>
                        <div className="p-6" dangerouslySetInnerHTML={{ __html: previewLetter.content }} />
                        {previewLetter.status !== 'APPROVED' && (
                            <div className="px-6 pb-4">
                                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                    <span>This certificate requires CEO approval before it can be printed.</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

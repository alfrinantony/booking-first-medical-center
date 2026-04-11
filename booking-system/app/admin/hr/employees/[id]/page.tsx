'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, Save, User, FileText, Calculator, CalendarDays,
    Upload, Trash2, Download, AlertTriangle, CheckCircle, Clock,
    Briefcase, ChevronDown, ChevronRight, Printer
} from 'lucide-react';
import type { Employee, EmployeeStatus, EmploymentType, Gender } from '@/lib/hr-store';
import { WORKPLACES, VISA_ISSUING_BRANCHES, LABOR_CARD_STATUSES, DEPARTMENTS } from '@/lib/hr-store';
import type { EmployeeDocument, DocumentCategory, DocumentCategoryInfo } from '@/lib/hr-documents-store';
import { DOCUMENT_CATEGORIES } from '@/lib/hr-documents-store';
import type { TerminationType } from '@/lib/hr-payroll-store';
import { HRPayroll } from '@/lib/hr-payroll-store';
import LeaveTab from '@/components/LeaveTab';
import PayslipGenerator from '@/components/PayslipGenerator';

type Tab = 'profile' | 'documents' | 'payroll' | 'leave';

export default function EmployeeDetailPage() {
    const params = useParams();
    const router = useRouter();
    const employeeId = params.id as string;

    const [employee, setEmployee] = useState<Employee | null>(null);
    const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
    const [payroll, setPayroll] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<Tab>('profile');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Employee>>({});
    const [terminationType, setTerminationType] = useState<TerminationType>('EMPLOYER_TERMINATION');

    // Upload state
    const [uploadCategory, setUploadCategory] = useState<DocumentCategory>('RECRUITMENT');
    const [uploadDocType, setUploadDocType] = useState(DOCUMENT_CATEGORIES[0].docTypes[0]);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadExpiry, setUploadExpiry] = useState('');
    const [uploadIssueDate, setUploadIssueDate] = useState('');
    const [uploadNotes, setUploadNotes] = useState('');
    const [uploading, setUploading] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<Set<DocumentCategory>>(new Set(['RECRUITMENT', 'LEGAL']));

    // Dynamic EOS State
    const [eosPendingSalary, setEosPendingSalary] = useState(0);
    const [eosEarlyNoticeDeduction, setEosEarlyNoticeDeduction] = useState(0);
    const [eosAbsentInNoticePeriod, setEosAbsentInNoticePeriod] = useState(0);
    const [eosUniformExpenses, setEosUniformExpenses] = useState(0);
    const [eosOtherDeductions, setEosOtherDeductions] = useState(0);

    const loadEmployee = useCallback(async () => {
        try {
            const res = await fetch(`/api/admin/hr/employees/${employeeId}`);
            if (res.ok) {
                const data = await res.json();
                setEmployee(data);
                setEditForm(data);
            } else {
                router.push('/admin/hr/employees');
            }
        } catch { router.push('/admin/hr/employees'); }
    }, [employeeId, router]);

    const loadDocuments = useCallback(async () => {
        const res = await fetch(`/api/admin/hr/documents?employeeId=${employeeId}`);
        if (res.ok) setDocuments(await res.json());
    }, [employeeId]);

    const loadPayroll = useCallback(async () => {
        const res = await fetch(`/api/admin/hr/payroll?employeeId=${employeeId}&terminationType=${terminationType}`);
        if (res.ok) setPayroll(await res.json());
    }, [employeeId, terminationType]);

    useEffect(() => {
        Promise.all([loadEmployee(), loadDocuments()]).then(() => setLoading(false));
    }, [loadEmployee, loadDocuments]);

    useEffect(() => {
        if (activeTab === 'payroll' || activeTab === 'leave') loadPayroll();
    }, [activeTab, terminationType, loadPayroll]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/admin/hr/employees/${employeeId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm),
            });
            if (res.ok) {
                const data = await res.json();
                setEmployee(data);
                setEditForm(data);
            }
        } catch (err) { console.error(err); }
        finally { setSaving(false); }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!uploadFile) return;
        setUploading(true);

        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('employeeId', employeeId);
        formData.append('category', uploadCategory);
        formData.append('documentType', uploadDocType);
        if (uploadExpiry) formData.append('expiryDate', uploadExpiry);
        if (uploadIssueDate) formData.append('issueDate', uploadIssueDate);
        if (uploadNotes) formData.append('notes', uploadNotes);

        try {
            const res = await fetch('/api/admin/hr/documents', { method: 'POST', body: formData });
            if (res.ok) {
                await loadDocuments();
                setUploadFile(null);
                setUploadExpiry('');
                setUploadIssueDate('');
                setUploadNotes('');
            }
        } catch (err) { console.error(err); }
        finally { setUploading(false); }
    };

    const handleDeleteDoc = async (docId: string) => {
        if (!confirm('Delete this document?')) return;
        await fetch(`/api/admin/hr/documents/${docId}`, { method: 'DELETE' });
        loadDocuments();
    };

    const printEOS = () => {
        const el = document.getElementById('eos-print');
        if (!el || !employee || !dynamicEOS) return;
        const w = window.open('', '_blank');
        if (!w) return;
        w.document.write(`<html><head><title>Final Settlement - ${employee.firstName} ${employee.lastName}</title>
        <style>
            body { font-family: 'Segoe UI', sans-serif; margin: 40px; color: #222; }
            h1 { text-align: center; margin-bottom: 5px; color: #111; font-size: 24px; }
            h2 { border-bottom: 2px solid #222; padding-bottom: 5px; margin-top: 30px; margin-bottom: 15px; font-size: 16px; }
            p { margin: 8px 0; font-size: 14px; }
            .header { text-align: center; margin-bottom: 40px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background: #f9f9f9; width: 60%; font-weight: 600; }
            .right { text-align: right; }
            .total { font-weight: bold; font-size: 16px; background: #eef2ff !important; }
            .total td { font-weight: bold; }
            .subtitle { color: #555; text-align: center; margin-bottom: 30px; font-size: 14px; letter-spacing: 1px; }
            .signature-box { margin-top: 80px; display: flex; justify-content: space-between; }
            .sig-line { border-top: 1px solid #000; width: 250px; text-align: center; padding-top: 10px; margin-top: 60px; font-weight: bold; font-size: 14px; }
            .red-text { color: #d97706; }
            @media print { body { margin: 20px; } }
        </style></head><body>${el.innerHTML}</body></html>`);
        w.document.close();
        w.print();
    };

    if (loading || !employee) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
            </div>
        );
    }

    const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
        { key: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
        { key: 'documents', label: 'Documents', icon: <FileText className="w-4 h-4" /> },
        { key: 'payroll', label: 'Payroll & EOS', icon: <Calculator className="w-4 h-4" /> },
        { key: 'leave', label: 'Leave', icon: <CalendarDays className="w-4 h-4" /> },
    ];

    const dynamicEOS = employee ? HRPayroll.calculateEndOfService(employee, terminationType, undefined, {
        pendingSalary: eosPendingSalary,
        earlyNoticeDeduction: eosEarlyNoticeDeduction,
        absentInNoticePeriod: eosAbsentInNoticePeriod,
        uniformExpenses: eosUniformExpenses,
        otherDeductions: eosOtherDeductions
    }) : null;

    const getDocExpiryBadge = (doc: EmployeeDocument) => {
        if (!doc.expiryDate) return null;
        const days = Math.ceil((new Date(doc.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (days < 0) return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Expired</span>;
        if (days <= 30) return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1"><Clock className="w-3 h-3" />{days}d left</span>;
        return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1"><CheckCircle className="w-3 h-3" />{days}d left</span>;
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Back + Header */}
            <div className="mb-6">
                <Link href="/admin/hr/employees" className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mb-3">
                    <ArrowLeft className="w-4 h-4" /> Back to Employees
                </Link>
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 text-xl font-bold">
                        {employee.firstName[0]}{employee.lastName[0]}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{employee.firstName} {employee.middleName ? `${employee.middleName} ` : ''}{employee.lastName}</h1>
                        <p className="text-gray-500">{employee.employeeCode} · {employee.designation} · {employee.department}</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                {tabs.map(tab => (
                    <button key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.key
                            ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        {tab.icon}{tab.label}
                    </button>
                ))}
            </div>

            {/* ═══ PROFILE TAB ═══ */}
            {activeTab === 'profile' && (
                <div className="space-y-6">
                    <fieldset className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                        <legend className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-2">Personal Information</legend>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {[
                                { label: 'First Name', key: 'firstName' },
                                { label: 'Middle Name', key: 'middleName' },
                                { label: 'Last Name', key: 'lastName' },
                                { label: 'Email', key: 'email', type: 'email' },
                                { label: 'Phone', key: 'phone' },
                                { label: 'WhatsApp Number', key: 'whatsappNumber' },
                                { label: 'Date of Birth', key: 'dateOfBirth', type: 'date' },
                                { label: 'Nationality', key: 'nationality' },
                                { label: 'Employee Number', key: 'employeeNumber' },
                            ].map(f => (
                                <div key={f.key}>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
                                    <input type={f.type || 'text'}
                                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={(editForm as any)[f.key] || ''}
                                        onChange={e => setEditForm({ ...editForm, [f.key]: e.target.value })}
                                    />
                                </div>
                            ))}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Religion</label>
                                <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={editForm.religion || ''}
                                    onChange={e => setEditForm({ ...editForm, religion: e.target.value })}>
                                    <option value="">Select...</option>
                                    <option value="Islam">Islam</option>
                                    <option value="Christianity">Christianity</option>
                                    <option value="Hinduism">Hinduism</option>
                                    <option value="Buddhism">Buddhism</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">IBAN Number</label>
                                <input type="text" maxLength={23} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm uppercase"
                                    value={editForm.ibanNumber || ''}
                                    placeholder="AE000000000000000000000"
                                    onChange={e => {
                                        let val = e.target.value.toUpperCase();
                                        if (val.length > 0 && !val.startsWith('A')) val = 'A';
                                        if (val.length > 1 && !val.startsWith('AE')) val = 'AE' + val.substring(2);
                                        if (val.length > 2) val = 'AE' + val.substring(2).replace(/[^0-9]/g, '');
                                        setEditForm({ ...editForm, ibanNumber: val.substring(0, 23) });
                                    }}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Gender</label>
                                <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={editForm.gender || 'MALE'}
                                    onChange={e => setEditForm({ ...editForm, gender: e.target.value as Gender })}>
                                    <option value="MALE">Male</option>
                                    <option value="FEMALE">Female</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Marital Status</label>
                                <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={(editForm as any).maritalStatus || 'SINGLE'}
                                    onChange={e => setEditForm({ ...editForm, maritalStatus: e.target.value as any })}>
                                    <option value="SINGLE">Single</option>
                                    <option value="MARRIED">Married</option>
                                    <option value="DIVORCED">Divorced</option>
                                    <option value="WIDOWED">Widowed</option>
                                </select>
                            </div>
                        </div>
                    </fieldset>

                    <fieldset className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                        <legend className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-2">Employment</legend>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Designation</label>
                                <input className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={editForm.designation || ''} onChange={e => setEditForm({ ...editForm, designation: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Business Department</label>
                                <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={editForm.department || ''} onChange={e => setEditForm({ ...editForm, department: e.target.value })}>
                                    <option value="">Select business department...</option>
                                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Place of Work</label>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {WORKPLACES.map(w => {
                                        const ids: string[] = (editForm as any).workplaceIds?.length
                                            ? (editForm as any).workplaceIds
                                            : editForm.workplaceId ? [editForm.workplaceId] : ['clinic-1'];
                                        const checked = ids.includes(w.id);
                                        return (
                                            <label key={w.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                                                checked
                                                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-600 dark:text-indigo-300'
                                                    : 'bg-gray-50 border-gray-200 text-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                                            }`}>
                                                <input type="checkbox" className="w-3.5 h-3.5 rounded" checked={checked}
                                                    onChange={() => {
                                                        const updated = checked
                                                            ? ids.filter(x => x !== w.id)
                                                            : [...ids, w.id];
                                                        const primary = updated[0] || 'clinic-1';
                                                        const primaryName = WORKPLACES.find(wp => wp.id === primary)?.name || '';
                                                        setEditForm({ ...editForm, workplaceIds: updated, workplaceId: primary, workplaceName: primaryName });
                                                    }} />
                                                {w.name}
                                            </label>
                                        );
                                    })}
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1">Select one or more branches</p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Joining Date</label>
                                <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={editForm.joiningDate || ''} onChange={e => setEditForm({ ...editForm, joiningDate: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                                <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={editForm.status || 'ACTIVE'}
                                    onChange={e => setEditForm({ ...editForm, status: e.target.value as EmployeeStatus })}>
                                    <option value="ACTIVE">Active</option>
                                    <option value="ON_LEAVE">On Leave</option>
                                    <option value="TERMINATED">Terminated</option>
                                    <option value="RESIGNED">Resigned</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Employment Type</label>
                                <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={editForm.employmentType || 'FULL_TIME'}
                                    onChange={e => setEditForm({ ...editForm, employmentType: e.target.value as EmploymentType })}>
                                    <option value="FULL_TIME">Full Time</option>
                                    <option value="PART_TIME">Part Time</option>
                                    <option value="CONTRACT">Contract</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Contract End</label>
                                <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={editForm.contractEndDate || ''} onChange={e => setEditForm({ ...editForm, contractEndDate: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Weekly Off Days</label>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {['Friday', 'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'].map(d => {
                                        const days: string[] = Array.isArray((editForm as any).weeklyOffDays)
                                            ? (editForm as any).weeklyOffDays
                                            : (editForm as any).weeklyOffDay
                                                ? [(editForm as any).weeklyOffDay]
                                                : ['Friday'];
                                        const checked = days.includes(d);
                                        return (
                                            <label key={d} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                                                checked
                                                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-600 dark:text-indigo-300'
                                                    : 'bg-gray-50 border-gray-200 text-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                                            }`}>
                                                <input type="checkbox" className="w-3.5 h-3.5 rounded" checked={checked}
                                                    onChange={() => {
                                                        const updated = checked
                                                            ? days.filter(x => x !== d)
                                                            : [...days, d];
                                                        setEditForm({ ...editForm, weeklyOffDays: updated as any });
                                                    }} />
                                                {d.slice(0, 3)}
                                            </label>
                                        );
                                    })}
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1">Select 1 or 2 days</p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Notice Period</label>
                                <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={(editForm as any).noticePeriod || '1 Month'}
                                    onChange={e => setEditForm({ ...editForm, noticePeriod: e.target.value as any })}>
                                    <option value="1 Month">1 Month</option>
                                    <option value="2 Months">2 Months</option>
                                    <option value="3 Months">3 Months</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Probation Period</label>
                                <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={(editForm as any).probationPeriod || '3 Months'}
                                    onChange={e => setEditForm({ ...editForm, probationPeriod: e.target.value as any })}>
                                    <option value="3 Months">3 Months</option>
                                    <option value="6 Months">6 Months</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Penalty Training Expenses (AED)</label>
                                <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={(editForm as any).penaltyTrainingExpenses || 0}
                                    onChange={e => setEditForm({ ...editForm, penaltyTrainingExpenses: Number(e.target.value) as any })} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Resignation Ban Duration</label>
                                <input className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={(editForm as any).resignationBanDuration || ''}
                                    onChange={e => setEditForm({ ...editForm, resignationBanDuration: e.target.value as any })} />
                            </div>
                            <div className="sm:col-span-3">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Penalty Ban Details</label>
                                <textarea rows={2} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={(editForm as any).penaltyBanDetails || ''}
                                    onChange={e => setEditForm({ ...editForm, penaltyBanDetails: e.target.value as any })} />
                            </div>
                        </div>
                    </fieldset>

                    <fieldset className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                        <legend className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-2">Salary (AED / month)</legend>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                            {[
                                { label: 'Basic Salary', key: 'basicSalary' },
                                { label: 'Housing', key: 'housingAllowance' },
                                { label: 'Transport', key: 'transportAllowance' },
                                { label: 'Other', key: 'otherAllowances' },
                                { label: 'Work Allowance', key: 'workAllowance' },
                                { label: 'Training Allowance', key: 'trainingAllowance' },
                            ].map(f => (
                                <div key={f.key}>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
                                    <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={(editForm as any)[f.key] || 0}
                                        onChange={e => setEditForm({ ...editForm, [f.key]: Number(e.target.value) })}
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 text-right text-sm font-semibold text-indigo-600">
                            Total: AED {((editForm.basicSalary || 0) + (editForm.housingAllowance || 0) + (editForm.transportAllowance || 0) + ((editForm as any).workAllowance || 0) + ((editForm as any).trainingAllowance || 0) + (editForm.otherAllowances || 0)).toLocaleString()}
                        </div>
                    </fieldset>

                    {/* Incentive Criteria */}
                    <fieldset className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                        <legend className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-2">Incentive Criteria & Additional Allowances</legend>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Monthly Responsibility Allowance (AED)</label>
                                <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={(editForm as any).monthlyAdditionalResponsibilityAllowance || 0}
                                    onChange={e => setEditForm({ ...editForm, monthlyAdditionalResponsibilityAllowance: Number(e.target.value) })} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Incentive Based On</label>
                                <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={(editForm as any).incentiveBasis || ''}
                                    onChange={e => setEditForm({ ...editForm, incentiveBasis: e.target.value as any })}>
                                    <option value="">Select...</option>
                                    <option value="Income">Income</option>
                                    <option value="Profit">Profit</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Payout Timing</label>
                                <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={(editForm as any).incentivePayoutTiming || ''}
                                    onChange={e => setEditForm({ ...editForm, incentivePayoutTiming: e.target.value as any })}>
                                    <option value="">Select...</option>
                                    <option value="Current Month">Current Month (paid with current salary)</option>
                                    <option value="Following Month">Following Month (paid with next salary)</option>
                                </select>
                            </div>
                        </div>

                        {/* Incentive Slabs */}
                        <div className="border-t border-gray-200 dark:border-gray-600 pt-3 mt-2">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Incentive Slabs</p>
                                <button type="button"
                                    className="text-xs bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700"
                                    onClick={() => {
                                        const slabs = [...((editForm as any).incentiveSlabs || [])];
                                        slabs.push({ label: `Slab ${slabs.length + 1}`, targetAmount: 0, percentage: 0 });
                                        setEditForm({ ...editForm, incentiveSlabs: slabs as any });
                                    }}>
                                    + Add Slab
                                </button>
                            </div>
                            {((editForm as any).incentiveSlabs || []).length > 0 ? (
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-700">
                                        <tr>
                                            <th className="text-left p-2 text-xs font-medium text-gray-500">Label</th>
                                            <th className="text-left p-2 text-xs font-medium text-gray-500">Target (AED)</th>
                                            <th className="text-left p-2 text-xs font-medium text-gray-500">Incentive %</th>
                                            <th className="text-center p-2 text-xs font-medium text-gray-500">Remove</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {((editForm as any).incentiveSlabs || []).map((slab: any, idx: number) => (
                                            <tr key={idx}>
                                                <td className="p-2">
                                                    <input className="w-full p-1.5 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
                                                        value={slab.label}
                                                        onChange={e => {
                                                            const slabs = [...(editForm as any).incentiveSlabs];
                                                            slabs[idx] = { ...slabs[idx], label: e.target.value };
                                                            setEditForm({ ...editForm, incentiveSlabs: slabs as any });
                                                        }} />
                                                </td>
                                                <td className="p-2">
                                                    <input type="number" min="0" className="w-full p-1.5 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
                                                        value={slab.targetAmount}
                                                        onChange={e => {
                                                            const slabs = [...(editForm as any).incentiveSlabs];
                                                            slabs[idx] = { ...slabs[idx], targetAmount: Number(e.target.value) };
                                                            setEditForm({ ...editForm, incentiveSlabs: slabs as any });
                                                        }} />
                                                </td>
                                                <td className="p-2">
                                                    <div className="flex items-center gap-1">
                                                        <input type="number" min="0" max="100" step="0.5" className="w-full p-1.5 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
                                                            value={slab.percentage}
                                                            onChange={e => {
                                                                const slabs = [...(editForm as any).incentiveSlabs];
                                                                slabs[idx] = { ...slabs[idx], percentage: Number(e.target.value) };
                                                                setEditForm({ ...editForm, incentiveSlabs: slabs as any });
                                                            }} />
                                                        <span className="text-gray-400 text-xs">%</span>
                                                    </div>
                                                </td>
                                                <td className="p-2 text-center">
                                                    <button type="button" className="text-red-500 hover:text-red-700 text-xs"
                                                        onClick={() => {
                                                            const slabs = [...(editForm as any).incentiveSlabs];
                                                            slabs.splice(idx, 1);
                                                            setEditForm({ ...editForm, incentiveSlabs: slabs as any });
                                                        }}>✗</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="text-xs text-gray-400 text-center py-3">No slabs configured. Click &quot;+ Add Slab&quot; to add incentive tiers.</p>
                            )}
                        </div>

                        {/* Package Sales Incentive Slabs */}
                        <div className="border-t border-gray-200 dark:border-gray-600 pt-3 mt-2">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Package Sales Incentive Slabs</p>
                                <button type="button"
                                    className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                                    onClick={() => {
                                        const slabs = [...((editForm as any).packageSalesIncentiveSlabs || [])];
                                        slabs.push({ label: `Tier ${slabs.length + 1}`, targetAmount: 0, percentage: 0 });
                                        setEditForm({ ...editForm, packageSalesIncentiveSlabs: slabs as any });
                                    }}>
                                    + Add Tier
                                </button>
                            </div>
                            {((editForm as any).packageSalesIncentiveSlabs || []).length > 0 ? (
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-700">
                                        <tr>
                                            <th className="text-left p-2 text-xs font-medium text-gray-500">Label</th>
                                            <th className="text-left p-2 text-xs font-medium text-gray-500">Sales Target (AED)</th>
                                            <th className="text-left p-2 text-xs font-medium text-gray-500">Incentive %</th>
                                            <th className="text-center p-2 text-xs font-medium text-gray-500">Remove</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {((editForm as any).packageSalesIncentiveSlabs || []).map((slab: any, idx: number) => (
                                            <tr key={idx}>
                                                <td className="p-2">
                                                    <input className="w-full p-1.5 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
                                                        value={slab.label} onChange={e => {
                                                            const s = [...(editForm as any).packageSalesIncentiveSlabs]; s[idx] = { ...s[idx], label: e.target.value };
                                                            setEditForm({ ...editForm, packageSalesIncentiveSlabs: s as any });
                                                        }} />
                                                </td>
                                                <td className="p-2">
                                                    <input type="number" min="0" className="w-full p-1.5 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
                                                        value={slab.targetAmount} onChange={e => {
                                                            const s = [...(editForm as any).packageSalesIncentiveSlabs]; s[idx] = { ...s[idx], targetAmount: Number(e.target.value) };
                                                            setEditForm({ ...editForm, packageSalesIncentiveSlabs: s as any });
                                                        }} />
                                                </td>
                                                <td className="p-2">
                                                    <div className="flex items-center gap-1">
                                                        <input type="number" min="0" max="100" step="0.5" className="w-full p-1.5 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
                                                            value={slab.percentage} onChange={e => {
                                                                const s = [...(editForm as any).packageSalesIncentiveSlabs]; s[idx] = { ...s[idx], percentage: Number(e.target.value) };
                                                                setEditForm({ ...editForm, packageSalesIncentiveSlabs: s as any });
                                                            }} />
                                                        <span className="text-gray-400 text-xs">%</span>
                                                    </div>
                                                </td>
                                                <td className="p-2 text-center">
                                                    <button type="button" className="text-red-500 hover:text-red-700 text-xs" onClick={() => {
                                                        const s = [...(editForm as any).packageSalesIncentiveSlabs]; s.splice(idx, 1);
                                                        setEditForm({ ...editForm, packageSalesIncentiveSlabs: s as any });
                                                    }}>✗</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="text-xs text-gray-400 text-center py-2">No package sales tiers configured.</p>
                            )}
                        </div>

                        {/* Referral Incentive Slabs */}
                        <div className="border-t border-gray-200 dark:border-gray-600 pt-3 mt-2">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Referral Incentive Slabs</p>
                                <button type="button"
                                    className="text-xs bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700"
                                    onClick={() => {
                                        const slabs = [...((editForm as any).referralIncentiveSlabs || [])];
                                        slabs.push({ label: `Tier ${slabs.length + 1}`, targetAmount: 0, percentage: 0 });
                                        setEditForm({ ...editForm, referralIncentiveSlabs: slabs as any });
                                    }}>
                                    + Add Tier
                                </button>
                            </div>
                            {((editForm as any).referralIncentiveSlabs || []).length > 0 ? (
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-700">
                                        <tr>
                                            <th className="text-left p-2 text-xs font-medium text-gray-500">Label</th>
                                            <th className="text-left p-2 text-xs font-medium text-gray-500">Referral Target (count)</th>
                                            <th className="text-left p-2 text-xs font-medium text-gray-500">Incentive %</th>
                                            <th className="text-center p-2 text-xs font-medium text-gray-500">Remove</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {((editForm as any).referralIncentiveSlabs || []).map((slab: any, idx: number) => (
                                            <tr key={idx}>
                                                <td className="p-2">
                                                    <input className="w-full p-1.5 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
                                                        value={slab.label} onChange={e => {
                                                            const s = [...(editForm as any).referralIncentiveSlabs]; s[idx] = { ...s[idx], label: e.target.value };
                                                            setEditForm({ ...editForm, referralIncentiveSlabs: s as any });
                                                        }} />
                                                </td>
                                                <td className="p-2">
                                                    <input type="number" min="0" className="w-full p-1.5 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
                                                        value={slab.targetAmount} onChange={e => {
                                                            const s = [...(editForm as any).referralIncentiveSlabs]; s[idx] = { ...s[idx], targetAmount: Number(e.target.value) };
                                                            setEditForm({ ...editForm, referralIncentiveSlabs: s as any });
                                                        }} />
                                                </td>
                                                <td className="p-2">
                                                    <div className="flex items-center gap-1">
                                                        <input type="number" min="0" max="100" step="0.5" className="w-full p-1.5 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
                                                            value={slab.percentage} onChange={e => {
                                                                const s = [...(editForm as any).referralIncentiveSlabs]; s[idx] = { ...s[idx], percentage: Number(e.target.value) };
                                                                setEditForm({ ...editForm, referralIncentiveSlabs: s as any });
                                                            }} />
                                                        <span className="text-gray-400 text-xs">%</span>
                                                    </div>
                                                </td>
                                                <td className="p-2 text-center">
                                                    <button type="button" className="text-red-500 hover:text-red-700 text-xs" onClick={() => {
                                                        const s = [...(editForm as any).referralIncentiveSlabs]; s.splice(idx, 1);
                                                        setEditForm({ ...editForm, referralIncentiveSlabs: s as any });
                                                    }}>✗</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="text-xs text-gray-400 text-center py-2">No referral tiers configured.</p>
                            )}
                        </div>

                        {/* Review Threshold & Penalty Rules */}
                        <div className="border-t border-gray-200 dark:border-gray-600 pt-3 mt-2">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Client Review & Penalty Rules</p>
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 mb-3">
                                <p className="text-xs text-amber-700 dark:text-amber-300">
                                    ⚠️ If the client review percentage falls below the threshold for consecutive months, the selected incentive types will <strong>not</strong> be processed.
                                </p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Min. Client Review %</label>
                                    <div className="flex items-center gap-1">
                                        <input type="number" min="0" max="100" step="1" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                            value={(editForm as any).reviewThresholdPercent || ''}
                                            onChange={e => setEditForm({ ...editForm, reviewThresholdPercent: Number(e.target.value) as any })} />
                                        <span className="text-gray-400 text-sm">%</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Penalty After (consecutive months)</label>
                                    <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={(editForm as any).reviewPenaltyMonths || ''}
                                        onChange={e => setEditForm({ ...editForm, reviewPenaltyMonths: Number(e.target.value) as any })}>
                                        <option value="">Select...</option>
                                        <option value="2">2 Months</option>
                                        <option value="3">3 Months</option>
                                        <option value="4">4 Months</option>
                                        <option value="5">5 Months</option>
                                        <option value="6">6 Months</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Incentive Types Blocked on Penalty</label>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {['Income/Profit', 'Package Sales', 'Referral'].map(t => {
                                            const types = (editForm as any).reviewPenaltyTypes || [];
                                            const checked = types.includes(t);
                                            return (
                                                <label key={t} className="flex items-center gap-1 text-xs cursor-pointer">
                                                    <input type="checkbox" checked={checked}
                                                        onChange={() => {
                                                            const updated = checked ? types.filter((x: string) => x !== t) : [...types, t];
                                                            setEditForm({ ...editForm, reviewPenaltyTypes: updated as any });
                                                        }} />
                                                    {t}
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </fieldset>

                    <fieldset className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                        <legend className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-2">Visa & IDs</legend>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {[
                                { label: 'Emirates ID', key: 'emiratesId' },
                                { label: 'EID Expiry', key: 'emiratesIdExpiry', type: 'date' },
                                { label: 'Passport No.', key: 'passportNumber' },
                                { label: 'Passport Expiry', key: 'passportExpiry', type: 'date' },
                            ].map(f => (
                                <div key={f.key}>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
                                    <input type={f.type || 'text'}
                                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={(editForm as any)[f.key] || ''}
                                        onChange={e => setEditForm({ ...editForm, [f.key]: e.target.value })}
                                    />
                                </div>
                            ))}

                            <div className="col-span-3 border-t border-gray-200 dark:border-gray-600 pt-3 mt-1">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Visa Details</p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Visa Status</label>
                                <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={(editForm as any).visaStatus || ''}
                                    onChange={e => setEditForm({ ...editForm, visaStatus: e.target.value })}>
                                    <option value="">Select...</option>
                                    <option value="On Process">On Process</option>
                                    <option value="Valid">Valid</option>
                                    <option value="Expired">Expired</option>
                                </select>
                            </div>
                            {[
                                { label: 'Visa Expiry', key: 'visaExpiryDate', type: 'date' },
                                { label: 'Visa Number', key: 'visaNumber' },
                            ].map(f => (
                                <div key={f.key}>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
                                    <input type={f.type || 'text'}
                                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={(editForm as any)[f.key] || ''}
                                        onChange={e => setEditForm({ ...editForm, [f.key]: e.target.value })}
                                    />
                                </div>
                            ))}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Visa Type</label>
                                <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={(editForm as any).visaType || ''}
                                    onChange={e => setEditForm({ ...editForm, visaType: e.target.value })}>
                                    <option value="">Select...</option>
                                    <option value="Employment">Employment</option>
                                    <option value="Resident">Resident</option>
                                    <option value="Tourist">Tourist</option>
                                    <option value="War Visa">War Visa</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Visa Issuing Branch</label>
                                <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={(editForm as any).visaIssuingBranch || ''}
                                    onChange={e => setEditForm({ ...editForm, visaIssuingBranch: e.target.value })}>
                                    <option value="">Select...</option>
                                    {VISA_ISSUING_BRANCHES.map(b => (
                                        <option key={b} value={b}>{b}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-span-3 border-t border-gray-200 dark:border-gray-600 pt-3 mt-1">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Work Permit / Labor Card</p>
                            </div>
                            {[
                                { label: 'Work Permit #', key: 'workPermitNumber' },
                                { label: 'Work Permit Expiry', key: 'workPermitExpiry', type: 'date' },
                                { label: 'Work Permit Issue Date', key: 'workPermitIssueDate', type: 'date' },
                                { label: 'LC Designation', key: 'lcDesignation' },
                            ].map(f => (
                                <div key={f.key}>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
                                    <input type={f.type || 'text'}
                                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={(editForm as any)[f.key] || ''}
                                        onChange={e => setEditForm({ ...editForm, [f.key]: e.target.value })}
                                    />
                                </div>
                            ))}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">LC Personal #</label>
                                <input type="text" maxLength={14} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={(editForm as any).lcPersonalNumber || ''}
                                    onChange={e => {
                                        const val = e.target.value.replace(/[^0-9]/g, '').substring(0, 14);
                                        setEditForm({ ...editForm, lcPersonalNumber: val });
                                    }}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Labor Card Status</label>
                                <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={(editForm as any).laborCardStatus || 'Not Started'}
                                    onChange={e => setEditForm({ ...editForm, laborCardStatus: e.target.value })}>
                                    {LABOR_CARD_STATUSES.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </fieldset>

                    {/* Medical Insurance */}
                    <fieldset className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                        <legend className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-2">Medical Insurance</legend>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {[
                                { label: 'Insurance Provider', key: 'medicalInsuranceProvider' },
                                { label: 'Policy Number', key: 'medicalInsurancePolicyNumber' },
                                { label: 'Expiry Date', key: 'medicalInsuranceExpiry', type: 'date' },
                                { label: 'Category', key: 'medicalInsuranceCategory' },
                            ].map(f => (
                                <div key={f.key}>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
                                    <input type={f.type || 'text'}
                                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={(editForm as any)[f.key] || ''}
                                        onChange={e => setEditForm({ ...editForm, [f.key]: e.target.value })}
                                    />
                                </div>
                            ))}
                        </div>
                    </fieldset>

                    {/* DHA & BLS License */}
                    <fieldset className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                        <legend className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-2">DHA & BLS License (Clinical Staff)</legend>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {[
                                { label: 'DHA License Number', key: 'dhaLicenseNumber' },
                                { label: 'DHA License Expiry', key: 'dhaLicenseExpiry', type: 'date' },
                                { label: 'BLS Certificate Number', key: 'blsCertificateNumber' },
                                { label: 'BLS Certificate Expiry', key: 'blsCertificateExpiry', type: 'date' },
                            ].map(f => (
                                <div key={f.key}>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
                                    <input type={f.type || 'text'}
                                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={(editForm as any)[f.key] || ''}
                                        onChange={e => setEditForm({ ...editForm, [f.key]: e.target.value })}
                                    />
                                </div>
                            ))}
                        </div>
                    </fieldset>

                    <div className="flex justify-end">
                        <button onClick={handleSave} disabled={saving}
                            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 font-medium">
                            <Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            )}

            {/* ═══ DOCUMENTS TAB ═══ */}
            {activeTab === 'documents' && (() => {
                const selectedCatInfo = DOCUMENT_CATEGORIES.find(c => c.key === uploadCategory)!;
                const toggleCategory = (cat: DocumentCategory) => {
                    setExpandedCategories(prev => {
                        const next = new Set(prev);
                        next.has(cat) ? next.delete(cat) : next.add(cat);
                        return next;
                    });
                };
                const catColorMap: Record<string, { bg: string; text: string; border: string; badge: string }> = {
                    blue: { bg: 'bg-blue-50 dark:bg-blue-900/10', text: 'text-blue-700', border: 'border-blue-200 dark:border-blue-800', badge: 'bg-blue-100 text-blue-700' },
                    red: { bg: 'bg-red-50 dark:bg-red-900/10', text: 'text-red-700', border: 'border-red-200 dark:border-red-800', badge: 'bg-red-100 text-red-700' },
                    purple: { bg: 'bg-purple-50 dark:bg-purple-900/10', text: 'text-purple-700', border: 'border-purple-200 dark:border-purple-800', badge: 'bg-purple-100 text-purple-700' },
                    amber: { bg: 'bg-amber-50 dark:bg-amber-900/10', text: 'text-amber-700', border: 'border-amber-200 dark:border-amber-800', badge: 'bg-amber-100 text-amber-700' },
                    green: { bg: 'bg-green-50 dark:bg-green-900/10', text: 'text-green-700', border: 'border-green-200 dark:border-green-800', badge: 'bg-green-100 text-green-700' },
                    indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/10', text: 'text-indigo-700', border: 'border-indigo-200 dark:border-indigo-800', badge: 'bg-indigo-100 text-indigo-700' },
                    teal: { bg: 'bg-teal-50 dark:bg-teal-900/10', text: 'text-teal-700', border: 'border-teal-200 dark:border-teal-800', badge: 'bg-teal-100 text-teal-700' },
                    gray: { bg: 'bg-gray-50 dark:bg-gray-800/50', text: 'text-gray-700', border: 'border-gray-200 dark:border-gray-700', badge: 'bg-gray-200 text-gray-700' },
                };
                return (
                    <div className="space-y-6">
                        {/* Upload Form */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <Upload className="w-5 h-5 text-indigo-600" /> Upload Document
                            </h3>
                            <form onSubmit={handleUpload} className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                                        <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                            value={uploadCategory}
                                            onChange={e => {
                                                const cat = e.target.value as DocumentCategory;
                                                setUploadCategory(cat);
                                                const catInfo = DOCUMENT_CATEGORIES.find(c => c.key === cat)!;
                                                setUploadDocType(catInfo.docTypes[0]);
                                            }}>
                                            {DOCUMENT_CATEGORIES.map(c => (
                                                <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Document Type</label>
                                        <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                            value={uploadDocType} onChange={e => setUploadDocType(e.target.value)}>
                                            {selectedCatInfo.docTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">File</label>
                                        <input type="file" className="w-full p-1.5 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                            onChange={e => setUploadFile(e.target.files?.[0] || null)} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {selectedCatInfo.hasExpiry && (
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Expiry Date</label>
                                            <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                                value={uploadExpiry} onChange={e => setUploadExpiry(e.target.value)} />
                                        </div>
                                    )}
                                    {selectedCatInfo.hasIssueDate && (
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Issue Date</label>
                                            <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                                value={uploadIssueDate} onChange={e => setUploadIssueDate(e.target.value)} />
                                        </div>
                                    )}
                                    {selectedCatInfo.hasComment && (
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Comment / Notes</label>
                                            <input type="text" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                                placeholder="Optional notes..."
                                                value={uploadNotes} onChange={e => setUploadNotes(e.target.value)} />
                                        </div>
                                    )}
                                </div>
                                <button type="submit" disabled={!uploadFile || uploading}
                                    className="bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2">
                                    <Upload className="w-4 h-4" />
                                    {uploading ? 'Uploading...' : 'Upload'}
                                </button>
                            </form>
                        </div>

                        {/* Category Accordions */}
                        {DOCUMENT_CATEGORIES.map(cat => {
                            const catDocs = documents.filter(d => d.category === cat.key || cat.docTypes.includes(d.documentType));
                            const isExpanded = expandedCategories.has(cat.key);
                            const colors = catColorMap[cat.color] || catColorMap.gray;
                            const uploadedTypes = new Set(catDocs.map(d => d.documentType));
                            const totalTypes = cat.docTypes.length;
                            const uploadedCount = cat.allowMultiple ? catDocs.length : uploadedTypes.size;

                            return (
                                <div key={cat.key} className={`rounded-xl border ${colors.border} overflow-hidden`}>
                                    {/* Category Header */}
                                    <button
                                        onClick={() => toggleCategory(cat.key)}
                                        className={`w-full flex items-center justify-between p-4 ${colors.bg} hover:opacity-90 transition-opacity`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-lg">{cat.icon}</span>
                                            <span className={`font-semibold ${colors.text}`}>{cat.label}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.badge}`}>
                                                {uploadedCount} / {totalTypes}
                                            </span>
                                        </div>
                                        {isExpanded
                                            ? <ChevronDown className={`w-5 h-5 ${colors.text}`} />
                                            : <ChevronRight className={`w-5 h-5 ${colors.text}`} />
                                        }
                                    </button>

                                    {/* Category Body */}
                                    {isExpanded && (
                                        <div className="p-4 bg-white dark:bg-gray-800">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {cat.docTypes.map(docType => {
                                                    const docs = catDocs.filter(d => d.documentType === docType);
                                                    return (
                                                        <div key={docType} className={`rounded-lg p-3 border ${docs.length > 0
                                                            ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                                                            : 'bg-gray-50 dark:bg-gray-800/50 border-dashed border-gray-300 dark:border-gray-600'
                                                            }`}>
                                                            <div className="flex items-start justify-between mb-1.5">
                                                                <div className="flex items-center gap-2">
                                                                    <FileText className={`w-3.5 h-3.5 ${docs.length > 0 ? colors.text : 'text-gray-400'}`} />
                                                                    <span className="text-xs font-medium text-gray-900 dark:text-white">{docType}</span>
                                                                </div>
                                                                {docs.length > 0 && (
                                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colors.badge}`}>
                                                                        {docs.length}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {docs.length === 0 ? (
                                                                <p className="text-[10px] text-gray-400 italic">Not uploaded</p>
                                                            ) : (
                                                                <div className="space-y-1.5">
                                                                    {docs.map(doc => (
                                                                        <div key={doc.id} className="flex items-center justify-between text-[11px]">
                                                                            <div className="flex-1 min-w-0">
                                                                                <p className="truncate text-gray-700 dark:text-gray-300">{doc.fileName}</p>
                                                                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                                                    <span className="text-gray-400">{(doc.fileSize / 1024).toFixed(0)} KB</span>
                                                                                    {getDocExpiryBadge(doc)}
                                                                                    {doc.issueDate && (
                                                                                        <span className="text-gray-400">Issued: {doc.issueDate}</span>
                                                                                    )}
                                                                                    {doc.notes && (
                                                                                        <span className="text-gray-400 italic truncate max-w-[120px]" title={doc.notes}>{doc.notes}</span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex gap-0.5 ml-1">
                                                                                <a href={doc.blobUrl} target="_blank" className="text-indigo-600 hover:text-indigo-800 p-0.5" title="Download">
                                                                                    <Download className="w-3 h-3" />
                                                                                </a>
                                                                                <button onClick={() => handleDeleteDoc(doc.id)} className="text-red-500 hover:text-red-700 p-0.5" title="Delete">
                                                                                    <Trash2 className="w-3 h-3" />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                );
            })()}

            {/* ═══ PAYROLL & EOS TAB ═══ */}
            {activeTab === 'payroll' && payroll && (
                <div className="space-y-6">
                    {/* Salary Breakdown */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <Briefcase className="w-5 h-5 text-indigo-600" /> Monthly Salary Breakdown
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-7 gap-4">
                            {[
                                { label: 'Basic', value: payroll.salary.basicSalary },
                                { label: 'Housing', value: payroll.salary.housingAllowance },
                                { label: 'Transport', value: payroll.salary.transportAllowance },
                                { label: 'Other', value: payroll.salary.otherAllowances },
                                { label: 'Work', value: payroll.salary.workAllowance || 0 },
                                { label: 'Training', value: payroll.salary.trainingAllowance || 0 },
                                { label: 'Gross Salary', value: payroll.salary.grossSalary, highlight: true },
                            ].map(item => (
                                <div key={item.label} className={`p-3 rounded-lg ${item.highlight ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                                    <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                                    <p className={`text-lg font-bold ${item.highlight ? 'text-indigo-600' : 'text-gray-900 dark:text-white'}`}>
                                        {item.value.toLocaleString()}
                                    </p>
                                </div>
                            ))}
                        </div>
                        <p className="mt-2 text-xs text-gray-500">Daily rate: AED {payroll.salary.dailyRate.toLocaleString()}</p>
                    </div>

                    {/* Monthly Payslip Generator */}
                    <PayslipGenerator employee={employee} />

                    {/* Gratuity */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Gratuity (UAE Labor Law)</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
                            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                                <p className="text-xs text-gray-500 mb-1">Years of Service</p>
                                <p className="text-lg font-bold text-gray-900 dark:text-white">{payroll.gratuity.yearsOfService}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                                <p className="text-xs text-gray-500 mb-1">Daily Basic</p>
                                <p className="text-lg font-bold text-gray-900 dark:text-white">{payroll.gratuity.dailyBasic.toLocaleString()}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 col-span-2">
                                <p className="text-xs text-green-600 mb-1">Gratuity Amount</p>
                                <p className="text-2xl font-bold text-green-700">AED {payroll.gratuity.gratuityAmount.toLocaleString()}</p>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500">{payroll.gratuity.breakdown}</p>
                    </div>

                    {/* End of Service Calculator */}
                    {dynamicEOS && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                                <h3 className="font-semibold text-gray-900 dark:text-white">End of Service Calculator</h3>
                                <button onClick={printEOS} className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-200 text-sm font-medium flex items-center gap-2 transition-colors">
                                    <Printer className="w-4 h-4" /> Print Final Settlement
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Termination Type</label>
                                    <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={terminationType}
                                        onChange={e => setTerminationType(e.target.value as TerminationType)}>
                                        <option value="EMPLOYER_TERMINATION">Employer Termination</option>
                                        <option value="RESIGNATION">Resignation</option>
                                        <option value="END_OF_CONTRACT">End of Contract</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Pending Salary (AED)</label>
                                    <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={eosPendingSalary} onChange={e => setEosPendingSalary(Number(e.target.value))} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Early Notice Deduction (AED)</label>
                                    <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={eosEarlyNoticeDeduction} onChange={e => setEosEarlyNoticeDeduction(Number(e.target.value))} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Absent in Notice Period (AED)</label>
                                    <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={eosAbsentInNoticePeriod} onChange={e => setEosAbsentInNoticePeriod(Number(e.target.value))} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Uniform Expenses (AED)</label>
                                    <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={eosUniformExpenses} onChange={e => setEosUniformExpenses(Number(e.target.value))} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Other Deductions (AED)</label>
                                    <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={eosOtherDeductions} onChange={e => setEosOtherDeductions(Number(e.target.value))} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
                                    <p className="text-xs text-gray-500 mb-1">Total Deductions</p>
                                    <p className="text-xl font-bold text-red-600">AED {dynamicEOS.totalDeductions.toLocaleString()}</p>
                                </div>
                                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
                                    <p className="text-xs text-gray-500 mb-1">Full Gratuity</p>
                                    <p className="text-xl font-bold text-gray-900 dark:text-white">AED {payroll.gratuity.gratuityAmount.toLocaleString()}</p>
                                </div>
                                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
                                    <p className="text-xs text-gray-500 mb-1">Adjusted Gratuity</p>
                                    <p className="text-xl font-bold text-gray-900 dark:text-white">AED {dynamicEOS.gratuity.gratuityAmount.toLocaleString()}</p>
                                </div>
                                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
                                    <p className="text-xs text-gray-500 mb-1">Leave Encashment</p>
                                    <p className="text-xl font-bold text-gray-900 dark:text-white">AED {dynamicEOS.leaveEncashment.toLocaleString()}</p>
                                </div>
                                <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-300 dark:border-indigo-700">
                                    <p className="text-xs text-indigo-600 mb-1">Total End of Service</p>
                                    <p className="text-2xl font-bold text-indigo-700">AED {dynamicEOS.totalEOS.toLocaleString()}</p>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-4 text-center">
                                Formula: (Leave Encashment + Full/Adjusted Gratuity + Pending Salary) - (Early Notice + Absent in Notice + Uniform + Other Deductions)
                            </p>

                            {/* Hidden Print Container */}
                            <div id="eos-print" style={{ display: 'none' }}>
                                <div className="header">
                                    <h1>First Medical Center LLC</h1>
                                    <p className="subtitle">END OF SERVICE / FINAL SETTLEMENT PAYSLIP</p>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                                    <div>
                                        <p><strong>Employee Name:</strong> {employee.firstName} {employee.lastName}</p>
                                        <p><strong>Employee Code:</strong> {employee.employeeCode || '-'}</p>
                                        <p><strong>Designation:</strong> {employee.designation || '-'}</p>
                                    </div>
                                    <div>
                                        <p><strong>Department:</strong> {employee.department || '-'}</p>
                                        <p><strong>Date of Joining:</strong> {employee.joiningDate ? new Date(employee.joiningDate).toLocaleDateString() : '-'}</p>
                                        <p><strong>Termination Type:</strong> {terminationType.replace(/_/g, ' ')}</p>
                                    </div>
                                </div>

                                <h2>Earnings & Entitlements</h2>
                                <table>
                                    <tbody>
                                        <tr><th>Leave Encashment</th><td className="right">AED {dynamicEOS.leaveEncashment.toLocaleString()}</td></tr>
                                        <tr><th>Gratuity Accrued</th><td className="right">AED {payroll.gratuity.gratuityAmount.toLocaleString()}</td></tr>
                                        <tr><th>Pending Salary</th><td className="right">AED {dynamicEOS.pendingSalary.toLocaleString()}</td></tr>
                                    </tbody>
                                </table>

                                <h2>Deductions & Adjustments</h2>
                                <table>
                                    <tbody>
                                        <tr><th>Gratuity Adjustment (Resignation Rules)</th><td className="right red-text">AED {(payroll.gratuity.gratuityAmount - dynamicEOS.gratuity.gratuityAmount).toLocaleString()}</td></tr>
                                        <tr><th>Early Notice Deduction</th><td className="right red-text">AED {dynamicEOS.earlyNoticeDeduction.toLocaleString()}</td></tr>
                                        <tr><th>Absent in Notice Period</th><td className="right red-text">AED {dynamicEOS.absentInNoticePeriod.toLocaleString()}</td></tr>
                                        <tr><th>Uniform Expenses / Damages</th><td className="right red-text">AED {dynamicEOS.uniformExpenses.toLocaleString()}</td></tr>
                                        <tr><th>Other Deductions</th><td className="right red-text">AED {dynamicEOS.otherDeductions.toLocaleString()}</td></tr>
                                    </tbody>
                                </table>

                                <table>
                                    <tbody>
                                        <tr className="total"><th>Total Final Settlement Payable</th><td className="right">AED {dynamicEOS.totalEOS.toLocaleString()}</td></tr>
                                    </tbody>
                                </table>

                                <div className="signature-box">
                                    <div>
                                        <div className="sig-line">Employer Signature & Stamp</div>
                                    </div>
                                    <div>
                                        <div className="sig-line">Employee Signature</div>
                                        <p style={{ marginTop: '10px', fontSize: '11px', color: '#666', textAlign: 'center', width: '250px' }}>
                                            I acknowledge receipt of all my dues and final settlement in full, leaving no pending claims.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═══ LEAVE TAB ═══ */}
            {activeTab === 'leave' && payroll && (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <CalendarDays className="w-5 h-5 text-indigo-600" /> Leave Balance
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-center">
                                <p className="text-xs text-gray-500 mb-1">Annual Entitlement</p>
                                <p className="text-3xl font-bold text-gray-900 dark:text-white">{payroll.leaveBalance.annualEntitlement}</p>
                                <p className="text-xs text-gray-400">days</p>
                            </div>
                            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-center">
                                <p className="text-xs text-amber-600 mb-1">Annual Leave Taken</p>
                                <p className="text-3xl font-bold text-amber-700">{payroll.leaveBalance.leavesTaken}</p>
                                <p className="text-xs text-amber-500">days</p>
                            </div>
                            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-center">
                                <p className="text-xs text-red-600 mb-1">Sick Leave Taken</p>
                                <p className="text-3xl font-bold text-red-700">{payroll.leaveBalance.sickLeavesTaken}</p>
                                <p className="text-xs text-red-500">days</p>
                            </div>
                            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700 text-center">
                                <p className="text-xs text-green-600 mb-1">Remaining</p>
                                <p className="text-3xl font-bold text-green-700">{payroll.leaveBalance.remainingAnnualLeave}</p>
                                <p className="text-xs text-green-500">days</p>
                            </div>
                        </div>
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
                            <p className="text-sm text-indigo-700 dark:text-indigo-400">
                                <strong>Leave Encashment Value (from Basic Salary):</strong> AED {payroll.leaveBalance.leaveEncashmentAmount.toLocaleString()}
                                <span className="text-xs text-indigo-500 ml-2">
                                    ({payroll.leaveBalance.remainingAnnualLeave} days × AED {(payroll.salary.basicSalary / 30).toFixed(2)}/day basic)
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* Update leave directly */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Update Leave Records</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Annual Leave Entitlement</label>
                                <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={editForm.annualLeaveEntitlement || 30}
                                    onChange={e => setEditForm({ ...editForm, annualLeaveEntitlement: Number(e.target.value) })} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Annual Leave Taken</label>
                                <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={editForm.leavesTaken || 0}
                                    onChange={e => setEditForm({ ...editForm, leavesTaken: Number(e.target.value) })} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Sick Leave Taken</label>
                                <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={editForm.sickLeavesTaken || 0}
                                    onChange={e => setEditForm({ ...editForm, sickLeavesTaken: Number(e.target.value) })} />
                            </div>
                        </div>
                        <div className="flex justify-end mt-4">
                            <button onClick={async () => {
                                await handleSave();
                                loadPayroll();
                            }} disabled={saving}
                                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2">
                                <Save className="w-4 h-4" />{saving ? 'Saving...' : 'Update Leave'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ LEAVE TAB ═══ */}
            {activeTab === 'leave' && (
                <LeaveTab employeeId={employeeId} employee={employee} />
            )}
        </div>
    );
}

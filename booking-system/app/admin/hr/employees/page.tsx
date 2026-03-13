'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Plus, Search, Filter, ChevronRight, Edit2, Trash2,
    UserPlus, X
} from 'lucide-react';
import type { Employee, EmploymentType, EmployeeStatus, Gender, MaritalStatus } from '@/lib/hr-store';
import { WORKPLACES, VISA_ISSUING_BRANCHES, LABOR_CARD_STATUSES, DEPARTMENTS } from '@/lib/hr-store';

interface EmployeeFormData {
    firstName: string;
    middleName: string;
    lastName: string;
    email: string;
    phone: string;
    whatsappNumber: string;
    nationality: string;
    dateOfBirth: string;
    gender: Gender;
    maritalStatus: MaritalStatus;
    employeeNumber: string;
    religion: string;
    ibanNumber: string;
    designation: string;
    department: string;
    clinicId: string;
    workplaceIds: string[];
    joiningDate: string;
    contractEndDate: string;
    employmentType: EmploymentType;
    status: EmployeeStatus;
    weeklyOffDays: string[];
    noticePeriod: string;
    probationPeriod: string;
    penaltyTrainingExpenses: number;
    resignationBanDuration: string;
    penaltyBanDetails: string;
    basicSalary: number;
    housingAllowance: number;
    transportAllowance: number;
    workAllowance: number;
    trainingAllowance: number;
    otherAllowances: number;
    annualLeaveEntitlement: number;
    visaStatus: string;
    visaExpiryDate: string;
    visaNumber: string;
    visaType: string;
    visaIssuingBranch: string;
    workPermitNumber: string;
    workPermitExpiry: string;
    workPermitStatus: string;
    workPermitIssueDate: string;
    lcPersonalNumber: string;
    lcDesignation: string;
    emiratesId: string;
    emiratesIdExpiry: string;
    passportNumber: string;
    passportExpiry: string;
    medicalInsuranceProvider: string;
    medicalInsurancePolicyNumber: string;
    medicalInsuranceExpiry: string;
    medicalInsuranceCategory: string;
    dhaLicenseNumber: string;
    dhaLicenseExpiry: string;
    blsCertificateNumber: string;
    blsCertificateExpiry: string;
}

const emptyForm: EmployeeFormData = {
    firstName: '', middleName: '', lastName: '', email: '', phone: '', whatsappNumber: '', nationality: '',
    dateOfBirth: '', gender: 'MALE', maritalStatus: 'SINGLE', employeeNumber: '', religion: '', ibanNumber: '', designation: '', department: '',
    clinicId: 'clinic-1', workplaceIds: ['clinic-1'],
    joiningDate: new Date().toISOString().split('T')[0],
    contractEndDate: '', employmentType: 'FULL_TIME', status: 'ACTIVE',
    weeklyOffDays: ['Friday'], noticePeriod: '1 Month', probationPeriod: '3 Months',
    penaltyTrainingExpenses: 0, resignationBanDuration: '', penaltyBanDetails: '',
    basicSalary: 0, housingAllowance: 0, transportAllowance: 0,
    workAllowance: 0, trainingAllowance: 0,
    otherAllowances: 0, annualLeaveEntitlement: 30, visaStatus: '',
    visaExpiryDate: '', visaNumber: '', visaType: '', visaIssuingBranch: '',
    workPermitNumber: '', workPermitExpiry: '', workPermitStatus: 'Not Started',
    workPermitIssueDate: '', lcPersonalNumber: '', lcDesignation: '',
    emiratesId: '', emiratesIdExpiry: '',
    passportNumber: '', passportExpiry: '',
    medicalInsuranceProvider: '', medicalInsurancePolicyNumber: '',
    medicalInsuranceExpiry: '', medicalInsuranceCategory: '',
    dhaLicenseNumber: '', dhaLicenseExpiry: '',
    blsCertificateNumber: '', blsCertificateExpiry: '',
};

export default function EmployeesPage() {
    const router = useRouter();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState<EmployeeFormData>({ ...emptyForm });

    useEffect(() => {
        loadEmployees();
    }, [search, statusFilter]);

    const loadEmployees = async () => {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (statusFilter) params.set('status', statusFilter);
        try {
            const res = await fetch(`/api/admin/hr/employees?${params}`);
            if (res.ok) setEmployees(await res.json());
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/admin/hr/employees', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, workplaceId: form.workplaceIds[0] || 'clinic-1' }),
            });
            if (res.ok) {
                setShowModal(false);
                setForm({ ...emptyForm });
                loadEmployees();
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this employee?')) return;
        await fetch(`/api/admin/hr/employees/${id}`, { method: 'DELETE' });
        loadEmployees();
    };

    const getStatusBadge = (status: EmployeeStatus) => {
        const map: Record<string, string> = {
            ACTIVE: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
            ON_LEAVE: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
            TERMINATED: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
            RESIGNED: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
        };
        return map[status] || '';
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Employees</h1>
                    <p className="text-gray-600 dark:text-gray-400">Manage employee profiles and records</p>
                </div>
                <button
                    onClick={() => { setForm({ ...emptyForm }); setShowModal(true); }}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                >
                    <UserPlus className="w-4 h-4" />
                    Add Employee
                </button>
            </header>

            {/* Search & Filter */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name, code, email, designation..."
                        className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                        className="pl-10 pr-8 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 appearance-none"
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                    >
                        <option value="">All Status</option>
                        <option value="ACTIVE">Active</option>
                        <option value="ON_LEAVE">On Leave</option>
                        <option value="TERMINATED">Terminated</option>
                        <option value="RESIGNED">Resigned</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
                </div>
            ) : employees.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center shadow-sm">
                    <p className="text-gray-500">No employees found.</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 uppercase">
                                <th className="px-6 py-3">Employee</th>
                                <th className="px-6 py-3">Code</th>
                                <th className="px-6 py-3">Designation</th>
                                <th className="px-6 py-3">Place of Work</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3">Joining Date</th>
                                <th className="px-6 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {employees.map(emp => (
                                <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                                    onClick={() => router.push(`/admin/hr/employees/${emp.id}`)}
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 font-semibold text-sm">
                                                {emp.firstName[0]}{emp.lastName[0]}
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900 dark:text-white">{emp.firstName} {emp.middleName ? `${emp.middleName} ` : ''}{emp.lastName}</div>
                                                <div className="text-xs text-gray-500">{emp.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-mono text-gray-600 dark:text-gray-400">{emp.employeeCode}</td>
                                    <td className="px-6 py-4 text-sm">{emp.designation}</td>
                                    <td className="px-6 py-4 text-sm">{(emp.workplaceIds?.length ? emp.workplaceIds : [emp.workplaceId]).map(id => WORKPLACES.find(w => w.id === id)?.name).filter(Boolean).join(', ') || emp.workplaceName || emp.department}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(emp.status)}`}>
                                            {emp.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{new Date(emp.joiningDate).toLocaleDateString()}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                            <Link href={`/admin/hr/employees/${emp.id}`}
                                                className="text-indigo-600 hover:text-indigo-800 p-1" title="View Details">
                                                <ChevronRight className="w-4 h-4" />
                                            </Link>
                                            <button onClick={() => handleDelete(emp.id)}
                                                className="text-red-600 hover:text-red-800 p-1" title="Delete">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add Employee Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-start justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-3xl p-6 shadow-xl my-8">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add New Employee</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleAdd} className="space-y-6">
                            {/* Personal Info */}
                            <fieldset className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                <legend className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-2">Personal Information</legend>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">First Name *</label>
                                        <input required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Middle Name</label>
                                        <input className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.middleName} onChange={e => setForm({ ...form, middleName: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Last Name *</label>
                                        <input required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Email</label>
                                        <input type="email" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Phone</label>
                                        <input className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">WhatsApp Number</label>
                                        <input className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" placeholder="+971..."
                                            value={form.whatsappNumber} onChange={e => setForm({ ...form, whatsappNumber: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Date of Birth</label>
                                        <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Gender</label>
                                        <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value as Gender })}>
                                            <option value="MALE">Male</option>
                                            <option value="FEMALE">Female</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Marital Status</label>
                                        <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.maritalStatus} onChange={e => setForm({ ...form, maritalStatus: e.target.value as MaritalStatus })}>
                                            <option value="SINGLE">Single</option>
                                            <option value="MARRIED">Married</option>
                                            <option value="DIVORCED">Divorced</option>
                                            <option value="WIDOWED">Widowed</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Employee Number</label>
                                        <input className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" placeholder="EMP-2026-001"
                                            value={form.employeeNumber} onChange={e => setForm({ ...form, employeeNumber: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Religion</label>
                                        <input className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.religion} onChange={e => setForm({ ...form, religion: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">IBAN Number</label>
                                        <input className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" placeholder="AE07..."
                                            value={form.ibanNumber} onChange={e => setForm({ ...form, ibanNumber: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Nationality</label>
                                        <input className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.nationality} onChange={e => setForm({ ...form, nationality: e.target.value })} />
                                    </div>
                                </div>
                            </fieldset>

                            {/* Employment */}
                            <fieldset className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                <legend className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-2">Employment Details</legend>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Designation *</label>
                                        <input required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Business Department</label>
                                        <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}>
                                            <option value="">Select business department...</option>
                                            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Joining Date *</label>
                                        <input type="date" required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.joiningDate} onChange={e => setForm({ ...form, joiningDate: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Contract End Date</label>
                                        <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.contractEndDate} onChange={e => setForm({ ...form, contractEndDate: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Employment Type</label>
                                        <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.employmentType} onChange={e => setForm({ ...form, employmentType: e.target.value as EmploymentType })}>
                                            <option value="FULL_TIME">Full Time</option>
                                            <option value="PART_TIME">Part Time</option>
                                            <option value="CONTRACT">Contract</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Status</label>
                                        <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.status} onChange={e => setForm({ ...form, status: e.target.value as EmployeeStatus })}>
                                            <option value="ACTIVE">Active</option>
                                            <option value="ON_LEAVE">On Leave</option>
                                            <option value="TERMINATED">Terminated</option>
                                            <option value="RESIGNED">Resigned</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Place of Work *</label>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {WORKPLACES.map(w => {
                                                const checked = form.workplaceIds.includes(w.id);
                                                return (
                                                    <label key={w.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors ${
                                                        checked
                                                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-600 dark:text-indigo-300'
                                                            : 'bg-gray-50 border-gray-200 text-gray-600 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                                                    }`}>
                                                        <input type="checkbox" className="w-3.5 h-3.5 rounded" checked={checked}
                                                            onChange={() => {
                                                                const updated = checked
                                                                    ? form.workplaceIds.filter(x => x !== w.id)
                                                                    : [...form.workplaceIds, w.id];
                                                                setForm({ ...form, workplaceIds: updated });
                                                            }} />
                                                        {w.name}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1">Select one or more branches</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Weekly Off Days</label>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {['Friday', 'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'].map(d => {
                                                const checked = form.weeklyOffDays.includes(d);
                                                return (
                                                    <label key={d} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors ${
                                                        checked
                                                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-600 dark:text-indigo-300'
                                                            : 'bg-gray-50 border-gray-200 text-gray-600 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                                                    }`}>
                                                        <input type="checkbox" className="w-3.5 h-3.5 rounded" checked={checked}
                                                            onChange={() => {
                                                                const updated = checked
                                                                    ? form.weeklyOffDays.filter(x => x !== d)
                                                                    : [...form.weeklyOffDays, d];
                                                                setForm({ ...form, weeklyOffDays: updated });
                                                            }} />
                                                        {d.slice(0, 3)}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1">Select 1 or 2 days</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Notice Period</label>
                                        <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.noticePeriod} onChange={e => setForm({ ...form, noticePeriod: e.target.value })}>
                                            <option value="1 Month">1 Month</option>
                                            <option value="2 Months">2 Months</option>
                                            <option value="3 Months">3 Months</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Probation Period</label>
                                        <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.probationPeriod} onChange={e => setForm({ ...form, probationPeriod: e.target.value })}>
                                            <option value="3 Months">3 Months</option>
                                            <option value="6 Months">6 Months</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Penalty Training Expenses (AED)</label>
                                        <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.penaltyTrainingExpenses} onChange={e => setForm({ ...form, penaltyTrainingExpenses: Number(e.target.value) })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Resignation Ban Duration</label>
                                        <input className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.resignationBanDuration} onChange={e => setForm({ ...form, resignationBanDuration: e.target.value })} />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="block text-sm font-medium mb-1">Penalty Ban Details</label>
                                        <textarea rows={2} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.penaltyBanDetails} onChange={e => setForm({ ...form, penaltyBanDetails: e.target.value })} />
                                    </div>
                                </div>
                            </fieldset>

                            {/* Salary */}
                            <fieldset className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                <legend className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-2">Salary (AED)</legend>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Basic Salary</label>
                                        <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.basicSalary} onChange={e => setForm({ ...form, basicSalary: Number(e.target.value) })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Housing Allowance</label>
                                        <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.housingAllowance} onChange={e => setForm({ ...form, housingAllowance: Number(e.target.value) })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Transport Allowance</label>
                                        <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.transportAllowance} onChange={e => setForm({ ...form, transportAllowance: Number(e.target.value) })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Other Allowances</label>
                                        <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.otherAllowances} onChange={e => setForm({ ...form, otherAllowances: Number(e.target.value) })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Work Allowance</label>
                                        <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.workAllowance} onChange={e => setForm({ ...form, workAllowance: Number(e.target.value) })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Training Allowance</label>
                                        <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.trainingAllowance} onChange={e => setForm({ ...form, trainingAllowance: Number(e.target.value) })} />
                                    </div>
                                    <div className="col-span-2 text-right text-sm font-semibold text-indigo-600">
                                        Total: AED {(form.basicSalary + form.housingAllowance + form.transportAllowance + form.workAllowance + form.trainingAllowance + form.otherAllowances).toLocaleString()}
                                    </div>
                                </div>
                            </fieldset>

                            {/* Visa & Documents */}
                            <fieldset className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                <legend className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-2">Visa & IDs</legend>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Emirates ID</label>
                                        <input className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.emiratesId} onChange={e => setForm({ ...form, emiratesId: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">EID Expiry</label>
                                        <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.emiratesIdExpiry} onChange={e => setForm({ ...form, emiratesIdExpiry: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Passport Number</label>
                                        <input className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.passportNumber} onChange={e => setForm({ ...form, passportNumber: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Passport Expiry</label>
                                        <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.passportExpiry} onChange={e => setForm({ ...form, passportExpiry: e.target.value })} />
                                    </div>
                                    <div className="col-span-2 border-t border-gray-200 dark:border-gray-600 pt-3 mt-1">
                                        <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Visa Details</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Visa Status</label>
                                        <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.visaStatus} onChange={e => setForm({ ...form, visaStatus: e.target.value })}>
                                            <option value="">Select...</option>
                                            <option value="On Process">On Process</option>
                                            <option value="Valid">Valid</option>
                                            <option value="Expired">Expired</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Visa Expiry</label>
                                        <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.visaExpiryDate} onChange={e => setForm({ ...form, visaExpiryDate: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Visa Number</label>
                                        <input className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.visaNumber} onChange={e => setForm({ ...form, visaNumber: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Visa Type</label>
                                        <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.visaType} onChange={e => setForm({ ...form, visaType: e.target.value })}>
                                            <option value="">Select...</option>
                                            <option value="Employment">Employment</option>
                                            <option value="Resident">Resident</option>
                                            <option value="Tourist">Tourist</option>
                                            <option value="War Visa">War Visa</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Visa Issuing Branch</label>
                                        <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.visaIssuingBranch} onChange={e => setForm({ ...form, visaIssuingBranch: e.target.value })}>
                                            <option value="">Select...</option>
                                            {VISA_ISSUING_BRANCHES.map(b => (
                                                <option key={b} value={b}>{b}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-2 border-t border-gray-200 dark:border-gray-600 pt-3 mt-1">
                                        <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Work Permit / Labor Card</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Work Permit #</label>
                                        <input className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.workPermitNumber} onChange={e => setForm({ ...form, workPermitNumber: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Work Permit Expiry</label>
                                        <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.workPermitExpiry} onChange={e => setForm({ ...form, workPermitExpiry: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Work Permit Status</label>
                                        <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.workPermitStatus} onChange={e => setForm({ ...form, workPermitStatus: e.target.value })}>
                                            {LABOR_CARD_STATUSES.map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Work Permit Issue Date</label>
                                        <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.workPermitIssueDate} onChange={e => setForm({ ...form, workPermitIssueDate: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">LC Personal #</label>
                                        <input className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.lcPersonalNumber} onChange={e => setForm({ ...form, lcPersonalNumber: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">LC Designation</label>
                                        <input className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.lcDesignation} onChange={e => setForm({ ...form, lcDesignation: e.target.value })} />
                                    </div>
                                </div>
                            </fieldset>

                            {/* Medical Insurance */}
                            <fieldset className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                <legend className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-2">Medical Insurance</legend>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Insurance Provider</label>
                                        <input className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.medicalInsuranceProvider} onChange={e => setForm({ ...form, medicalInsuranceProvider: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Policy Number</label>
                                        <input className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.medicalInsurancePolicyNumber} onChange={e => setForm({ ...form, medicalInsurancePolicyNumber: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Insurance Expiry</label>
                                        <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.medicalInsuranceExpiry} onChange={e => setForm({ ...form, medicalInsuranceExpiry: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Category</label>
                                        <input className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.medicalInsuranceCategory} onChange={e => setForm({ ...form, medicalInsuranceCategory: e.target.value })} />
                                    </div>
                                </div>
                            </fieldset>

                            {/* DHA & BLS License */}
                            <fieldset className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                <legend className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-2">DHA & BLS License (Clinical Staff)</legend>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">DHA License Number</label>
                                        <input className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.dhaLicenseNumber} onChange={e => setForm({ ...form, dhaLicenseNumber: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">DHA License Expiry</label>
                                        <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.dhaLicenseExpiry} onChange={e => setForm({ ...form, dhaLicenseExpiry: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">BLS Certificate Number</label>
                                        <input className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.blsCertificateNumber} onChange={e => setForm({ ...form, blsCertificateNumber: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">BLS Certificate Expiry</label>
                                        <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                            value={form.blsCertificateExpiry} onChange={e => setForm({ ...form, blsCertificateExpiry: e.target.value })} />
                                    </div>
                                </div>
                            </fieldset>

                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                                <button type="submit"
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Save Employee</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

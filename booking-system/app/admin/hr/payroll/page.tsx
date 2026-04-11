'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Calculator, ArrowLeft, DollarSign, CalendarDays, Award, ChevronRight, ChevronLeft } from 'lucide-react';

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

interface PayrollRow {
    id: string;
    employeeCode: string;
    name: string;
    designation: string;
    department: string;
    joiningDate: string;
    status?: string;
    grossSalary: number;
    basicSalary: number;
    housingAllowance: number;
    transportAllowance: number;
    workAllowance: number;
    trainingAllowance: number;
    otherAllowances: number;
    remainingLeave: number;
    leaveEncashment: number;
    gratuityAccrued: number;
    yearsOfService: number;
    endOfService?: {
        terminationType: string;
        gratuity: { gratuityAmount: number; breakdown: string; };
        leaveEncashment: number;
        totalEOS: number;
    };
}

export default function PayrollPage() {
    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth()); // 0-indexed
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [viewType, setViewType] = useState<'active' | 'separated'>('active');
    const [payroll, setPayroll] = useState<PayrollRow[]>([]);
    const [loading, setLoading] = useState(true);

    const loadPayroll = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ month: String(selectedMonth + 1), year: String(selectedYear), viewType });
            const res = await fetch(`/api/admin/hr/payroll?${params}`);
            if (res.ok) setPayroll(await res.json());
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, [selectedMonth, selectedYear, viewType]);

    useEffect(() => { loadPayroll(); }, [loadPayroll]);

    const handlePrevMonth = () => {
        if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(y => y - 1); }
        else setSelectedMonth(m => m - 1);
    };

    const handleNextMonth = () => {
        if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(y => y + 1); }
        else setSelectedMonth(m => m + 1);
    };

    const totals = payroll.reduce(
        (acc, r) => ({
            grossSalary: acc.grossSalary + r.grossSalary,
            gratuity: acc.gratuity + (r.endOfService?.gratuity.gratuityAmount || r.gratuityAccrued),
            leaveEncash: acc.leaveEncash + (r.endOfService?.leaveEncashment || r.leaveEncashment),
            totalEOS: acc.totalEOS + (r.endOfService?.totalEOS || 0),
        }),
        { grossSalary: 0, gratuity: 0, leaveEncash: 0, totalEOS: 0 }
    );

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-6">
                <Link href="/admin/hr" className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mb-3">
                    <ArrowLeft className="w-4 h-4" /> Back to HR Dashboard
                </Link>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                            <Calculator className="w-8 h-8 text-indigo-600" /> {viewType === 'active' ? 'Payroll Overview' : 'End of Service'}
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">{viewType === 'active' ? 'Salary, gratuity, and leave summary for all active employees' : 'EOS calculations for terminated and resigned employees'}</p>
                    </div>
                    {/* Month Selector */}
                    <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-xl px-3 py-2 shadow-sm border border-gray-200 dark:border-gray-700">
                        <button onClick={handlePrevMonth} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Previous month">
                            <ChevronLeft className="w-5 h-5 text-gray-500" />
                        </button>
                        <div className="flex items-center gap-2">
                            <select className="bg-transparent font-semibold text-gray-900 dark:text-white text-sm border-none focus:outline-none cursor-pointer appearance-none pr-1"
                                value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
                                {MONTH_NAMES.map((name, idx) => (
                                    <option key={idx} value={idx}>{name}</option>
                                ))}
                            </select>
                            <select className="bg-transparent font-semibold text-gray-900 dark:text-white text-sm border-none focus:outline-none cursor-pointer appearance-none"
                                value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
                                {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                        <button onClick={handleNextMonth} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Next month">
                            <ChevronRight className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                </div>
            </div>

            {/* View Toggle */}
            <div className="flex gap-2 mb-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
                <button
                    onClick={() => setViewType('active')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewType === 'active'
                        ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <DollarSign className="w-4 h-4" /> Active Payroll
                </button>
                <button
                    onClick={() => setViewType('separated')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewType === 'separated'
                        ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Award className="w-4 h-4" /> End of Service
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                {viewType === 'active' ? (
                    <>
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-3 mb-2">
                                <DollarSign className="w-6 h-6 text-green-600" />
                                <span className="text-sm text-gray-500">Total Monthly Payroll</span>
                            </div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">AED {totals.grossSalary.toLocaleString()}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-3 mb-2">
                                <Award className="w-6 h-6 text-indigo-600" />
                                <span className="text-sm text-gray-500">Total Gratuity Accrued</span>
                            </div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">AED {totals.gratuity.toLocaleString()}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-3 mb-2">
                                <CalendarDays className="w-6 h-6 text-amber-600" />
                                <span className="text-sm text-gray-500">Total Leave Encashment</span>
                            </div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">AED {totals.leaveEncash.toLocaleString()}</p>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-3 mb-2">
                                <Award className="w-6 h-6 text-indigo-600" />
                                <span className="text-sm text-gray-500">Total EOS Liability</span>
                            </div>
                            <p className="text-2xl font-bold text-indigo-600">AED {totals.totalEOS.toLocaleString()}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-3 mb-2">
                                <Award className="w-6 h-6 text-green-600" />
                                <span className="text-sm text-gray-500">Total Adjusted Gratuity</span>
                            </div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">AED {totals.gratuity.toLocaleString()}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-3 mb-2">
                                <CalendarDays className="w-6 h-6 text-amber-600" />
                                <span className="text-sm text-gray-500">Total Leave Encashment</span>
                            </div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">AED {totals.leaveEncash.toLocaleString()}</p>
                        </div>
                    </>
                )}
            </div>

            {/* Payroll Table */}
            {payroll.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center shadow-sm">
                    <p className="text-gray-500">No {viewType} employees found.</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-x-auto">
                    <table className="w-full text-left min-w-[900px]">
                        <thead>
                            {viewType === 'active' ? (
                                <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 uppercase">
                                    <th className="px-4 py-3">Employee</th>
                                    <th className="px-4 py-3">Department</th>
                                    <th className="px-4 py-3 text-right">Basic</th>
                                    <th className="px-4 py-3 text-right">Allowances</th>
                                    <th className="px-4 py-3 text-right">Gross Salary</th>
                                    <th className="px-4 py-3 text-right">Service (yrs)</th>
                                    <th className="px-4 py-3 text-right">Leave Bal.</th>
                                    <th className="px-4 py-3 text-right">Gratuity</th>
                                    <th className="px-4 py-3 text-right">Leave Encash</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            ) : (
                                <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 uppercase">
                                    <th className="px-4 py-3">Employee</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 text-right">Service (yrs)</th>
                                    <th className="px-4 py-3 text-right">Full Gratuity</th>
                                    <th className="px-4 py-3 text-right">Adjusted Gratuity</th>
                                    <th className="px-4 py-3 text-right">Leave Encash</th>
                                    <th className="px-4 py-3 text-right">Total EOS</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            )}
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {payroll.map(row => (
                                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-gray-900 dark:text-white text-sm">{row.name}</div>
                                        <div className="text-xs text-gray-500">{row.employeeCode} · {row.designation}</div>
                                    </td>
                                    {viewType === 'active' ? (
                                        <>
                                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{row.department}</td>
                                            <td className="px-4 py-3 text-sm text-right font-mono text-gray-900 dark:text-gray-100">{row.basicSalary.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-sm text-right font-mono text-gray-500">{(row.housingAllowance + row.transportAllowance + row.workAllowance + row.trainingAllowance + row.otherAllowances).toLocaleString()}</td>
                                            <td className="px-4 py-3 text-sm text-right font-mono font-semibold text-indigo-600 dark:text-indigo-400">{row.grossSalary.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-sm text-right">{row.yearsOfService}</td>
                                            <td className="px-4 py-3 text-sm text-right">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${row.remainingLeave <= 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                                    }`}>
                                                    {row.remainingLeave} days
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-mono">{row.gratuityAccrued.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-sm text-right font-mono">{row.leaveEncashment.toLocaleString()}</td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-4 py-3 text-sm">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${row.status === 'TERMINATED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {row.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right">{row.yearsOfService}</td>
                                            <td className="px-4 py-3 text-sm text-right font-mono">{row.gratuityAccrued.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-sm text-right font-mono" title={row.endOfService?.gratuity.breakdown}>{(row.endOfService?.gratuity.gratuityAmount || 0).toLocaleString()}</td>
                                            <td className="px-4 py-3 text-sm text-right font-mono">{(row.endOfService?.leaveEncashment || 0).toLocaleString()}</td>
                                            <td className="px-4 py-3 text-sm text-right font-mono font-semibold text-indigo-600 dark:text-indigo-400">{(row.endOfService?.totalEOS || 0).toLocaleString()}</td>
                                        </>
                                    )}
                                    <td className="px-4 py-3">
                                        <Link href={`/admin/hr/employees/${row.id}`}
                                            className="text-indigo-600 hover:text-indigo-800 p-1" title="View Details">
                                            <ChevronRight className="w-4 h-4" />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-gray-50 dark:bg-gray-700/50 font-semibold text-sm">
                                {viewType === 'active' ? (
                                    <>
                                        <td className="px-4 py-3" colSpan={4}>Total ({payroll.length} employees)</td>
                                        <td className="px-4 py-3 text-right font-mono text-indigo-600">{totals.grossSalary.toLocaleString()}</td>
                                        <td className="px-4 py-3" colSpan={2}></td>
                                        <td className="px-4 py-3 text-right font-mono">{totals.gratuity.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right font-mono">{totals.leaveEncash.toLocaleString()}</td>
                                        <td></td>
                                    </>
                                ) : (
                                    <>
                                        <td className="px-4 py-3" colSpan={3}>Total ({payroll.length} separated employees)</td>
                                        <td className="px-4 py-3 text-right font-mono">{payroll.reduce((sum, r) => sum + r.gratuityAccrued, 0).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right font-mono">{totals.gratuity.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right font-mono">{totals.leaveEncash.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right font-mono text-indigo-600">{totals.totalEOS.toLocaleString()}</td>
                                        <td></td>
                                    </>
                                )}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
}

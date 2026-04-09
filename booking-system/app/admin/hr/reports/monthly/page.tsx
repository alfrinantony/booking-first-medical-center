'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { FileText, ArrowLeft, Printer, Download, ChevronLeft, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { MonthlyPayslip } from '@/lib/hr-payroll-store';

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

interface ReportRow {
    employeeId: string;
    employeeCode: string;
    name: string;
    department: string;
    designation: string;
    isGenerated: boolean;
    payslipRecordId: string | null;
    payslip: MonthlyPayslip | null;
    formInputs: {
        daysWorked: number;
        annualLeave: number;
        sickLeave: number;
        unpaidLeave: number;
        absentDays: number;
        phDays: number;
        offDays: number;
        expectedHours: number;
        actualHours: number;
        netOvertimeHours: number;
    } | null;
}

export default function MonthlyPayrollReportPage() {
    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1); // 1-indexed for backend API
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [report, setReport] = useState<ReportRow[]>([]);
    const [loading, setLoading] = useState(true);

    const loadReport = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ month: String(selectedMonth), year: String(selectedYear) });
            const res = await fetch(`/api/admin/hr/reports/monthly?${params}`);
            if (res.ok) {
                setReport(await res.json());
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [selectedMonth, selectedYear]);

    useEffect(() => { loadReport(); }, [loadReport]);

    const handlePrevMonth = () => {
        if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1); }
        else setSelectedMonth(m => m - 1);
    };

    const handleNextMonth = () => {
        if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(y => y + 1); }
        else setSelectedMonth(m => m + 1);
    };

    const printReport = () => {
        const el = document.getElementById('report-print');
        if (!el) return;
        const w = window.open('', '_blank');
        if (!w) return;
        w.document.write(`<html><head><title>Monthly Payroll Report - ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}</title>
        <style>
            body { font-family: 'Segoe UI', sans-serif; margin: 20px; color: #222; }
            h2 { margin: 0 0 4px; }
            p.sub { margin: 0 0 20px; color: #555; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
            th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
            th { background: #f5f5f5; font-weight: bold; }
            .right { text-align: right; }
            .total-row { font-weight: bold; background: #eef2ff; }
            .warn-row { color: #854d0e; background: #fefce8; }
            @media print { 
                @page { size: landscape; margin: 10mm; }
                body { margin: 0; }
                .no-print { display: none; }
            }
        </style></head><body>${el.innerHTML}</body></html>`);
        w.document.close();
        w.print();
    };

    const downloadCSV = () => {
        if (!report.length) return;
        
        const headers = [
            'Emp Code', 'Name', 'Department', 'Designation', 'Status',
            'Days Worked', 'Leaves/Absent', 'OT Hrs',
            'Gross Earnings', 'Deductions', 'Net Salary'
        ];
        
        const rows = report.map(r => [
            r.employeeCode,
            `"${r.name}"`,
            `"${r.department}"`,
            `"${r.designation}"`,
            r.isGenerated ? 'Generated' : 'Not Generated',
            r.formInputs ? r.formInputs.daysWorked : '-',
            r.formInputs ? (r.formInputs.annualLeave + r.formInputs.sickLeave + r.formInputs.unpaidLeave + r.formInputs.absentDays + r.formInputs.phDays) : '-',
            r.formInputs ? r.formInputs.netOvertimeHours : '-',
            r.payslip ? r.payslip.totalEarnings : '-',
            r.payslip ? r.payslip.totalDeductions : '-',
            r.payslip ? r.payslip.netSalary : '-'
        ]);

        const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Payroll_Report_${MONTH_NAMES[selectedMonth-1]}_${selectedYear}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Calculate aggregated totals
    const totals = report.reduce((acc, r) => {
        if (r.payslip) {
            acc.netSalary += r.payslip.netSalary;
            acc.totalEarnings += r.payslip.totalEarnings;
            acc.totalDeductions += r.payslip.totalDeductions;
        }
        return acc;
    }, { netSalary: 0, totalEarnings: 0, totalDeductions: 0 });

    const totalGenerated = report.filter(r => r.isGenerated).length;

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-6">
                <Link href="/admin/hr" className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mb-3">
                    <ArrowLeft className="w-4 h-4" /> Back to HR Dashboard
                </Link>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                            <FileText className="w-8 h-8 text-purple-600" /> Monthly Payroll Report
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">Aggregated payslips for the month</p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Month Selector */}
                        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-xl px-3 py-2 shadow-sm border border-gray-200 dark:border-gray-700">
                            <button onClick={handlePrevMonth} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                                <ChevronLeft className="w-5 h-5 text-gray-500" />
                            </button>
                            <div className="flex items-center gap-2">
                                <select className="bg-transparent font-semibold text-gray-900 dark:text-white text-sm border-none focus:outline-none cursor-pointer appearance-none pr-1"
                                    value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
                                    {MONTH_NAMES.map((name, idx) => (
                                        <option key={idx} value={idx + 1}>{name}</option>
                                    ))}
                                </select>
                                <select className="bg-transparent font-semibold text-gray-900 dark:text-white text-sm border-none focus:outline-none cursor-pointer appearance-none"
                                    value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
                                    {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                            <button onClick={handleNextMonth} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                                <ChevronRight className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <button onClick={downloadCSV} className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors">
                            <Download className="w-4 h-4" /> CSV
                        </button>
                        <button onClick={printReport} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors">
                            <Printer className="w-4 h-4" /> Print Master
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center shadow-sm min-h-[400px] flex items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden relative">
                    
                    {totalGenerated < report.length && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 px-6 py-3 border-b border-amber-200 flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-600" />
                            <p className="text-sm text-amber-800 dark:text-amber-400">
                                <strong>Action Required:</strong> {report.length - totalGenerated} employees do not have a generated payslip for this month yet.
                            </p>
                        </div>
                    )}

                    <div id="report-print" className="overflow-x-auto p-0">
                        {/* Hidden on web, visible only in print */}
                        <div className="hidden no-print" style={{ display: 'none' }}>
                            <style>{`
                                @media print {
                                    .print-header { display: block !important; margin-bottom: 20px; }
                                }
                            `}</style>
                            <div className="print-header">
                                <h2>First Medical Center LLC</h2>
                                <p className="sub">Master Payroll Report — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}</p>
                            </div>
                        </div>

                        <table className="w-full text-left min-w-[1000px]">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 uppercase tracking-widest border-b">
                                    <th className="px-4 py-3">Employee</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 text-right">Days Work</th>
                                    <th className="px-4 py-3 text-right">Leaves/Off</th>
                                    <th className="px-4 py-3 text-right">OT Hrs</th>
                                    <th className="px-4 py-3 text-right">Earnings</th>
                                    <th className="px-4 py-3 text-right">Deductions</th>
                                    <th className="px-4 py-3 text-right">Net Salary</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {report.map(row => (
                                    <tr key={row.employeeId} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${!row.isGenerated ? 'bg-amber-50/30' : ''}`}>
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-gray-900 dark:text-white">{row.name}</div>
                                            <div className="text-xs text-gray-500">{row.employeeCode} · {row.department}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {row.isGenerated ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Generated
                                                </span>
                                            ) : (
                                                <Link href="/admin/hr/payroll" className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors">
                                                    Pending
                                                </Link>
                                            )}
                                        </td>
                                        
                                        {row.isGenerated && row.formInputs && row.payslip ? (
                                            <>
                                                <td className="px-4 py-3 text-right text-sm">{row.formInputs.daysWorked}</td>
                                                <td className="px-4 py-3 text-right text-sm text-gray-500">
                                                    {row.formInputs.annualLeave + row.formInputs.sickLeave + row.formInputs.unpaidLeave + row.formInputs.absentDays + row.formInputs.phDays}
                                                </td>
                                                <td className="px-4 py-3 text-right text-sm font-medium">
                                                    {row.formInputs.netOvertimeHours > 0 ? `+${row.formInputs.netOvertimeHours}` : row.formInputs.netOvertimeHours}
                                                </td>
                                                <td className="px-4 py-3 text-right text-sm font-mono text-green-700">{row.payslip.totalEarnings.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-right text-sm font-mono text-red-600">{row.payslip.totalDeductions > 0 ? `-${row.payslip.totalDeductions.toLocaleString()}` : '0'}</td>
                                                <td className="px-4 py-3 text-right text-sm font-mono font-bold text-gray-900 dark:text-white bg-indigo-50/30">
                                                    {row.payslip.netSalary.toLocaleString()}
                                                </td>
                                            </>
                                        ) : (
                                            <td colSpan={6} className="px-4 py-3 text-center text-sm text-gray-400 italic">
                                                Payslip data not available — needs generation
                                            </td>
                                        )}
                                    </tr>
                                ))}
                                {report.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                                            No active employees found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            {report.length > 0 && (
                                <tfoot>
                                    <tr className="bg-gray-100 dark:bg-gray-700 font-semibold text-sm border-t-2 border-gray-200">
                                        <td className="px-4 py-4" colSpan={5}>
                                            Report Totals ({totalGenerated} payslips generated / {report.length} total)
                                        </td>
                                        <td className="px-4 py-4 text-right font-mono text-green-700">{totals.totalEarnings.toLocaleString()}</td>
                                        <td className="px-4 py-4 text-right font-mono text-red-600">{totals.totalDeductions.toLocaleString()}</td>
                                        <td className="px-4 py-4 text-right font-mono text-xl text-indigo-700">{totals.netSalary.toLocaleString()}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

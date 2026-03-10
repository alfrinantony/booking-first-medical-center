'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Invoice } from '@/lib/billing-store';
import { clinics } from '@/lib/data';
import { FileText, Download, Calendar, Building2, TrendingUp, Receipt, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface VATRow {
    label: string;
    clinicId: string | null; // null = all
    invoiceCount: number;
    totalSales: number;      // total including tax
    taxableAmount: number;   // subtotal (before tax)
    vatCollected: number;    // taxAmount
}

const MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function VATReportPage() {
    const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);

    useEffect(() => {
        fetch('/api/admin/billing').then(r => r.json()).then(d => setAllInvoices(d || [])).catch(() => {});
    }, []);

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth(); // 0-based

    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [fromMonth, setFromMonth] = useState(currentMonth); // 0-based
    const [toMonth, setToMonth] = useState(currentMonth);     // 0-based
    const [selectedBranch, setSelectedBranch] = useState<string>('all');

    // Ensure toMonth >= fromMonth
    const handleFromMonthChange = (val: number) => {
        setFromMonth(val);
        if (val > toMonth) setToMonth(val);
    };
    const handleToMonthChange = (val: number) => {
        setToMonth(val);
        if (val < fromMonth) setFromMonth(val);
    };

    // Filter invoices for the selected period
    const filteredInvoices = useMemo(() => {
        return allInvoices.filter(inv => {
            const d = new Date(inv.date);
            if (d.getFullYear() !== selectedYear) return false;
            const m = d.getMonth();
            if (m < fromMonth || m > toMonth) return false;
            if (selectedBranch !== 'all' && inv.clinicId !== selectedBranch) return false;
            return true;
        });
    }, [allInvoices, selectedYear, fromMonth, toMonth, selectedBranch]);

    // Compute per-branch breakdown
    const branchRows: VATRow[] = useMemo(() => {
        const map = new Map<string, { invoices: Invoice[] }>();
        for (const inv of filteredInvoices) {
            const key = inv.clinicId || 'unknown';
            if (!map.has(key)) map.set(key, { invoices: [] });
            map.get(key)!.invoices.push(inv);
        }
        const rows: VATRow[] = [];
        for (const [clinicId, { invoices }] of map) {
            const clinic = clinics.find(c => c.id === clinicId);
            rows.push({
                label: clinic?.name || clinicId,
                clinicId,
                invoiceCount: invoices.length,
                totalSales: invoices.reduce((s, i) => s + i.totalAmount, 0),
                taxableAmount: invoices.reduce((s, i) => s + i.subtotal, 0),
                vatCollected: invoices.reduce((s, i) => s + i.taxAmount, 0),
            });
        }
        return rows.sort((a, b) => b.totalSales - a.totalSales);
    }, [filteredInvoices]);

    // Totals
    const totals = useMemo(() => {
        return {
            invoiceCount: filteredInvoices.length,
            totalSales: filteredInvoices.reduce((s, i) => s + i.totalAmount, 0),
            taxableAmount: filteredInvoices.reduce((s, i) => s + i.subtotal, 0),
            vatCollected: filteredInvoices.reduce((s, i) => s + i.taxAmount, 0),
        };
    }, [filteredInvoices]);

    // Previous period comparison (same span length, immediately before)
    const prevPeriodTotals = useMemo(() => {
        const spanLength = toMonth - fromMonth + 1;
        let prevFromMonth = fromMonth - spanLength;
        let prevToMonth = fromMonth - 1;
        let prevYear = selectedYear;
        if (prevFromMonth < 0) {
            prevYear = selectedYear - 1;
            prevFromMonth = 12 + prevFromMonth;
            prevToMonth = 11;
        }
        const prevInvoices = allInvoices.filter(inv => {
            const d = new Date(inv.date);
            if (d.getFullYear() !== prevYear) return false;
            const m = d.getMonth();
            if (m < prevFromMonth || m > prevToMonth) return false;
            if (selectedBranch !== 'all' && inv.clinicId !== selectedBranch) return false;
            return true;
        });
        return {
            totalSales: prevInvoices.reduce((s, i) => s + i.totalAmount, 0),
            vatCollected: prevInvoices.reduce((s, i) => s + i.taxAmount, 0),
        };
    }, [allInvoices, selectedYear, fromMonth, toMonth, selectedBranch]);

    const salesChange = prevPeriodTotals.totalSales > 0
        ? ((totals.totalSales - prevPeriodTotals.totalSales) / prevPeriodTotals.totalSales * 100)
        : null;
    const vatChange = prevPeriodTotals.vatCollected > 0
        ? ((totals.vatCollected - prevPeriodTotals.vatCollected) / prevPeriodTotals.vatCollected * 100)
        : null;

    // Period label
    const periodLabel = fromMonth === toMonth
        ? `${MONTH_LABELS[fromMonth]} ${selectedYear}`
        : `${MONTH_LABELS[fromMonth]} – ${MONTH_LABELS[toMonth]} ${selectedYear}`;

    // Year range for selector
    const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

    // CSV Export
    const handleExportCSV = () => {
        const headers = ['Branch', 'Invoices', 'Total Sales (AED)', 'Taxable Amount (AED)', 'VAT Collected (AED)'];
        const csvRows = [headers.join(',')];
        for (const row of branchRows) {
            csvRows.push([
                `"${row.label}"`, row.invoiceCount,
                row.totalSales.toFixed(2), row.taxableAmount.toFixed(2), row.vatCollected.toFixed(2)
            ].join(','));
        }
        csvRows.push(['Total', totals.invoiceCount, totals.totalSales.toFixed(2), totals.taxableAmount.toFixed(2), totals.vatCollected.toFixed(2)].join(','));

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `VAT_Report_${periodLabel.replace(/\s/g, '_')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Print
    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8 print:p-4 print:bg-white">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 print:mb-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                            <FileText className="w-8 h-8 text-indigo-600" />
                            VAT Report
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            Tax summary for <strong>{periodLabel}</strong>
                        </p>
                    </div>
                    <div className="flex items-center gap-2 print:hidden">
                        <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
                            <Download className="w-4 h-4" /> Export CSV
                        </button>
                        <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                            <FileText className="w-4 h-4" /> Print
                        </button>
                    </div>
                </header>

                {/* Filters */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6 mb-6 print:hidden">
                    <div className="flex flex-wrap items-end gap-4">
                        {/* Year */}
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Year</label>
                            <select
                                value={selectedYear}
                                onChange={e => setSelectedYear(Number(e.target.value))}
                                className="p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm min-w-[100px]"
                            >
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>

                        {/* From Month */}
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">From Month</label>
                            <select
                                value={fromMonth}
                                onChange={e => handleFromMonthChange(Number(e.target.value))}
                                className="p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm min-w-[140px]"
                            >
                                {MONTH_LABELS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                            </select>
                        </div>

                        {/* To Month */}
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">To Month</label>
                            <select
                                value={toMonth}
                                onChange={e => handleToMonthChange(Number(e.target.value))}
                                className="p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm min-w-[140px]"
                            >
                                {MONTH_LABELS.map((m, i) => (
                                    <option key={i} value={i} disabled={i < fromMonth}>{m}</option>
                                ))}
                            </select>
                        </div>

                        {/* Branch filter */}
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Branch</label>
                            <select
                                value={selectedBranch}
                                onChange={e => setSelectedBranch(e.target.value)}
                                className="p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm min-w-[180px]"
                            >
                                <option value="all">All Branches</option>
                                {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {/* Invoices */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Invoices</span>
                            <Receipt className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{totals.invoiceCount}</div>
                    </div>

                    {/* Total Sales */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Sales</span>
                            <TrendingUp className="w-5 h-5 text-green-500" />
                        </div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{totals.totalSales.toFixed(2)} <span className="text-sm font-normal text-gray-400">AED</span></div>
                        {salesChange !== null && (
                            <div className={`flex items-center gap-1 text-xs mt-1 ${salesChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {salesChange >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                {Math.abs(salesChange).toFixed(1)}% vs prev period
                            </div>
                        )}
                    </div>

                    {/* Taxable Amount */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Taxable Amount</span>
                            <Calendar className="w-5 h-5 text-yellow-500" />
                        </div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{totals.taxableAmount.toFixed(2)} <span className="text-sm font-normal text-gray-400">AED</span></div>
                    </div>

                    {/* VAT Collected */}
                    <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl shadow-sm p-5 text-white">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-indigo-100">VAT Collected</span>
                            <FileText className="w-5 h-5 text-indigo-200" />
                        </div>
                        <div className="text-2xl font-bold">{totals.vatCollected.toFixed(2)} <span className="text-sm font-normal text-indigo-200">AED</span></div>
                        {vatChange !== null && (
                            <div className={`flex items-center gap-1 text-xs mt-1 ${vatChange >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                                {vatChange >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                {Math.abs(vatChange).toFixed(1)}% vs prev period
                            </div>
                        )}
                    </div>
                </div>

                {/* Branch Breakdown Table */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-indigo-500" />
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Branch-wise Breakdown</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-700/50">
                                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Branch</th>
                                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Invoices</th>
                                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Sales (AED)</th>
                                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Taxable Amount (AED)</th>
                                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">VAT Collected (AED)</th>
                                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Effective Rate</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {branchRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-12 text-gray-400">
                                            No invoices found for this period.
                                        </td>
                                    </tr>
                                ) : (
                                    <>
                                        {branchRows.map(row => {
                                            const clinic = clinics.find(c => c.id === row.clinicId);
                                            const effectiveRate = row.taxableAmount > 0 ? (row.vatCollected / row.taxableAmount * 100) : 0;
                                            return (
                                                <tr key={row.clinicId} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="font-medium text-gray-900 dark:text-white">{row.label}</div>
                                                        {clinic?.taxRegistrationNumber && (
                                                            <div className="text-xs text-gray-400">TRN: {clinic.taxRegistrationNumber}</div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-300">{row.invoiceCount}</td>
                                                    <td className="px-6 py-4 text-right font-medium text-gray-900 dark:text-white">{row.totalSales.toFixed(2)}</td>
                                                    <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-300">{row.taxableAmount.toFixed(2)}</td>
                                                    <td className="px-6 py-4 text-right font-bold text-indigo-600 dark:text-indigo-400">{row.vatCollected.toFixed(2)}</td>
                                                    <td className="px-6 py-4 text-right text-gray-500">{effectiveRate.toFixed(1)}%</td>
                                                </tr>
                                            );
                                        })}
                                        {/* Totals row */}
                                        <tr className="bg-gray-50 dark:bg-gray-700/50 font-bold">
                                            <td className="px-6 py-4 text-gray-900 dark:text-white">TOTAL</td>
                                            <td className="px-6 py-4 text-right text-gray-900 dark:text-white">{totals.invoiceCount}</td>
                                            <td className="px-6 py-4 text-right text-gray-900 dark:text-white">{totals.totalSales.toFixed(2)}</td>
                                            <td className="px-6 py-4 text-right text-gray-900 dark:text-white">{totals.taxableAmount.toFixed(2)}</td>
                                            <td className="px-6 py-4 text-right text-indigo-600 dark:text-indigo-400">{totals.vatCollected.toFixed(2)}</td>
                                            <td className="px-6 py-4 text-right text-gray-500">
                                                {totals.taxableAmount > 0 ? (totals.vatCollected / totals.taxableAmount * 100).toFixed(1) : '0.0'}%
                                            </td>
                                        </tr>
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Invoice Detail Table */}
                {filteredInvoices.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                            <Receipt className="w-5 h-5 text-indigo-500" />
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Invoice Details</h2>
                            <span className="text-xs text-gray-400 ml-auto">{filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-700/50">
                                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice #</th>
                                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Branch</th>
                                        <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Subtotal</th>
                                        <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">VAT %</th>
                                        <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">VAT Amount</th>
                                        <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {filteredInvoices.map(inv => (
                                        <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                            <td className="px-6 py-3 font-medium text-indigo-600 dark:text-indigo-400">{inv.invoiceNumber}</td>
                                            <td className="px-6 py-3 text-gray-600 dark:text-gray-300">{inv.date}</td>
                                            <td className="px-6 py-3 text-gray-900 dark:text-white">{inv.clientName}</td>
                                            <td className="px-6 py-3 text-gray-600 dark:text-gray-300">{inv.clinicName || '—'}</td>
                                            <td className="px-6 py-3 text-right text-gray-600 dark:text-gray-300">{inv.subtotal.toFixed(2)}</td>
                                            <td className="px-6 py-3 text-right text-gray-500">{inv.taxPercentage}%</td>
                                            <td className="px-6 py-3 text-right font-medium text-indigo-600 dark:text-indigo-400">{inv.taxAmount.toFixed(2)}</td>
                                            <td className="px-6 py-3 text-right font-bold text-gray-900 dark:text-white">{inv.totalAmount.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { CreditCard, Search, Loader2, DollarSign, CheckCircle, XCircle } from 'lucide-react';

export default function TransactionsReport() {
    const [bookings, setBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateFrom, setDateFrom] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
    });
    const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
    const [search, setSearch] = useState('');

    useEffect(() => {
        setLoading(true);
        fetch('/api/admin/bookings')
            .then(res => res.json())
            .then(data => setBookings(Array.isArray(data) ? data : []))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    // Filter only bookings with invoice data
    const filteredTransactions = useMemo(() => {
        return bookings.filter(b => {
            if (!b.sbInvoiceNumber && !b.sbInvoiceAmount && !b.amount && !b.sbPaymentStatus) return false;
            const d = new Date(b.date || b.createdAt);
            const inDate = (!dateFrom || d >= new Date(dateFrom)) && (!dateTo || d <= new Date(dateTo));
            const inSearch = search ? (
                (b.patientName || '').toLowerCase().includes(search.toLowerCase()) ||
                (b.sbInvoiceNumber || '').toLowerCase().includes(search.toLowerCase())
            ) : true;
            return inDate && inSearch;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [bookings, dateFrom, dateTo, search]);

    return (
        <div className="p-4 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <CreditCard className="w-6 h-6 text-indigo-500" /> Payment Transactions
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">View SimplyBook invoices and internal payments.</p>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[150px]">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">From Date</label>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                        className="w-full p-2 border rounded-xl bg-gray-50 dark:bg-gray-700 text-sm" />
                </div>
                <div className="flex-1 min-w-[150px]">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">To Date</label>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                        className="w-full p-2 border rounded-xl bg-gray-50 dark:bg-gray-700 text-sm" />
                </div>
                <div className="flex-2 min-w-[200px]">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Search</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Patient or Invoice #"
                            className="w-full pl-9 p-2 border rounded-xl bg-gray-50 dark:bg-gray-700 text-sm" />
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                {loading ? (
                    <div className="py-20 text-center text-gray-500 flex flex-col items-center">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
                        Loading transactions...
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 text-xs uppercase font-semibold">
                                <tr>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Invoice #</th>
                                    <th className="px-4 py-3">Patient</th>
                                    <th className="px-4 py-3">Amount</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Processor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filteredTransactions.map((b, i) => (
                                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-4 py-3 font-medium">{b.date}</td>
                                        <td className="px-4 py-3 font-mono text-xs">{b.sbInvoiceNumber || '—'}</td>
                                        <td className="px-4 py-3">{b.patientName}</td>
                                        <td className="px-4 py-3 font-semibold">
                                            {b.sbInvoiceAmount || b.amount || 0} {b.sbInvoiceCurrency || 'AED'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {b.sbPaymentStatus === 'paid' ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
                                                    <CheckCircle className="w-2.5 h-2.5" /> Paid
                                                </span>
                                            ) : b.sbPaymentStatus === 'unpaid' ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                                                    <XCircle className="w-2.5 h-2.5" /> Unpaid
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-full">
                                                    {b.sbPaymentStatus || b.billingStatus || '—'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500">
                                            {b.sbPaymentProcessor || b.paymentMethod || '—'}
                                        </td>
                                    </tr>
                                ))}
                                {filteredTransactions.length === 0 && (
                                    <tr><td colSpan={6} className="text-center py-10 text-gray-500">No transactions found for this criteria.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

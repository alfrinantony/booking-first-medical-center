'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    CreditCard, Search, Filter, Calendar, ArrowDownCircle,
    Eye, X, RefreshCw, FileText, ChevronDown, ChevronUp,
    Building2, Phone, Mail, Hash, DollarSign, AlertTriangle,
    CheckCircle2, XCircle, Banknote, Clock
} from 'lucide-react';

interface InvoiceLineItem {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    medicineId?: string;
    batchId?: string;
    medicineName?: string;
    isVoid?: boolean;
}

interface Invoice {
    id: string;
    invoiceNumber: string;
    clientName: string;
    clientPhone: string;
    clientEmail?: string;
    items: InvoiceLineItem[];
    packageDetails?: string;
    subtotal: number;
    taxPercentage: number;
    taxAmount: number;
    totalAmount: number;
    paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'online';
    paymentConfirmed: boolean;
    paymentReceivedBy?: string;
    paymentReceptionStatus?: 'received' | 'pending' | 'partial';
    refundStatus: 'none' | 'refunded';
    refundedAt?: string;
    refundedBy?: string;
    refundAmount?: number;
    refundReason?: string;
    refundIban?: string;
    refundBankName?: string;
    refundAccountName?: string;
    isVoid?: boolean;
    clinicId?: string;
    clinicName?: string;
    generatedBy: string;
    date: string;
    createdAt: string;
    notes?: string;
}

const paymentMethodLabels: Record<string, string> = {
    cash: 'Cash', card: 'Credit Card', bank_transfer: 'Bank Transfer', online: 'Online',
};

export default function TransactionsPage() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showFilters, setShowFilters] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);

    // Filters
    const [searchText, setSearchText] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [filterPhone, setFilterPhone] = useState('');
    const [filterEmail, setFilterEmail] = useState('');
    const [filterInvoice, setFilterInvoice] = useState('');
    const [filterPayment, setFilterPayment] = useState('');
    const [filterRefundStatus, setFilterRefundStatus] = useState('');

    // Detail modal
    const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

    // Refund modal
    const [refundInvoice, setRefundInvoice] = useState<Invoice | null>(null);
    const [refundAmount, setRefundAmount] = useState('');
    const [refundReason, setRefundReason] = useState('');
    const [refundIban, setRefundIban] = useState('');
    const [refundBankName, setRefundBankName] = useState('');
    const [refundAccountName, setRefundAccountName] = useState('');
    const [isProcessingRefund, setIsProcessingRefund] = useState(false);
    const [refundError, setRefundError] = useState('');

    const loadInvoices = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchText) params.set('search', searchText);
            if (dateFrom) params.set('dateFrom', dateFrom);
            if (dateTo) params.set('dateTo', dateTo);
            if (filterPhone) params.set('clientPhone', filterPhone);
            if (filterEmail) params.set('clientEmail', filterEmail);
            if (filterInvoice) params.set('invoiceNumber', filterInvoice);
            if (filterPayment) params.set('paymentMethod', filterPayment);
            if (filterRefundStatus) params.set('refundStatus', filterRefundStatus);

            const res = await fetch(`/api/admin/billing?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setInvoices(Array.isArray(data) ? data : []);
            }
        } catch { /* silent */ }
        setIsLoading(false);
    }, [searchText, dateFrom, dateTo, filterPhone, filterEmail, filterInvoice, filterPayment, filterRefundStatus]);

    useEffect(() => { 
        loadInvoices(); 
        const stored = sessionStorage.getItem('adminUser');
        if (stored) {
            try { setUserRole(JSON.parse(stored).role); } catch (e) {}
        }
    }, [loadInvoices]);

    const openRefundModal = (inv: Invoice) => {
        setRefundInvoice(inv);
        setRefundAmount(inv.totalAmount.toFixed(2));
        setRefundReason('');
        setRefundIban('');
        setRefundBankName('');
        setRefundAccountName('');
        setRefundError('');
    };

    const handleProcessRefund = async () => {
        if (!refundInvoice) return;
        if (!refundAmount || !refundReason) {
            setRefundError('Please fill in all required fields.');
            return;
        }
        const needsBankInfo = refundInvoice.paymentMethod === 'cash' || refundInvoice.paymentMethod === 'bank_transfer';
        if (needsBankInfo && (!refundAccountName || !refundIban || !refundBankName)) {
            setRefundError('Account Name, IBAN, and Bank Name are required for cash/bank transfer refunds.');
            return;
        }

        setIsProcessingRefund(true);
        setRefundError('');

        const stored = sessionStorage.getItem('adminUser');
        const adminName = stored ? JSON.parse(stored).name || 'Admin' : 'Admin';

        try {
            const res = await fetch('/api/admin/billing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'refund',
                    invoiceId: refundInvoice.id,
                    refundedBy: adminName,
                    refundAmount: parseFloat(refundAmount),
                    refundReason,
                    refundAccountName: refundAccountName || undefined,
                    refundIban: refundIban || undefined,
                    refundBankName: refundBankName || undefined,
                }),
            });
            const result = await res.json();
            if (result.success) {
                setRefundInvoice(null);
                setViewingInvoice(null);
                await loadInvoices();
            } else {
                setRefundError(result.error || result.message || 'Failed to process refund');
            }
        } catch {
            setRefundError('Network error. Please try again.');
        }
        setIsProcessingRefund(false);
    };

    const clearFilters = () => {
        setSearchText(''); setDateFrom(''); setDateTo('');
        setFilterPhone(''); setFilterEmail('');
        setFilterInvoice(''); setFilterPayment(''); setFilterRefundStatus('');
    };

    const hasActiveFilters = dateFrom || dateTo || filterPhone || filterEmail || filterInvoice || filterPayment || filterRefundStatus;

    // Stats
    const totalRevenue = invoices.filter(i => i.refundStatus !== 'refunded').reduce((s, i) => s + i.totalAmount, 0);
    const totalRefunded = invoices.filter(i => i.refundStatus === 'refunded').reduce((s, i) => s + (i.refundAmount || i.totalAmount), 0);
    const paidCount = invoices.filter(i => i.refundStatus !== 'refunded').length;
    const refundedCount = invoices.filter(i => i.refundStatus === 'refunded').length;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">

                {/* Header */}
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <CreditCard className="w-8 h-8 text-indigo-600" />
                        Transactions & Refunds
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">View all client payment transactions and manage refunds.</p>
                </header>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
                                <FileText className="w-5 h-5 text-indigo-600" />
                            </div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Transactions</p>
                        </div>
                        <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{invoices.length}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                                <DollarSign className="w-5 h-5 text-emerald-600" />
                            </div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</p>
                        </div>
                        <p className="text-2xl font-extrabold text-emerald-600">{totalRevenue.toFixed(2)} AED</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl">
                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                            </div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Paid</p>
                        </div>
                        <p className="text-2xl font-extrabold text-green-600">{paidCount}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-xl">
                                <ArrowDownCircle className="w-5 h-5 text-red-600" />
                            </div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Refunded</p>
                        </div>
                        <p className="text-2xl font-extrabold text-red-600">{refundedCount} <span className="text-sm font-normal text-gray-400">({totalRefunded.toFixed(2)} AED)</span></p>
                    </div>
                </div>

                {/* Search & Filter Bar */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name, phone, email, or invoice number..."
                                className="w-full pl-10 p-2.5 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${showFilters || hasActiveFilters
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                                }`}
                        >
                            <Filter className="w-4 h-4" />
                            Filters
                            {hasActiveFilters && <span className="bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">Active</span>}
                            {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        <button onClick={loadInvoices} className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            <RefreshCw className={`w-4 h-4 text-gray-500 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    {/* Expanded Filters */}
                    {showFilters && (
                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1"><Calendar className="w-3 h-3 inline mr-1" />Date From</label>
                                    <input type="date" className="w-full p-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1"><Calendar className="w-3 h-3 inline mr-1" />Date To</label>
                                    <input type="date" className="w-full p-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1"><Phone className="w-3 h-3 inline mr-1" />Phone Number</label>
                                    <input type="tel" placeholder="Search by phone" className="w-full p-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={filterPhone} onChange={e => setFilterPhone(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1"><Mail className="w-3 h-3 inline mr-1" />Email</label>
                                    <input type="email" placeholder="Search by email" className="w-full p-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={filterEmail} onChange={e => setFilterEmail(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1"><Hash className="w-3 h-3 inline mr-1" />Invoice Number</label>
                                    <input type="text" placeholder="BFMC-INV-..." className="w-full p-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={filterInvoice} onChange={e => setFilterInvoice(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1"><CreditCard className="w-3 h-3 inline mr-1" />Payment Method</label>
                                    <select className="w-full p-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={filterPayment} onChange={e => setFilterPayment(e.target.value)}>
                                        <option value="">All Methods</option>
                                        <option value="cash">Cash</option>
                                        <option value="card">Credit Card</option>
                                        <option value="bank_transfer">Bank Transfer</option>
                                        <option value="online">Online</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                                    <select className="w-full p-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={filterRefundStatus} onChange={e => setFilterRefundStatus(e.target.value)}>
                                        <option value="">All Statuses</option>
                                        <option value="none">Paid</option>
                                        <option value="refunded">Refunded</option>
                                    </select>
                                </div>
                                <div className="flex items-end">
                                    <button onClick={clearFilters} className="w-full p-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-medium transition-colors">
                                        Clear All Filters
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Transaction Table */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    {isLoading ? (
                        <div className="p-8 space-y-4">
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="animate-pulse flex items-center gap-4">
                                    <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                                    <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
                                    <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                                    <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                                </div>
                            ))}
                        </div>
                    ) : invoices.length === 0 ? (
                        <div className="p-12 text-center">
                            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">No transactions found</h3>
                            <p className="text-gray-500 dark:text-gray-400 mt-1">Try adjusting your filters or check back later.</p>
                        </div>
                    ) : (
                        <>
                            {/* Table Header */}
                            <div className="hidden md:grid grid-cols-12 gap-2 px-5 py-3 bg-gray-50 dark:bg-gray-750 border-b border-gray-100 dark:border-gray-700 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                <div className="col-span-2">Invoice</div>
                                <div className="col-span-2">Client</div>
                                <div className="col-span-2">Items</div>
                                <div className="col-span-1 text-right">Amount</div>
                                <div className="col-span-1">Method</div>
                                <div className="col-span-1">Date</div>
                                <div className="col-span-1">Status</div>
                                <div className="col-span-1">Received</div>
                                <div className="col-span-1 text-right">Actions</div>
                            </div>

                            {/* Table Rows */}
                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                {invoices.map(inv => (
                                    <div key={inv.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors items-center cursor-pointer" onClick={() => setViewingInvoice(inv)}>
                                        {/* Invoice # */}
                                        <div className="col-span-2">
                                            <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{inv.invoiceNumber}</p>
                                            <p className="text-[10px] text-gray-400">{inv.generatedBy}</p>
                                        </div>
                                        {/* Client */}
                                        <div className="col-span-2">
                                            <p className="font-medium text-sm text-gray-800 dark:text-gray-200 truncate">{inv.clientName}</p>
                                            <p className="text-[10px] text-gray-400 truncate">{inv.clientPhone}{inv.clientEmail ? ` · ${inv.clientEmail}` : ''}</p>
                                        </div>
                                        {/* Items */}
                                        <div className="col-span-2">
                                            <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                                                {inv.items.map(i => i.description).join(', ')}
                                            </p>
                                            {inv.isVoid && <span className="text-[10px] text-red-500 font-bold">VOID</span>}
                                        </div>
                                        {/* Amount */}
                                        <div className="col-span-1 text-right">
                                            <p className={`font-bold text-sm ${inv.refundStatus === 'refunded' ? 'text-red-500 line-through' : 'text-gray-900 dark:text-white'}`}>
                                                {inv.totalAmount.toFixed(2)}
                                            </p>
                                            <p className="text-[10px] text-gray-400">AED</p>
                                        </div>
                                        {/* Payment Method */}
                                        <div className="col-span-1">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                                                inv.paymentMethod === 'card' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                inv.paymentMethod === 'cash' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                inv.paymentMethod === 'online' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                                'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                            }`}>
                                                {paymentMethodLabels[inv.paymentMethod] || inv.paymentMethod}
                                            </span>
                                        </div>
                                        {/* Date */}
                                        <div className="col-span-1">
                                            <p className="text-sm text-gray-700 dark:text-gray-300">{inv.date}</p>
                                        </div>
                                        {/* Payment Status */}
                                        <div className="col-span-1">
                                            {inv.refundStatus === 'refunded' ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                                    <ArrowDownCircle className="w-3 h-3" /> Refunded
                                                </span>
                                            ) : inv.paymentConfirmed ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                    <CheckCircle2 className="w-3 h-3" /> Paid
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                    <Clock className="w-3 h-3" /> Pending
                                                </span>
                                            )}
                                        </div>
                                        {/* Payment Reception */}
                                        <div className="col-span-1">
                                            <span className={`text-xs font-medium ${
                                                inv.paymentReceptionStatus === 'received' ? 'text-green-600' :
                                                inv.paymentReceptionStatus === 'partial' ? 'text-amber-600' :
                                                'text-gray-400'
                                            }`}>
                                                {inv.paymentReceptionStatus === 'received' ? '✓ Received' :
                                                 inv.paymentReceptionStatus === 'partial' ? '⏳ Partial' :
                                                 inv.paymentConfirmed ? '✓ Received' : '⏳ Pending'}
                                            </span>
                                        </div>
                                        {/* Actions */}
                                        <div className="col-span-1 text-right flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={() => setViewingInvoice(inv)}
                                                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
                                                title="View Details"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            {userRole === 'SUPER_ADMIN' && inv.refundStatus !== 'refunded' && (
                                                <button
                                                    onClick={() => openRefundModal(inv)}
                                                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
                                                    title="Process Refund"
                                                >
                                                    <ArrowDownCircle className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="px-5 py-3 bg-gray-50 dark:bg-gray-750 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500">
                                Showing {invoices.length} transaction{invoices.length !== 1 ? 's' : ''}
                            </div>
                        </>
                    )}
                </div>

                {/* ═══════ Transaction Detail Modal ═══════ */}
                {viewingInvoice && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full shadow-2xl my-8">
                            {/* Header */}
                            <div className={`px-6 py-4 rounded-t-2xl ${viewingInvoice.refundStatus === 'refunded' ? 'bg-gradient-to-r from-red-500 to-red-600' : 'bg-gradient-to-r from-indigo-500 to-purple-600'}`}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h2 className="text-xl font-bold text-white">{viewingInvoice.invoiceNumber}</h2>
                                        <p className="text-white/70 text-sm">{viewingInvoice.date}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {viewingInvoice.refundStatus === 'refunded' && (
                                            <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">REFUNDED</span>
                                        )}
                                        <button onClick={() => setViewingInvoice(null)} className="text-white/70 hover:text-white transition-colors">
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 space-y-5">
                                {/* Client Info */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Client</p>
                                        <p className="font-semibold text-gray-900 dark:text-white">{viewingInvoice.clientName}</p>
                                        <p className="text-sm text-gray-500">{viewingInvoice.clientPhone}</p>
                                        {viewingInvoice.clientEmail && <p className="text-sm text-gray-500">{viewingInvoice.clientEmail}</p>}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Payment</p>
                                        <p className="font-semibold text-gray-900 dark:text-white">{paymentMethodLabels[viewingInvoice.paymentMethod]}</p>
                                        <p className="text-sm text-gray-500">Generated by: {viewingInvoice.generatedBy}</p>
                                        {viewingInvoice.clinicName && <p className="text-sm text-gray-500">{viewingInvoice.clinicName}</p>}
                                    </div>
                                </div>

                                {/* Items Table */}
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Items</p>
                                    <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-gray-50 dark:bg-gray-750">
                                                    <th className="text-left px-4 py-2 text-xs font-bold text-gray-500">Description</th>
                                                    <th className="text-right px-4 py-2 text-xs font-bold text-gray-500">Qty</th>
                                                    <th className="text-right px-4 py-2 text-xs font-bold text-gray-500">Price</th>
                                                    <th className="text-right px-4 py-2 text-xs font-bold text-gray-500">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {viewingInvoice.items.map((item, idx) => (
                                                    <tr key={idx} className={`border-t border-gray-100 dark:border-gray-700 ${item.isVoid ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                                                        <td className="px-4 py-2">
                                                            <span className={item.isVoid ? 'line-through text-red-400' : 'text-gray-900 dark:text-white'}>
                                                                {item.description}
                                                            </span>
                                                            {item.isVoid && <span className="ml-2 text-[10px] font-bold text-red-500 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded">VOID</span>}
                                                        </td>
                                                        <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">{item.quantity}</td>
                                                        <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">{item.unitPrice.toFixed(2)}</td>
                                                        <td className="px-4 py-2 text-right font-medium text-gray-900 dark:text-white">{item.total.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Totals */}
                                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 space-y-1 text-sm">
                                    <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{viewingInvoice.subtotal.toFixed(2)} AED</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">VAT ({viewingInvoice.taxPercentage}%)</span><span>{viewingInvoice.taxAmount.toFixed(2)} AED</span></div>
                                    <div className="flex justify-between font-bold text-lg border-t pt-2 dark:border-gray-600">
                                        <span>Total</span>
                                        <span className={viewingInvoice.refundStatus === 'refunded' ? 'text-red-500 line-through' : ''}>{viewingInvoice.totalAmount.toFixed(2)} AED</span>
                                    </div>
                                </div>

                                {/* Refund Details */}
                                {viewingInvoice.refundStatus === 'refunded' && (
                                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                                        <h4 className="font-bold text-red-700 dark:text-red-400 text-sm flex items-center gap-2 mb-2">
                                            <ArrowDownCircle className="w-4 h-4" /> Refund Details
                                        </h4>
                                        <div className="grid grid-cols-2 gap-y-2 text-sm">
                                            <span className="text-gray-500">Amount Refunded:</span>
                                            <span className="font-bold text-red-600">{(viewingInvoice.refundAmount || viewingInvoice.totalAmount).toFixed(2)} AED</span>
                                            <span className="text-gray-500">Reason:</span>
                                            <span className="text-gray-900 dark:text-gray-200">{viewingInvoice.refundReason}</span>
                                            <span className="text-gray-500">Processed by:</span>
                                            <span className="text-gray-900 dark:text-gray-200">{viewingInvoice.refundedBy}</span>
                                            <span className="text-gray-500">Date:</span>
                                            <span className="text-gray-900 dark:text-gray-200">{viewingInvoice.refundedAt ? new Date(viewingInvoice.refundedAt).toLocaleString() : '—'}</span>
                                            {viewingInvoice.refundAccountName && <>
                                                <span className="text-gray-500">Name:</span>
                                                <span className="text-gray-900 dark:text-gray-200">{viewingInvoice.refundAccountName}</span>
                                            </>}
                                            {viewingInvoice.refundIban && <>
                                                <span className="text-gray-500">IBAN:</span>
                                                <span className="text-gray-900 dark:text-gray-200 font-mono text-xs">{viewingInvoice.refundIban}</span>
                                            </>}
                                            {viewingInvoice.refundBankName && <>
                                                <span className="text-gray-500">Bank:</span>
                                                <span className="text-gray-900 dark:text-gray-200">{viewingInvoice.refundBankName}</span>
                                            </>}
                                        </div>
                                    </div>
                                )}

                                {viewingInvoice.notes && (
                                    <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
                                        <span className="font-bold">Notes:</span> {viewingInvoice.notes}
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-700">
                                    <button onClick={() => window.print()} className="text-sm text-gray-500 hover:text-gray-700 font-medium flex items-center gap-1.5">
                                        <FileText className="w-4 h-4" /> Print
                                    </button>
                                    <div className="flex gap-3">
                                        <button onClick={() => setViewingInvoice(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-sm">Close</button>
                                        {viewingInvoice.refundStatus !== 'refunded' && (
                                            <button
                                                onClick={() => { openRefundModal(viewingInvoice); }}
                                                className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors flex items-center gap-2"
                                            >
                                                <ArrowDownCircle className="w-4 h-4" /> Process Refund
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══════ Refund Modal ═══════ */}
                {refundInvoice && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60] overflow-y-auto">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full shadow-2xl">
                            {/* Header */}
                            <div className="px-6 py-4 bg-gradient-to-r from-red-500 to-orange-500 rounded-t-2xl">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                            <ArrowDownCircle className="w-5 h-5" /> Process Refund
                                        </h2>
                                        <p className="text-white/70 text-sm">{refundInvoice.invoiceNumber}</p>
                                    </div>
                                    <button onClick={() => setRefundInvoice(null)} className="text-white/70 hover:text-white">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 space-y-5">
                                {/* Original Transaction Summary */}
                                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4">
                                    <div className="flex justify-between items-center text-sm mb-2">
                                        <span className="text-gray-500">Client</span>
                                        <span className="font-medium text-gray-900 dark:text-white">{refundInvoice.clientName}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm mb-2">
                                        <span className="text-gray-500">Original Amount</span>
                                        <span className="font-bold text-gray-900 dark:text-white">{refundInvoice.totalAmount.toFixed(2)} AED</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500">Payment Method</span>
                                        <span className="font-medium">
                                            {paymentMethodLabels[refundInvoice.paymentMethod]}
                                        </span>
                                    </div>
                                </div>

                                {/* Card refund notice */}
                                {(refundInvoice.paymentMethod === 'card' || refundInvoice.paymentMethod === 'online') && (
                                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3">
                                        <CreditCard className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">Card/Online Payment</p>
                                            <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                                                The refund will be processed through the original payment gateway. The amount will be returned to the customer&apos;s card within 5-14 business days.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Refund Amount */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Refund Amount (AED) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max={refundInvoice.totalAmount}
                                        className="w-full p-3 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white text-lg font-bold focus:ring-2 focus:ring-red-500 outline-none"
                                        value={refundAmount}
                                        onChange={e => setRefundAmount(e.target.value)}
                                    />
                                </div>

                                {/* Refund Reason */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason for Refund *</label>
                                    <textarea
                                        className="w-full p-3 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm focus:ring-2 focus:ring-red-500 outline-none min-h-[80px]"
                                        placeholder="Explain the reason for this refund..."
                                        value={refundReason}
                                        onChange={e => setRefundReason(e.target.value)}
                                    />
                                </div>

                                {/* Bank Info (for cash/bank_transfer payments) */}
                                {(refundInvoice.paymentMethod === 'cash' || refundInvoice.paymentMethod === 'bank_transfer') && (
                                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3">
                                        <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
                                            <Building2 className="w-4 h-4" />
                                            Bank Details Required
                                        </div>
                                        <p className="text-xs text-amber-600 dark:text-amber-500">
                                            Since the payment was made at the clinic, bank details are required to process the refund.
                                        </p>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Account Name *</label>
                                            <input
                                                type="text"
                                                placeholder="Full name as it appears on the bank account"
                                                className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                                value={refundAccountName}
                                                onChange={e => setRefundAccountName(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">IBAN Number *</label>
                                            <input
                                                type="text"
                                                placeholder="AE07 0331 0000 0000 0000 000"
                                                className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm font-mono focus:ring-2 focus:ring-amber-500 outline-none"
                                                value={refundIban}
                                                onChange={e => setRefundIban(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Bank Name *</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Emirates NBD, ADCB, FAB..."
                                                className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                                value={refundBankName}
                                                onChange={e => setRefundBankName(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Error */}
                                {refundError && (
                                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
                                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                        {refundError}
                                    </div>
                                )}

                                {/* Warning */}
                                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3 flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-gray-500">
                                        This action cannot be undone. The transaction will be marked as <strong>refunded</strong> and all items will be marked as <strong>void</strong>.
                                    </p>
                                </div>

                                {/* Actions */}
                                <div className="flex justify-end gap-3">
                                    <button
                                        onClick={() => setRefundInvoice(null)}
                                        className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-sm font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleProcessRefund}
                                        disabled={isProcessingRefund}
                                        className="px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {isProcessingRefund ? (
                                            <><RefreshCw className="w-4 h-4 animate-spin" /> Processing...</>
                                        ) : (
                                            <><Banknote className="w-4 h-4" /> Confirm Refund</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    DollarSign, TrendingUp, TrendingDown, CreditCard, FileText, BarChart3,
    Plus, X, Edit2, Trash2, Search, ArrowUpRight, ArrowDownRight,
    Building2, Receipt, PieChart, Wallet, AlertTriangle, CheckCircle, Clock, Users
} from 'lucide-react';
import type {
    Account, Transaction, Payable, Receivable,
    AccountType, TransactionType, PaymentMethod, InvoiceStatus
} from '@/lib/accounting-store';
import { ACCOUNT_TYPES, DETAIL_TYPES, ACCOUNT_TYPE_LABELS, EMPLOYEE_EXPENSE_CATEGORIES } from '@/lib/accounting-constants';
import { WORKPLACES } from '@/lib/hr-constants';

type TabView = 'dashboard' | 'accounts' | 'transactions' | 'employee_costs' | 'branch_accounts' | 'reports' | 'payables';

export default function AccountingPage() {
    const [tab, setTab] = useState<TabView>('dashboard');
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [reports, setReports] = useState<any>(null);
    const [payRec, setPayRec] = useState<{ payables: Payable[]; receivables: Receivable[] }>({ payables: [], receivables: [] });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [txnTypeFilter, setTxnTypeFilter] = useState('');

    // Modals
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [showTxnModal, setShowTxnModal] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);

    // Forms
    const [acctForm, setAcctForm] = useState({ code: '', name: '', type: 'ASSET' as AccountType, detailType: 'Bank', description: '', balance: 0, isActive: true });
    const emptyTxn = { date: new Date().toISOString().split('T')[0], type: 'INCOME' as TransactionType, description: '', reference: '', accountId: '', amount: 0, paymentMethod: 'CASH' as PaymentMethod, branchId: '', branchName: '', category: '', employeeId: '', employeeName: '', notes: '' };
    const [txnForm, setTxnForm] = useState({ ...emptyTxn });
    const [employees, setEmployees] = useState<{ id: string; firstName: string; lastName: string; employeeCode: string }[]>([]);

    // ── Data Loading ──
    const loadAll = useCallback(async () => {
        const [accRes, txnRes, repRes, prRes, empRes] = await Promise.all([
            fetch('/api/admin/accounting/accounts'),
            fetch('/api/admin/accounting/transactions'),
            fetch('/api/admin/accounting/reports'),
            fetch('/api/admin/accounting/payables'),
            fetch('/api/admin/hr/employees'),
        ]);
        if (accRes.ok) setAccounts(await accRes.json());
        if (txnRes.ok) setTransactions(await txnRes.json());
        if (repRes.ok) setReports(await repRes.json());
        if (prRes.ok) setPayRec(await prRes.json());
        if (empRes.ok) {
            const empData = await empRes.json();
            setEmployees(empData.map((e: any) => ({ id: e.id, firstName: e.firstName, lastName: e.lastName, employeeCode: e.employeeCode })));
        }
        setLoading(false);
    }, []);

    useEffect(() => { loadAll(); }, [loadAll]);

    // ── Account CRUD ──
    const handleSaveAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editingAccount) {
            await fetch(`/api/admin/accounting/accounts/${editingAccount.id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(acctForm),
            });
        } else {
            await fetch('/api/admin/accounting/accounts', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(acctForm),
            });
        }
        setShowAccountModal(false); setEditingAccount(null);
        setAcctForm({ code: '', name: '', type: 'ASSET', detailType: 'Bank', description: '', balance: 0, isActive: true });
        loadAll();
    };

    const handleDeleteAccount = async (id: string) => {
        if (!confirm('Delete this account?')) return;
        await fetch(`/api/admin/accounting/accounts/${id}`, { method: 'DELETE' });
        loadAll();
    };

    // ── Transaction CRUD ──
    const handleSaveTxn = async (e: React.FormEvent) => {
        e.preventDefault();
        const wp = WORKPLACES.find((w: { id: string; name: string }) => w.id === txnForm.branchId);
        const emp = employees.find(e => e.id === txnForm.employeeId);
        const payload = { ...txnForm, branchName: wp?.name || '', employeeName: emp ? `${emp.firstName} ${emp.lastName}` : '' };
        await fetch('/api/admin/accounting/transactions', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
        setShowTxnModal(false);
        setTxnForm({ ...emptyTxn });
        loadAll();
    };

    const handleDeleteTxn = async (id: string) => {
        if (!confirm('Delete this transaction?')) return;
        await fetch(`/api/admin/accounting/transactions/${id}`, { method: 'DELETE' });
        loadAll();
    };

    // ── Helpers ──
    const fmt = (n: number) => `AED ${n.toLocaleString('en-AE', { minimumFractionDigits: 0 })}`;
    const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name || id;

    const getTypeBadge = (type: AccountType) => {
        const map: Record<string, string> = {
            ASSET: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
            LIABILITY: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
            EQUITY: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
            REVENUE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            EXPENSE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
            COST_OF_GOODS_SOLD: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
        };
        return map[type] || '';
    };

    const getStatusBadge = (status: InvoiceStatus) => {
        const map: Record<string, string> = {
            PAID: 'bg-green-100 text-green-700', SENT: 'bg-blue-100 text-blue-700',
            PARTIALLY_PAID: 'bg-amber-100 text-amber-700', OVERDUE: 'bg-red-100 text-red-700',
            DRAFT: 'bg-gray-100 text-gray-600', CANCELLED: 'bg-gray-100 text-gray-400',
        };
        return map[status] || '';
    };

    const filteredAccounts = accounts.filter(a => {
        if (typeFilter && a.type !== typeFilter) return false;
        if (search) {
            const q = search.toLowerCase();
            if (!a.name.toLowerCase().includes(q) && !a.code.includes(q)) return false;
        }
        return true;
    });

    const filteredTxns = transactions.filter(t => {
        if (txnTypeFilter && t.type !== txnTypeFilter) return false;
        if (search) {
            const q = search.toLowerCase();
            if (!t.description.toLowerCase().includes(q) && !(t.reference || '').toLowerCase().includes(q)) return false;
        }
        return true;
    });

    if (loading) {
        return (
            <div className="p-8 flex justify-center items-center min-h-[400px]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
            </div>
        );
    }

    const summary = reports?.summary;

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <header className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <Wallet className="w-8 h-8 text-emerald-600" />
                        Accounting
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Financial management & reporting</p>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit flex-wrap">
                {([
                    { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
                    { key: 'accounts', label: 'Chart of Accounts', icon: Building2 },
                    { key: 'transactions', label: 'Transactions', icon: CreditCard },
                    { key: 'employee_costs', label: 'Employee Costs', icon: Users },
                    { key: 'branch_accounts', label: 'Branch Accounts', icon: Building2 },
                    { key: 'reports', label: 'Reports', icon: PieChart },
                    { key: 'payables', label: 'AP / AR', icon: Receipt },
                ] as { key: TabView; label: string; icon: any }[]).map(t => (
                    <button key={t.key} onClick={() => { setTab(t.key); setSearch(''); setTypeFilter(''); setTxnTypeFilter(''); }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === t.key ? 'bg-white dark:bg-gray-700 text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}>
                        <t.icon className="w-4 h-4" />{t.label}
                    </button>
                ))}
            </div>

            {/* ═══ DASHBOARD ═══ */}
            {tab === 'dashboard' && summary && (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-100 dark:border-emerald-800">
                            <div className="flex items-center gap-2 mb-1"><ArrowUpRight className="w-4 h-4 text-emerald-600" /><span className="text-xs text-gray-500">Total Income</span></div>
                            <p className="text-xl font-bold text-emerald-600">{fmt(summary.totalIncome)}</p>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-100 dark:border-red-800">
                            <div className="flex items-center gap-2 mb-1"><ArrowDownRight className="w-4 h-4 text-red-600" /><span className="text-xs text-gray-500">Total Expenses</span></div>
                            <p className="text-xl font-bold text-red-600">{fmt(summary.totalExpense)}</p>
                        </div>
                        <div className={`rounded-xl p-4 border ${summary.netProfit >= 0 ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800' : 'bg-red-50 dark:bg-red-900/20 border-red-100'}`}>
                            <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-blue-600" /><span className="text-xs text-gray-500">Net Profit</span></div>
                            <p className={`text-xl font-bold ${summary.netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{fmt(summary.netProfit)}</p>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-100 dark:border-purple-800">
                            <div className="flex items-center gap-2 mb-1"><FileText className="w-4 h-4 text-purple-600" /><span className="text-xs text-gray-500">Transactions</span></div>
                            <p className="text-xl font-bold text-purple-600">{summary.transactionCount}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Assets & Liabilities</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-gray-500">Total Assets</span><span className="font-medium text-blue-600">{fmt(summary.totalAssets)}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">Total Liabilities</span><span className="font-medium text-red-600">{fmt(summary.totalLiabilities)}</span></div>
                                <div className="flex justify-between border-t pt-2"><span className="text-gray-500 font-medium">Net Worth</span><span className="font-bold text-gray-900 dark:text-white">{fmt(summary.totalAssets - summary.totalLiabilities)}</span></div>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Accounts Payable</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-gray-500">Outstanding</span><span className="font-medium text-amber-600">{fmt(summary.totalPayable)}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">Overdue</span><span className="font-medium text-red-600">{summary.overduePayables} invoices</span></div>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Accounts Receivable</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-gray-500">Outstanding</span><span className="font-medium text-emerald-600">{fmt(summary.totalReceivable)}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">Overdue</span><span className="font-medium text-red-600">{summary.overdueReceivables} invoices</span></div>
                            </div>
                        </div>
                    </div>

                    {/* Recent Transactions */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                            <h3 className="font-semibold text-gray-900 dark:text-white">Recent Transactions</h3>
                            <button onClick={() => setTab('transactions')} className="text-emerald-600 text-sm hover:underline">View All →</button>
                        </div>
                        <table className="w-full text-left">
                            <thead><tr className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 uppercase">
                                <th className="px-6 py-3">Date</th><th className="px-6 py-3">Description</th><th className="px-6 py-3">Type</th><th className="px-6 py-3">Amount</th>
                            </tr></thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {transactions.slice(0, 5).map(t => (
                                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-6 py-3 text-sm">{new Date(t.date).toLocaleDateString()}</td>
                                        <td className="px-6 py-3 text-sm">
                                            <div className="font-medium">{t.description}</div>
                                            <div className="text-xs text-gray-400">{t.reference}</div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.type === 'INCOME' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {t.type}
                                            </span>
                                        </td>
                                        <td className={`px-6 py-3 text-sm font-medium ${t.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                                            {t.type === 'INCOME' ? '+' : '-'}{fmt(t.amount)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* ═══ CHART OF ACCOUNTS ═══ */}
            {tab === 'accounts' && (
                <>
                    <div className="flex flex-col sm:flex-row gap-3 mb-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input type="text" placeholder="Search accounts..."
                                className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 text-sm"
                                value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <select className="px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 text-sm"
                            value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                            <option value="">All Types</option>
                            {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <button onClick={() => { setAcctForm({ code: '', name: '', type: 'ASSET', detailType: 'Bank', description: '', balance: 0, isActive: true }); setEditingAccount(null); setShowAccountModal(true); }}
                            className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-emerald-700 text-sm">
                            <Plus className="w-4 h-4" /> Add Account
                        </button>
                    </div>

                    {ACCOUNT_TYPES.filter(t => !typeFilter || t === typeFilter).map(type => {
                        const typeAccounts = filteredAccounts.filter(a => a.type === type);
                        if (typeAccounts.length === 0) return null;
                        const total = typeAccounts.reduce((s, a) => s + a.balance, 0);
                        // Group by detailType within each account type
                        const detailGroups: Record<string, Account[]> = {};
                        typeAccounts.forEach(a => {
                            const dt = a.detailType || 'Uncategorised';
                            if (!detailGroups[dt]) detailGroups[dt] = [];
                            detailGroups[dt].push(a);
                        });
                        return (
                            <div key={type} className="mb-8">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-base font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${getTypeBadge(type)}`}>{ACCOUNT_TYPE_LABELS[type] || type}</span>
                                        <span className="text-gray-400 text-sm font-normal">({typeAccounts.length} accounts)</span>
                                    </h3>
                                    <span className="text-sm font-bold">{fmt(total)}</span>
                                </div>
                                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
                                    <table className="w-full text-left">
                                        <thead><tr className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 uppercase">
                                            <th className="px-5 py-2.5 w-20">Code</th><th className="px-5 py-2.5">Name</th><th className="px-5 py-2.5 w-36">Detail Type</th><th className="px-5 py-2.5 w-32 text-right">Balance</th><th className="px-5 py-2.5 w-20">Actions</th>
                                        </tr></thead>
                                        <tbody>
                                            {Object.entries(detailGroups).map(([detailType, accts]) => {
                                                const dtTotal = accts.reduce((s, a) => s + a.balance, 0);
                                                return (
                                                    <React.Fragment key={detailType}>
                                                        <tr className="bg-gray-50/50 dark:bg-gray-700/30">
                                                            <td colSpan={3} className="px-5 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 tracking-wide">
                                                                {detailType}
                                                            </td>
                                                            <td className="px-5 py-2 text-xs font-semibold text-right text-gray-500">{fmt(dtTotal)}</td>
                                                            <td></td>
                                                        </tr>
                                                        {accts.map(a => (
                                                            <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 border-t border-gray-50 dark:border-gray-700/50">
                                                                <td className="px-5 py-2.5 text-sm font-mono text-gray-400 pl-8">{a.code}</td>
                                                                <td className="px-5 py-2.5 text-sm font-medium text-gray-800 dark:text-gray-200">{a.name}</td>
                                                                <td className="px-5 py-2.5 text-xs text-gray-400">{a.detailType}</td>
                                                                <td className={`px-5 py-2.5 text-sm font-medium text-right ${a.balance < 0 ? 'text-red-500' : ''}`}>{fmt(a.balance)}</td>
                                                                <td className="px-5 py-2.5">
                                                                    <div className="flex gap-1">
                                                                        <button onClick={() => {
                                                                            setEditingAccount(a);
                                                                            setAcctForm({ code: a.code, name: a.name, type: a.type, detailType: a.detailType || '', description: a.description || '', balance: a.balance, isActive: a.isActive });
                                                                            setShowAccountModal(true);
                                                                        }} className="text-indigo-600 hover:text-indigo-800 p-1"><Edit2 className="w-3.5 h-3.5" /></button>
                                                                        <button onClick={() => handleDeleteAccount(a.id)} className="text-red-600 hover:text-red-800 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-gray-50 dark:bg-gray-700/50 font-semibold text-sm">
                                                <td className="px-5 py-2.5" colSpan={3}>Total {ACCOUNT_TYPE_LABELS[type]}</td>
                                                <td className="px-5 py-2.5 text-right">{fmt(total)}</td>
                                                <td></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                </>
            )}

            {/* ═══ TRANSACTIONS ═══ */}
            {tab === 'transactions' && (
                <>
                    <div className="flex flex-col sm:flex-row gap-3 mb-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input type="text" placeholder="Search transactions..."
                                className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 text-sm"
                                value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <select className="px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 text-sm"
                            value={txnTypeFilter} onChange={e => setTxnTypeFilter(e.target.value)}>
                            <option value="">All Types</option>
                            <option value="INCOME">Income</option>
                            <option value="EXPENSE">Expense</option>
                            <option value="TRANSFER">Transfer</option>
                            <option value="JOURNAL">Journal</option>
                        </select>
                        <button onClick={() => { setTxnForm({ ...emptyTxn }); setShowTxnModal(true); }}
                            className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-emerald-700 text-sm">
                            <Plus className="w-4 h-4" /> New Transaction
                        </button>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead><tr className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 uppercase">
                                <th className="px-6 py-3">Date</th><th className="px-6 py-3">Description</th><th className="px-6 py-3">Account</th><th className="px-6 py-3">Branch</th><th className="px-6 py-3">Employee</th><th className="px-6 py-3">Type</th><th className="px-6 py-3">Method</th><th className="px-6 py-3">Amount</th><th className="px-6 py-3">Actions</th>
                            </tr></thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filteredTxns.map(t => (
                                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-6 py-3 text-sm">{new Date(t.date).toLocaleDateString()}</td>
                                        <td className="px-6 py-3">
                                            <div className="text-sm font-medium">{t.description}</div>
                                            {t.reference && <div className="text-xs text-gray-400">{t.reference}</div>}
                                        </td>
                                        <td className="px-6 py-3 text-sm text-gray-500">{getAccountName(t.accountId)}</td>
                                        <td className="px-6 py-3 text-sm text-gray-500">{t.branchName || '–'}</td>
                                        <td className="px-6 py-3 text-xs text-gray-500">{t.employeeName || '–'}</td>
                                        <td className="px-6 py-3">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.type === 'INCOME' ? 'bg-green-100 text-green-700' : t.type === 'EXPENSE' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                                {t.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-xs text-gray-500">{(t.paymentMethod || '').replace('_', ' ')}</td>
                                        <td className={`px-6 py-3 text-sm font-semibold ${t.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                                            {t.type === 'INCOME' ? '+' : '-'}{fmt(t.amount)}
                                        </td>
                                        <td className="px-6 py-3">
                                            <button onClick={() => handleDeleteTxn(t.id)} className="text-red-600 hover:text-red-800 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredTxns.length === 0 && <div className="p-8 text-center text-gray-400">No transactions found.</div>}
                    </div>
                </>
            )}

            {/* ═══ REPORTS ═══ */}
            {tab === 'reports' && reports && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Profit & Loss */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-emerald-50 dark:bg-emerald-900/20">
                            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-emerald-600" /> Profit & Loss Statement
                            </h3>
                        </div>
                        <div className="p-6">
                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Revenue</h4>
                            {reports.profitLoss.revenue.map((r: any) => (
                                <div key={r.code} className="flex justify-between py-1.5 text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">{r.code} — {r.name}</span>
                                    <span className="font-medium text-green-600">{fmt(r.amount)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between py-2 border-t border-gray-200 mt-2 font-semibold text-sm">
                                <span>Total Revenue</span><span className="text-green-600">{fmt(reports.profitLoss.totalRevenue)}</span>
                            </div>

                            {reports.profitLoss.cogs && reports.profitLoss.cogs.length > 0 && (
                                <>
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase mt-4 mb-2">Cost of Goods Sold</h4>
                                    {reports.profitLoss.cogs.map((r: any) => (
                                        <div key={r.code} className="flex justify-between py-1.5 text-sm">
                                            <span className="text-gray-600 dark:text-gray-400">{r.code} — {r.name}</span>
                                            <span className="font-medium text-orange-600">{fmt(r.amount)}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between py-2 border-t border-gray-200 mt-2 font-semibold text-sm">
                                        <span>Total COGS</span><span className="text-orange-600">{fmt(reports.profitLoss.totalCOGS)}</span>
                                    </div>
                                    <div className="flex justify-between py-2 border-t-2 border-blue-200 mt-2 font-bold text-sm">
                                        <span>Gross Profit</span><span className="text-blue-600">{fmt(reports.profitLoss.grossProfit)}</span>
                                    </div>
                                </>
                            )}

                            <h4 className="text-xs font-semibold text-gray-500 uppercase mt-4 mb-2">Expenses</h4>
                            {reports.profitLoss.expenses.map((r: any) => (
                                <div key={r.code} className="flex justify-between py-1.5 text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">{r.code} — {r.name}</span>
                                    <span className="font-medium text-red-600">{fmt(r.amount)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between py-2 border-t border-gray-200 mt-2 font-semibold text-sm">
                                <span>Total Expenses</span><span className="text-red-600">{fmt(reports.profitLoss.totalExpenses)}</span>
                            </div>

                            <div className={`flex justify-between py-3 border-t-2 mt-3 font-bold text-lg ${reports.profitLoss.netIncome >= 0 ? 'border-green-300' : 'border-red-300'}`}>
                                <span>Net Income</span>
                                <span className={reports.profitLoss.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}>{fmt(reports.profitLoss.netIncome)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Balance Sheet */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
                            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <PieChart className="w-5 h-5 text-blue-600" /> Balance Sheet
                            </h3>
                        </div>
                        <div className="p-6">
                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Assets</h4>
                            {reports.balanceSheet.assets.map((r: any) => (
                                <div key={r.code} className="flex justify-between py-1.5 text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">{r.code} — {r.name}</span>
                                    <span className="font-medium">{fmt(r.amount)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between py-2 border-t border-gray-200 mt-2 font-semibold text-sm">
                                <span>Total Assets</span><span className="text-blue-600">{fmt(reports.balanceSheet.totalAssets)}</span>
                            </div>

                            <h4 className="text-xs font-semibold text-gray-500 uppercase mt-4 mb-2">Liabilities</h4>
                            {reports.balanceSheet.liabilities.map((r: any) => (
                                <div key={r.code} className="flex justify-between py-1.5 text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">{r.code} — {r.name}</span>
                                    <span className="font-medium">{fmt(r.amount)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between py-2 border-t border-gray-200 mt-2 font-semibold text-sm">
                                <span>Total Liabilities</span><span className="text-red-600">{fmt(reports.balanceSheet.totalLiabilities)}</span>
                            </div>

                            <h4 className="text-xs font-semibold text-gray-500 uppercase mt-4 mb-2">Equity</h4>
                            {reports.balanceSheet.equity.map((r: any) => (
                                <div key={r.code} className="flex justify-between py-1.5 text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">{r.code} — {r.name}</span>
                                    <span className="font-medium">{fmt(r.amount)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between py-2 border-t border-gray-200 mt-2 font-semibold text-sm">
                                <span>Total Equity</span><span className="text-purple-600">{fmt(reports.balanceSheet.totalEquity)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* ═══ Employee Costs ═══ */}
            {tab === 'employee_costs' && reports && (
                <div>
                    {/* Summary Cards */}
                    {(() => {
                        const empExpenses = reports.employeeExpenses || [];
                        const grandTotal = empExpenses.reduce((s: number, e: any) => s + e.total, 0);
                        return (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                                        <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Total Employee Costs</p>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{fmt(grandTotal)}</p>
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                                        <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Employees with Expenses</p>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{empExpenses.length}</p>
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                                        <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Avg. Cost per Employee</p>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{empExpenses.length > 0 ? fmt(Math.round(grandTotal / empExpenses.length)) : 'AED 0'}</p>
                                    </div>
                                </div>

                                {/* Per-Employee Breakdown */}
                                <div className="space-y-4">
                                    {empExpenses.map((emp: any) => {
                                        const catColors: Record<string, string> = {
                                            'Visa Processing': 'bg-blue-500', 'Labour Card': 'bg-indigo-500', 'Emirates ID': 'bg-purple-500',
                                            'Medical Insurance': 'bg-red-500', 'DHA License': 'bg-pink-500', 'Flight Ticket': 'bg-cyan-500',
                                            'Training': 'bg-emerald-500', 'Uniform & Attire': 'bg-amber-500', 'Accommodation': 'bg-orange-500',
                                            'Transportation': 'bg-teal-500', 'Medical Tests': 'bg-rose-500', 'Background Check': 'bg-slate-500',
                                            'Typing & Translation': 'bg-lime-500', 'Other Employee Expense': 'bg-gray-500',
                                        };
                                        const empTxns = transactions.filter(t => t.employeeId === emp.employeeId);

                                        return (
                                            <div key={emp.employeeId} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                                                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-bold text-sm">
                                                            {emp.employeeName.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-gray-900 dark:text-white">{emp.employeeName}</p>
                                                            <p className="text-xs text-gray-500">{Object.keys(emp.categories).length} expense categories</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-lg font-bold text-gray-900 dark:text-white">{fmt(emp.total)}</p>
                                                        <p className="text-xs text-gray-500">{grandTotal > 0 ? `${((emp.total / grandTotal) * 100).toFixed(1)}%` : '0%'} of total</p>
                                                    </div>
                                                </div>

                                                <div className="p-6">
                                                    {/* Category Breakdown */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                                        {Object.entries(emp.categories as Record<string, number>).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => (
                                                            <div key={cat} className="flex items-center gap-3">
                                                                <div className={`w-2.5 h-2.5 rounded-full ${catColors[cat] || 'bg-gray-400'}`} />
                                                                <span className="text-sm text-gray-600 dark:text-gray-400 flex-1">{cat}</span>
                                                                <span className="text-sm font-semibold">{fmt(amount)}</span>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Stacked bar */}
                                                    <div className="flex rounded-full h-3 overflow-hidden bg-gray-100 dark:bg-gray-700 mb-4">
                                                        {Object.entries(emp.categories as Record<string, number>).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => (
                                                            <div key={cat} className={`${catColors[cat] || 'bg-gray-400'} transition-all`}
                                                                style={{ width: `${(amount / emp.total) * 100}%` }}
                                                                title={`${cat}: ${fmt(amount)}`} />
                                                        ))}
                                                    </div>

                                                    {/* Transaction List */}
                                                    <details className="group">
                                                        <summary className="text-xs font-semibold text-emerald-600 cursor-pointer hover:text-emerald-700 select-none">
                                                            View {empTxns.length} Transaction{empTxns.length !== 1 ? 's' : ''} ▾
                                                        </summary>
                                                        <table className="w-full text-left mt-2">
                                                            <thead><tr className="text-xs text-gray-400 uppercase">
                                                                <th className="py-1.5 pr-4">Date</th><th className="py-1.5 pr-4">Description</th><th className="py-1.5 pr-4">Category</th><th className="py-1.5 text-right">Amount</th>
                                                            </tr></thead>
                                                            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                                                                {empTxns.map(t => (
                                                                    <tr key={t.id} className="text-sm">
                                                                        <td className="py-1.5 pr-4 text-gray-500 text-xs">{t.date}</td>
                                                                        <td className="py-1.5 pr-4 text-gray-700 dark:text-gray-300">{t.description}</td>
                                                                        <td className="py-1.5 pr-4 text-xs text-gray-500">{t.category || '—'}</td>
                                                                        <td className="py-1.5 text-right font-medium text-red-600">{fmt(t.amount)}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </details>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {empExpenses.length === 0 && (
                                        <div className="text-center py-12 text-gray-500">
                                            <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                            <p className="font-medium">No employee-linked expenses yet</p>
                                            <p className="text-sm">Link expenses to employees via the Transactions tab</p>
                                        </div>
                                    )}
                                </div>
                            </>
                        );
                    })()}
                </div>
            )}

            {/* ═══ Branch Accounts ═══ */}
            {tab === 'branch_accounts' && reports && (
                <div>
                    {(() => {
                        const branches = reports.branchSummary || [];
                        const totIncome = branches.reduce((s: number, b: any) => s + b.totalIncome, 0);
                        const totExpense = branches.reduce((s: number, b: any) => s + b.totalExpense, 0);
                        const totProfit = totIncome - totExpense;

                        return (
                            <>
                                {/* Grand Totals */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                                        <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Total Income (All Branches)</p>
                                        <p className="text-2xl font-bold text-green-600">{fmt(totIncome)}</p>
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                                        <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Total Expenses (All Branches)</p>
                                        <p className="text-2xl font-bold text-red-600">{fmt(totExpense)}</p>
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                                        <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Overall Profit</p>
                                        <p className={`text-2xl font-bold ${totProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(totProfit)}</p>
                                    </div>
                                </div>

                                {/* Per-Branch Cards */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                    {branches.map((b: any) => {
                                        const profitMargin = b.totalIncome > 0 ? ((b.netProfit / b.totalIncome) * 100).toFixed(1) : '0.0';
                                        const incomeRatio = (b.totalIncome + b.totalExpense) > 0 ? (b.totalIncome / (b.totalIncome + b.totalExpense)) * 100 : 50;

                                        return (
                                            <div key={b.branchId} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                                                {/* Header */}
                                                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20">
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                                                                <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-gray-900 dark:text-white">{b.branchName}</p>
                                                                <p className="text-xs text-gray-500">{b.txnCount} transactions</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className={`text-lg font-bold ${b.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(b.netProfit)}</p>
                                                            <p className="text-xs text-gray-500">{profitMargin}% margin</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="p-6">
                                                    {/* Income / Expense / Profit Row */}
                                                    <div className="grid grid-cols-3 gap-3 mb-4">
                                                        <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                                            <p className="text-xs text-gray-500 mb-1">Income</p>
                                                            <p className="text-sm font-bold text-green-600">{fmt(b.totalIncome)}</p>
                                                        </div>
                                                        <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                                            <p className="text-xs text-gray-500 mb-1">Expenses</p>
                                                            <p className="text-sm font-bold text-red-600">{fmt(b.totalExpense)}</p>
                                                        </div>
                                                        <div className={`text-center p-3 rounded-lg ${b.netProfit >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                                                            <p className="text-xs text-gray-500 mb-1">Net Profit</p>
                                                            <p className={`text-sm font-bold ${b.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(b.netProfit)}</p>
                                                        </div>
                                                    </div>

                                                    {/* Income vs Expense Visual Bar */}
                                                    <div className="flex rounded-full h-3 overflow-hidden bg-gray-100 dark:bg-gray-700 mb-4">
                                                        <div className="bg-green-500 transition-all" style={{ width: `${incomeRatio}%` }} title={`Income: ${fmt(b.totalIncome)}`} />
                                                        <div className="bg-red-400 transition-all" style={{ width: `${100 - incomeRatio}%` }} title={`Expenses: ${fmt(b.totalExpense)}`} />
                                                    </div>

                                                    {/* Category Breakdowns */}
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Income by Category</h4>
                                                            {Object.keys(b.incomeByCategory).length > 0 ? Object.entries(b.incomeByCategory as Record<string, number>).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                                                                <div key={cat} className="flex justify-between py-1 text-xs">
                                                                    <span className="text-gray-600 dark:text-gray-400">{cat}</span>
                                                                    <span className="font-medium text-green-600">{fmt(amt)}</span>
                                                                </div>
                                                            )) : <p className="text-xs text-gray-400 italic">No income yet</p>}
                                                        </div>
                                                        <div>
                                                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Expenses by Category</h4>
                                                            {Object.keys(b.expenseByCategory).length > 0 ? Object.entries(b.expenseByCategory as Record<string, number>).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                                                                <div key={cat} className="flex justify-between py-1 text-xs">
                                                                    <span className="text-gray-600 dark:text-gray-400">{cat}</span>
                                                                    <span className="font-medium text-red-600">{fmt(amt)}</span>
                                                                </div>
                                                            )) : <p className="text-xs text-gray-400 italic">No expenses yet</p>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {branches.length === 0 && (
                                    <div className="text-center py-12 text-gray-500">
                                        <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                        <p className="font-medium">No branch data available</p>
                                        <p className="text-sm">Record transactions with branch assignments to see branch-wise reports</p>
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </div>
            )}

            {/* ═══ AP / AR ═══ */}
            {tab === 'payables' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Accounts Payable */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/20 flex justify-between items-center">
                            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <ArrowDownRight className="w-5 h-5 text-amber-600" /> Accounts Payable
                            </h3>
                        </div>
                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                            {payRec.payables.map(p => (
                                <div key={p.id} className="px-6 py-4">
                                    <div className="flex justify-between items-start mb-1">
                                        <div>
                                            <p className="font-medium text-sm">{p.vendorName}</p>
                                            <p className="text-xs text-gray-500">{p.invoiceNumber}</p>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(p.status)}`}>
                                            {p.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-end mt-2">
                                        <div className="text-xs text-gray-500">Due: {new Date(p.dueDate).toLocaleDateString()}</div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold text-red-600">{fmt(p.amount - p.paidAmount)}</p>
                                            {p.paidAmount > 0 && <p className="text-xs text-gray-400">Paid: {fmt(p.paidAmount)} / {fmt(p.amount)}</p>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {payRec.payables.length === 0 && <p className="p-6 text-center text-gray-400 text-sm">No payables.</p>}
                        </div>
                    </div>

                    {/* Accounts Receivable */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-emerald-50 dark:bg-emerald-900/20 flex justify-between items-center">
                            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <ArrowUpRight className="w-5 h-5 text-emerald-600" /> Accounts Receivable
                            </h3>
                        </div>
                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                            {payRec.receivables.map(r => (
                                <div key={r.id} className="px-6 py-4">
                                    <div className="flex justify-between items-start mb-1">
                                        <div>
                                            <p className="font-medium text-sm">{r.customerName}</p>
                                            <p className="text-xs text-gray-500">{r.invoiceNumber}</p>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(r.status)}`}>
                                            {r.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-end mt-2">
                                        <div className="text-xs text-gray-500">Due: {new Date(r.dueDate).toLocaleDateString()}</div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold text-emerald-600">{fmt(r.amount - r.paidAmount)}</p>
                                            {r.paidAmount > 0 && <p className="text-xs text-gray-400">Paid: {fmt(r.paidAmount)} / {fmt(r.amount)}</p>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {payRec.receivables.length === 0 && <p className="p-6 text-center text-gray-400 text-sm">No receivables.</p>}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ ACCOUNT MODAL ═══ */}
            {showAccountModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg p-6 shadow-xl">
                        <div className="flex justify-between items-center mb-5">
                            <h2 className="text-lg font-bold">{editingAccount ? 'Edit Account' : 'New Account'}</h2>
                            <button onClick={() => { setShowAccountModal(false); setEditingAccount(null); }}><X className="w-5 h-5 text-gray-400" /></button>
                        </div>
                        <form onSubmit={handleSaveAccount} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Code *</label>
                                    <input required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" placeholder="e.g. 5800"
                                        value={acctForm.code} onChange={e => setAcctForm({ ...acctForm, code: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Account Type</label>
                                    <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={acctForm.type} onChange={e => {
                                            const newType = e.target.value as AccountType;
                                            const firstDetail = DETAIL_TYPES[newType]?.[0] || '';
                                            setAcctForm({ ...acctForm, type: newType, detailType: firstDetail });
                                        }}>
                                        {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t] || t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Detail Type</label>
                                    <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={acctForm.detailType} onChange={e => setAcctForm({ ...acctForm, detailType: e.target.value })}>
                                        {(DETAIL_TYPES[acctForm.type] || []).map(dt => <option key={dt} value={dt}>{dt}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium mb-1">Name *</label>
                                    <input required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={acctForm.name} onChange={e => setAcctForm({ ...acctForm, name: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Opening Balance (AED)</label>
                                    <input type="number" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={acctForm.balance} onChange={e => setAcctForm({ ...acctForm, balance: Number(e.target.value) })} />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium mb-1">Description</label>
                                    <input className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={acctForm.description} onChange={e => setAcctForm({ ...acctForm, description: e.target.value })} />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => { setShowAccountModal(false); setEditingAccount(null); }}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                                    {editingAccount ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══ TRANSACTION MODAL ═══ */}
            {showTxnModal && (
                <div className="fixed inset-0 bg-black/50 flex items-start justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl p-6 shadow-xl my-8">
                        <div className="flex justify-between items-center mb-5">
                            <h2 className="text-lg font-bold">New Transaction</h2>
                            <button onClick={() => setShowTxnModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
                        </div>
                        <form onSubmit={handleSaveTxn} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Date *</label>
                                    <input type="date" required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={txnForm.date} onChange={e => setTxnForm({ ...txnForm, date: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Type</label>
                                    <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={txnForm.type} onChange={e => setTxnForm({ ...txnForm, type: e.target.value as TransactionType })}>
                                        <option value="INCOME">Income</option>
                                        <option value="EXPENSE">Expense</option>
                                        <option value="TRANSFER">Transfer</option>
                                        <option value="JOURNAL">Journal</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium mb-1">Description *</label>
                                    <input required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={txnForm.description} onChange={e => setTxnForm({ ...txnForm, description: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Account *</label>
                                    <select required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={txnForm.accountId} onChange={e => setTxnForm({ ...txnForm, accountId: e.target.value })}>
                                        <option value="">Select account...</option>
                                        {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Amount (AED) *</label>
                                    <input type="number" required min="0" step="0.01" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={txnForm.amount} onChange={e => setTxnForm({ ...txnForm, amount: Number(e.target.value) })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Payment Method</label>
                                    <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={txnForm.paymentMethod} onChange={e => setTxnForm({ ...txnForm, paymentMethod: e.target.value as PaymentMethod })}>
                                        <option value="CASH">Cash</option>
                                        <option value="BANK_TRANSFER">Bank Transfer</option>
                                        <option value="CHEQUE">Cheque</option>
                                        <option value="CARD">Card</option>
                                        <option value="ONLINE">Online</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Branch</label>
                                    <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={txnForm.branchId} onChange={e => setTxnForm({ ...txnForm, branchId: e.target.value })}>
                                        <option value="">N/A</option>
                                        {WORKPLACES.map((w: { id: string; name: string }) => <option key={w.id} value={w.id}>{w.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Reference #</label>
                                    <input className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={txnForm.reference} onChange={e => setTxnForm({ ...txnForm, reference: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Category</label>
                                    <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={txnForm.category} onChange={e => setTxnForm({ ...txnForm, category: e.target.value })}>
                                        <option value="">General / Custom</option>
                                        <optgroup label="Employee Expenses">
                                            {EMPLOYEE_EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </optgroup>
                                        <optgroup label="Operations">
                                            <option value="Services">Services</option>
                                            <option value="Products">Products</option>
                                            <option value="Packages">Packages</option>
                                            <option value="Rent">Rent</option>
                                            <option value="Utilities">Utilities</option>
                                            <option value="Salaries">Salaries</option>
                                            <option value="Marketing">Marketing</option>
                                            <option value="Maintenance">Maintenance</option>
                                            <option value="Supplies">Supplies</option>
                                        </optgroup>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Linked Employee</label>
                                    <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={txnForm.employeeId} onChange={e => setTxnForm({ ...txnForm, employeeId: e.target.value })}>
                                        <option value="">None (General Expense)</option>
                                        {employees.map(e => <option key={e.id} value={e.id}>{e.employeeCode} — {e.firstName} {e.lastName}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium mb-1">Notes</label>
                                    <textarea rows={2} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={txnForm.notes} onChange={e => setTxnForm({ ...txnForm, notes: e.target.value })} />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setShowTxnModal(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Create Transaction</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

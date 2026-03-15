'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { LoyaltyTransaction } from '@/lib/loyalty-store';
import { TrendingUp, TrendingDown, Search, Award, AlertTriangle, MapPin, Clock, Calendar, ArrowRight } from 'lucide-react';

export default function LoyaltyPage() {
    const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
    const [searchPhone, setSearchPhone] = useState('');
    const [adjustPhone, setAdjustPhone] = useState('');
    const [adjustPoints, setAdjustPoints] = useState('');
    const [adjustDescription, setAdjustDescription] = useState('');
    const [activeTab, setActiveTab] = useState<'customers' | 'penalties'>('customers');

    const loadTransactions = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/loyalty');
            if (res.ok) {
                const data = await res.json();
                setTransactions(data.transactions || []);
            }
        } catch { /* silent */ }
    }, []);

    useEffect(() => { loadTransactions(); }, [loadTransactions]);

    // Unique customers
    const customerPhones = Array.from(new Set(transactions.map(t => t.customerPhone)));

    const filteredCustomers = searchPhone
        ? customerPhones.filter(p => p.includes(searchPhone))
        : customerPhones;

    const getBalance = (phone: string) =>
        transactions.filter(t => t.customerPhone === phone).reduce((s, t) => s + t.points, 0);

    const getHistory = (phone: string) =>
        transactions.filter(t => t.customerPhone === phone)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const handleAdjust = async () => {
        if (!adjustPhone || !adjustPoints || !adjustDescription) return;
        try {
            await fetch('/api/admin/loyalty', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'manual_adjustment',
                    customerPhone: adjustPhone,
                    points: Number(adjustPoints),
                    description: adjustDescription,
                }),
            });
            await loadTransactions();
        } catch { /* silent */ }
        setAdjustPhone('');
        setAdjustPoints('');
        setAdjustDescription('');
    };

    // Penalty transactions
    const penaltyTypes = ['no_show_penalty', 'reschedule_before_penalty', 'reschedule_after_penalty'];
    const penaltyTransactions = transactions
        .filter(t => penaltyTypes.includes(t.type))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const totalPenaltyPoints = penaltyTransactions.reduce((s, t) => s + Math.abs(t.points), 0);
    const noShowCount = penaltyTransactions.filter(t => t.type === 'no_show_penalty').length;
    const rescheduleCount = penaltyTransactions.filter(t => t.type === 'reschedule_before_penalty' || t.type === 'reschedule_after_penalty').length;

    const penaltyLabel = (type: string) => {
        if (type === 'no_show_penalty') return { label: 'No-Show', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', pts: 50 };
        if (type === 'reschedule_before_penalty') return { label: 'Reschedule (Before)', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', pts: 25 };
        if (type === 'reschedule_after_penalty') return { label: 'Reschedule (After)', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', pts: 40 };
        return { label: type, color: 'bg-gray-100 text-gray-700', pts: 0 };
    };

    const txLabel = (type: string) => {
        if (type === 'referral_reward') return { label: 'Referral', color: 'text-green-600' };
        if (type === 'service_earning') return { label: 'Service', color: 'text-green-600' };
        if (type === 'redemption') return { label: 'Redeemed', color: 'text-orange-600' };
        if (type === 'manual_adjustment') return { label: 'Manual', color: 'text-blue-600' };
        return penaltyLabel(type);
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-6xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <Award className="w-8 h-8 text-indigo-600" />
                        Loyalty & Referral Points
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Manage customer loyalty points, referral rewards, penalties, and redemptions.</p>
                </header>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="text-xs text-gray-500 font-medium">Total Customers</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{customerPhones.length}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="text-xs text-gray-500 font-medium">Points Earned</div>
                        <div className="text-2xl font-bold text-green-600 mt-1">
                            {transactions.filter(t => t.points > 0).reduce((s, t) => s + t.points, 0).toLocaleString()}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="text-xs text-gray-500 font-medium">Points Redeemed</div>
                        <div className="text-2xl font-bold text-orange-600 mt-1">
                            {Math.abs(transactions.filter(t => t.type === 'redemption').reduce((s, t) => s + t.points, 0)).toLocaleString()}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="text-xs text-gray-500 font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-red-500" /> No-Shows</div>
                        <div className="text-2xl font-bold text-red-600 mt-1">{noShowCount}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="text-xs text-gray-500 font-medium">Penalty Points</div>
                        <div className="text-2xl font-bold text-red-600 mt-1">-{totalPenaltyPoints.toLocaleString()}</div>
                    </div>
                </div>

                {/* Penalty Policy Banner */}
                <div className="bg-gradient-to-r from-red-50 to-amber-50 dark:from-red-900/10 dark:to-amber-900/10 border border-red-200 dark:border-red-800/50 rounded-xl p-4 mb-8">
                    <h3 className="text-sm font-bold text-red-800 dark:text-red-300 mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> Loyalty Penalty Policy
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div className="flex items-center gap-2 bg-white/60 dark:bg-gray-800/40 rounded-lg p-2.5">
                            <span className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 font-bold text-sm">-50</span>
                            <div>
                                <p className="font-semibold text-gray-800 dark:text-gray-200">No-Show</p>
                                <p className="text-gray-500">Customer does not show up</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 bg-white/60 dark:bg-gray-800/40 rounded-lg p-2.5">
                            <span className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 font-bold text-sm">-25</span>
                            <div>
                                <p className="font-semibold text-gray-800 dark:text-gray-200">Reschedule (Before)</p>
                                <p className="text-gray-500">Same day, before booked time</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 bg-white/60 dark:bg-gray-800/40 rounded-lg p-2.5">
                            <span className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 font-bold text-sm">-40</span>
                            <div>
                                <p className="font-semibold text-gray-800 dark:text-gray-200">Reschedule (After)</p>
                                <p className="text-gray-500">Same day, after booked time</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
                    <button onClick={() => setActiveTab('customers')}
                        className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'customers' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-700 dark:text-indigo-300' : 'text-gray-500 hover:text-gray-700'}`}>
                        Customers & Points
                    </button>
                    <button onClick={() => setActiveTab('penalties')}
                        className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${activeTab === 'penalties' ? 'bg-white dark:bg-gray-700 shadow-sm text-red-700 dark:text-red-300' : 'text-gray-500 hover:text-gray-700'}`}>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Appointment Penalties
                        {penaltyTransactions.length > 0 && (
                            <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{penaltyTransactions.length}</span>
                        )}
                    </button>
                </div>

                {activeTab === 'customers' && (
                    <>
                        {/* Manual Adjustment */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm mb-6 border border-gray-100 dark:border-gray-700">
                            <h2 className="text-lg font-bold mb-4">Manual Adjustment</h2>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <input type="text" placeholder="Customer Phone" className="p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={adjustPhone} onChange={(e) => setAdjustPhone(e.target.value)} />
                                <input type="number" placeholder="Points (+/-)" className="p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={adjustPoints} onChange={(e) => setAdjustPoints(e.target.value)} />
                                <input type="text" placeholder="Reason / Description" className="p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={adjustDescription} onChange={(e) => setAdjustDescription(e.target.value)} />
                                <button onClick={handleAdjust} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
                                    Apply Adjustment
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">Use positive points to credit, negative to debit. Balance can go negative.</p>
                        </div>

                        {/* Search & Customer List */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text" placeholder="Search by phone..." className="w-full pl-10 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={searchPhone} onChange={(e) => setSearchPhone(e.target.value)}
                                    />
                                </div>
                            </div>

                            {filteredCustomers.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">No loyalty records found.</div>
                            ) : (
                                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {filteredCustomers.map(phone => {
                                        const balance = getBalance(phone);
                                        const history = getHistory(phone);
                                        return (
                                            <div key={phone} className="p-4">
                                                <div className="flex justify-between items-center mb-2">
                                                    <div>
                                                        <span className="font-semibold text-gray-900 dark:text-white">{phone}</span>
                                                        <span className="text-xs text-gray-500 ml-2">({history.length} transactions)</span>
                                                    </div>
                                                    <div className={`text-lg font-bold ${balance >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>{balance.toLocaleString()} pts</div>
                                                </div>
                                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                                    {history.slice(0, 8).map(tx => {
                                                        const info = txLabel(tx.type);
                                                        const isPenalty = penaltyTypes.includes(tx.type);
                                                        return (
                                                            <div key={tx.id} className={`flex justify-between text-xs ${isPenalty ? 'bg-red-50/50 dark:bg-red-900/10 p-1.5 rounded-lg' : 'text-gray-500'}`}>
                                                                <span className="flex items-center gap-1.5">
                                                                    {tx.points > 0 ? <TrendingUp className="w-3 h-3 text-green-500" /> : <TrendingDown className="w-3 h-3 text-red-500" />}
                                                                    <span>{tx.description}</span>
                                                                    {isPenalty && tx.appointmentBranch && (
                                                                        <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{tx.appointmentBranch.replace('clinic-', '')}</span>
                                                                    )}
                                                                </span>
                                                                <span className={tx.points > 0 ? 'text-green-600' : 'text-red-600'}>
                                                                    {tx.points > 0 ? '+' : ''}{tx.points} pts
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {activeTab === 'penalties' && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                                Appointment Penalty Log
                            </h2>
                            <p className="text-xs text-gray-500 mt-1">
                                Automatic deductions from no-shows and same-day reschedules ({penaltyTransactions.length} total, {totalPenaltyPoints} pts deducted)
                            </p>
                        </div>

                        {penaltyTransactions.length === 0 ? (
                            <div className="p-12 text-center">
                                <div className="w-12 h-12 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                </div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">No appointment penalties recorded yet</p>
                                <p className="text-xs text-gray-400 mt-1">Penalties are applied automatically on no-show or same-day reschedule</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                {penaltyTransactions.map(tx => {
                                    const pi = penaltyLabel(tx.type);
                                    const balance = getBalance(tx.customerPhone);
                                    return (
                                        <div key={tx.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    {/* Customer + penalty type */}
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <span className="font-semibold text-gray-900 dark:text-white text-sm">{tx.customerPhone}</span>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pi.color}`}>{pi.label}</span>
                                                    </div>

                                                    {/* Appointment details */}
                                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                                                        {tx.appointmentBranch && (
                                                            <span className="flex items-center gap-1">
                                                                <MapPin className="w-3 h-3 text-indigo-400" />
                                                                {tx.appointmentBranch.replace('clinic-', '').replace(/^\w/, (c: string) => c.toUpperCase())}
                                                            </span>
                                                        )}
                                                        {tx.bookingDate && (
                                                            <span className="flex items-center gap-1">
                                                                <Calendar className="w-3 h-3 text-gray-400" />
                                                                {tx.bookingDate}
                                                            </span>
                                                        )}
                                                        {tx.bookingTime && (
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="w-3 h-3 text-gray-400" />
                                                                {tx.bookingTime}
                                                            </span>
                                                        )}
                                                        {tx.rescheduledTime && (
                                                            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                                                <ArrowRight className="w-3 h-3" />
                                                                {tx.rescheduledDate !== tx.bookingDate ? `${tx.rescheduledDate} ` : ''}{tx.rescheduledTime}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <p className="text-[10px] text-gray-400 mt-1.5">{new Date(tx.createdAt).toLocaleString()}</p>
                                                </div>

                                                {/* Points & balance */}
                                                <div className="text-right shrink-0">
                                                    <p className="text-lg font-bold text-red-600">-{Math.abs(tx.points)}</p>
                                                    <p className="text-[10px] text-gray-400">pts deducted</p>
                                                    <p className={`text-xs font-semibold mt-1 ${balance >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
                                                        Balance: {balance}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

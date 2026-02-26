'use client';

import React, { useState, useEffect } from 'react';
import { useLoyaltyStore, LoyaltyTransaction } from '@/lib/loyalty-store';
import { Gift, TrendingUp, TrendingDown, Search, Award, Plus, Minus } from 'lucide-react';

export default function LoyaltyPage() {
    const { transactions, getBalance, addManualAdjustment, getHistory } = useLoyaltyStore();
    const [searchPhone, setSearchPhone] = useState('');
    const [adjustPhone, setAdjustPhone] = useState('');
    const [adjustPoints, setAdjustPoints] = useState('');
    const [adjustDescription, setAdjustDescription] = useState('');

    // Unique customers
    const customerPhones = Array.from(new Set(transactions.map(t => t.customerPhone)));

    const filteredCustomers = searchPhone
        ? customerPhones.filter(p => p.includes(searchPhone))
        : customerPhones;

    const handleAdjust = () => {
        if (!adjustPhone || !adjustPoints || !adjustDescription) return;
        addManualAdjustment(adjustPhone, Number(adjustPoints), adjustDescription);
        setAdjustPhone('');
        setAdjustPoints('');
        setAdjustDescription('');
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-6xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <Award className="w-8 h-8 text-indigo-600" />
                        Loyalty & Referral Points
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Manage customer loyalty points, referral rewards, and redemptions.</p>
                </header>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="text-sm text-gray-500">Total Customers</div>
                        <div className="text-3xl font-bold text-gray-900 dark:text-white">{customerPhones.length}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="text-sm text-gray-500">Total Points Earned</div>
                        <div className="text-3xl font-bold text-green-600">
                            {transactions.filter(t => t.points > 0).reduce((s, t) => s + t.points, 0).toLocaleString()}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="text-sm text-gray-500">Total Points Redeemed</div>
                        <div className="text-3xl font-bold text-orange-600">
                            {Math.abs(transactions.filter(t => t.points < 0).reduce((s, t) => s + t.points, 0)).toLocaleString()}
                        </div>
                    </div>
                </div>

                {/* Manual Adjustment */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm mb-8 border border-gray-100 dark:border-gray-700">
                    <h2 className="text-lg font-bold mb-4">Manual Adjustment</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <input type="text" placeholder="Customer Phone" className="p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={adjustPhone} onChange={(e) => setAdjustPhone(e.target.value)} />
                        <input type="number" placeholder="Points (+/-)" className="p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={adjustPoints} onChange={(e) => setAdjustPoints(e.target.value)} />
                        <input type="text" placeholder="Reason / Description" className="p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={adjustDescription} onChange={(e) => setAdjustDescription(e.target.value)} />
                        <button onClick={handleAdjust} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
                            Apply Adjustment
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Use positive points to credit, negative to debit.</p>
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
                                            <div className="text-lg font-bold text-indigo-600">{balance.toLocaleString()} pts</div>
                                        </div>
                                        <div className="space-y-1 max-h-32 overflow-y-auto">
                                            {history.slice(0, 5).map(tx => (
                                                <div key={tx.id} className="flex justify-between text-xs text-gray-500">
                                                    <span className="flex items-center gap-1">
                                                        {tx.points > 0 ? <TrendingUp className="w-3 h-3 text-green-500" /> : <TrendingDown className="w-3 h-3 text-red-500" />}
                                                        {tx.description}
                                                    </span>
                                                    <span className={tx.points > 0 ? 'text-green-600' : 'text-red-600'}>
                                                        {tx.points > 0 ? '+' : ''}{tx.points} pts
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

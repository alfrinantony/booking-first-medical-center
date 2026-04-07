'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CalendarDays, ArrowLeft, Trash2, Plus, AlertCircle } from 'lucide-react';
import type { PublicHoliday } from '@/lib/hr-calendar-store';

export default function HRCalendarPage() {
    const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
    const [loading, setLoading] = useState(true);
    const [date, setDate] = useState('');
    const [name, setName] = useState('');
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState('');

    const loadHolidays = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/hr/calendar');
            if (res.ok) {
                setHolidays(await res.json());
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadHolidays();
    }, [loadHolidays]);

    const handleAddHoliday = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!date || !name) {
            setError('Please provide both date and name.');
            return;
        }

        setAdding(true);
        try {
            const res = await fetch('/api/admin/hr/calendar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date, name })
            });

            if (res.ok) {
                setDate('');
                setName('');
                await loadHolidays();
            } else {
                setError('Failed to add holiday.');
            }
        } catch (err) {
            setError('An error occurred.');
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this holiday?')) return;
        
        try {
            const res = await fetch(`/api/admin/hr/calendar?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                await loadHolidays();
            }
        } catch (err) {
            console.error('Failed to delete', err);
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="mb-6">
                <Link href="/admin/hr" className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mb-3">
                    <ArrowLeft className="w-4 h-4" /> Back to HR Dashboard
                </Link>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                    <CalendarDays className="w-8 h-8 text-indigo-600" /> HR Calendar
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Manage public holidays. Automatically updates duty hour deductions for employee payslips.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <Plus className="w-5 h-5 text-indigo-600" /> Add Holiday
                        </h2>
                        {error && (
                            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-600 text-sm p-3 rounded-lg flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 mt-0.5" />
                                {error}
                            </div>
                        )}
                        <form onSubmit={handleAddHoliday} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                                <input
                                    type="date"
                                    required
                                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Holiday Name</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Eid Al Fitr"
                                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={adding}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                            >
                                {adding ? 'Adding...' : 'Add Holiday'}
                            </button>
                        </form>
                    </div>
                </div>

                <div className="md:col-span-2">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Upcoming & Past Holidays</h2>
                        
                        {loading ? (
                            <div className="flex justify-center p-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                            </div>
                        ) : holidays.length === 0 ? (
                            <div className="text-center p-8 text-gray-500 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                No holidays configured.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 uppercase">
                                            <th className="p-3 font-medium">Date</th>
                                            <th className="p-3 font-medium">Holiday Name</th>
                                            <th className="p-3 font-medium text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {holidays.map(holiday => (
                                            <tr key={holiday.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <td className="p-3 text-sm text-gray-900 dark:text-white font-medium">
                                                    {new Date(holiday.date).toLocaleDateString('en-AE', { 
                                                        year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' 
                                                    })}
                                                </td>
                                                <td className="p-3 text-sm text-gray-600 dark:text-gray-300">
                                                    {holiday.name}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <button 
                                                        onClick={() => handleDelete(holiday.id)}
                                                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                        title="Delete Holiday"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

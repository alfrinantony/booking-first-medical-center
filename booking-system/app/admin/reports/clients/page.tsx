'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Users, Search, Loader2 } from 'lucide-react';

export default function ClientsReport() {
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        setLoading(true);
        fetch('/api/admin/clients')
            .then(res => res.json())
            .then(data => setClients(Array.isArray(data) ? data : []))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    const filteredClients = useMemo(() => {
        return clients.filter(c => {
            if (!search) return true;
            return (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
                   (c.phone || '').includes(search) ||
                   (c.email || '').toLowerCase().includes(search.toLowerCase());
        }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [clients, search]);

    return (
        <div className="p-4 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Users className="w-6 h-6 text-indigo-500" /> Client Report
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">View and filter synced clients.</p>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="max-w-md">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Search</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, email..."
                            className="w-full pl-9 p-2 border rounded-xl bg-gray-50 dark:bg-gray-700 text-sm" />
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                {loading ? (
                    <div className="py-20 text-center text-gray-500 flex flex-col items-center">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
                        Loading clients...
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 text-xs uppercase font-semibold">
                                <tr>
                                    <th className="px-4 py-3">Name</th>
                                    <th className="px-4 py-3">Phone</th>
                                    <th className="px-4 py-3">Email</th>
                                    <th className="px-4 py-3">Total Bookings</th>
                                    <th className="px-4 py-3">Source</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filteredClients.map((c, i) => (
                                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-4 py-3 font-medium">{c.name}</td>
                                        <td className="px-4 py-3">{c.phone || c.whatsapp || c.mobile || '—'}</td>
                                        <td className="px-4 py-3 text-gray-500">{c.email || '—'}</td>
                                        <td className="px-4 py-3 font-semibold text-indigo-600">{c.totalBookings || 0}</td>
                                        <td className="px-4 py-3">
                                            {c.source === 'simplybook' ? <span className="text-indigo-500 font-semibold text-xs">SimplyBook</span> : <span className="text-gray-400 text-xs">Direct</span>}
                                        </td>
                                    </tr>
                                ))}
                                {filteredClients.length === 0 && (
                                    <tr><td colSpan={5} className="text-center py-10 text-gray-500">No clients found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

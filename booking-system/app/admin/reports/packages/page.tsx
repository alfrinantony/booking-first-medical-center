'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Package, Search, Loader2 } from 'lucide-react';

export default function PackagesReport() {
    const [packages, setPackages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        setLoading(true);
        fetch('/api/admin/packages')
            .then(res => res.json())
            .then(data => setPackages(Array.isArray(data) ? data : []))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    const filteredPackages = useMemo(() => {
        return packages.filter(p => {
            if (!search) return true;
            return (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
                   (p.description || '').toLowerCase().includes(search.toLowerCase());
        });
    }, [packages, search]);

    return (
        <div className="p-4 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Package className="w-6 h-6 text-indigo-500" /> Package Report
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">View active packages and their services.</p>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="max-w-md">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Search</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search package name..."
                            className="w-full pl-9 p-2 border rounded-xl bg-gray-50 dark:bg-gray-700 text-sm" />
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                {loading ? (
                    <div className="py-20 text-center text-gray-500 flex flex-col items-center">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
                        Loading packages...
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 text-xs uppercase font-semibold">
                                <tr>
                                    <th className="px-4 py-3">Package Name</th>
                                    <th className="px-4 py-3">Price</th>
                                    <th className="px-4 py-3">Duration (Days)</th>
                                    <th className="px-4 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filteredPackages.map((p, i) => (
                                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-4 py-3 font-medium">{p.name}</td>
                                        <td className="px-4 py-3 font-semibold text-indigo-600">{p.price} AED</td>
                                        <td className="px-4 py-3">{p.validityDays || p.durationDays || '∞'}</td>
                                        <td className="px-4 py-3">
                                            {p.isActive !== false ? <span className="text-emerald-500 font-semibold text-xs">Active</span> : <span className="text-red-400 text-xs">Inactive</span>}
                                        </td>
                                    </tr>
                                ))}
                                {filteredPackages.length === 0 && (
                                    <tr><td colSpan={4} className="text-center py-10 text-gray-500">No packages found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

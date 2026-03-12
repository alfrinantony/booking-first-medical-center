'use client';

import React, { useState, useEffect } from 'react';
import { ClipboardList, Search, Filter, Clock } from 'lucide-react';

interface LogEntry {
    id: string;
    timestamp: string;
    userId: string;
    userName?: string;
    action: string;
    details: string;
    entityId?: string;
    entityType?: string;
}

export default function LogsPage() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterAction, setFilterAction] = useState('ALL');

    const fetchLogs = () => {
        fetch('/api/admin/logs')
            .then(r => r.json())
            .then(data => setLogs(Array.isArray(data) ? data : []))
            .catch(() => {});
    };

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 5000); // Auto-refresh every 5s
        return () => clearInterval(interval);
    }, []);

    const uniqueActions = Array.from(new Set(logs.map(l => l.action)));

    const filteredLogs = logs.filter(log => {
        const matchesSearch =
            log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.entityId?.includes(searchQuery);

        const matchesFilter = filterAction === 'ALL' || log.action === filterAction;

        return matchesSearch && matchesFilter;
    });

    const formatDate = (isoString: string) => {
        return new Date(isoString).toLocaleString();
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <ClipboardList className="w-6 h-6 text-indigo-600" />
                    Audit Logs
                </h1>
                <div className="text-sm text-gray-500">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Auto-refreshing
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search logs by detail, user, or ID..."
                        className="w-full pl-10 p-2.5 border rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="w-full md:w-64">
                    <div className="relative">
                        <Filter className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                        <select
                            className="w-full pl-10 p-2.5 border rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                            value={filterAction}
                            onChange={(e) => setFilterAction(e.target.value)}
                        >
                            <option value="ALL">All Actions</option>
                            {uniqueActions.map(action => (
                                <option key={action} value={action}>{action}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Logs Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 text-sm">
                        <tr>
                            <th className="p-4">Timestamp</th>
                            <th className="p-4">User</th>
                            <th className="p-4">Action</th>
                            <th className="p-4">Details</th>
                            <th className="p-4">Entity ID</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700 font-mono text-sm">
                        {filteredLogs.map(log => (
                            <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                <td className="p-4 text-gray-500 whitespace-nowrap">
                                    {formatDate(log.timestamp)}
                                </td>
                                <td className="p-4 font-semibold text-gray-700 dark:text-gray-200">
                                    {log.userName || log.userId}
                                </td>
                                <td className="p-4">
                                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${log.action.includes('CREATE') ? 'bg-green-100 text-green-700' :
                                            log.action.includes('UPDATE') ? 'bg-blue-100 text-blue-700' :
                                                log.action.includes('DELETE') || log.action.includes('MERGE') ? 'bg-amber-100 text-amber-700' :
                                                    'bg-gray-100 text-gray-700'
                                        }`}>
                                        {log.action}
                                    </span>
                                </td>
                                <td className="p-4 text-gray-600 dark:text-gray-300">
                                    {log.details}
                                </td>
                                <td className="p-4 text-xs text-gray-400">
                                    {log.entityType}: {log.entityId}
                                </td>
                            </tr>
                        ))}
                        {filteredLogs.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-gray-500">
                                    No logs found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

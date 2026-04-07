'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Users, AlertTriangle, UserPlus, Calculator,
    Clock, FileWarning, ChevronRight, Briefcase,
    CheckCircle, UserX, Coffee
} from 'lucide-react';

interface ExpiryAlert {
    id: string;
    employeeId: string;
    employeeName: string;
    employeeCode: string;
    documentType: string;
    expiryDate: string;
    daysRemaining?: number;
    daysOverdue?: number;
}

interface Stats {
    total: number;
    active: number;
    onLeave: number;
    terminated: number;
    resigned: number;
}

export default function HRDashboardPage() {
    const [stats, setStats] = useState<Stats>({ total: 0, active: 0, onLeave: 0, terminated: 0, resigned: 0 });
    const [expiringSoon, setExpiringSoon] = useState<ExpiryAlert[]>([]);
    const [expired, setExpired] = useState<ExpiryAlert[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [empRes, notifRes] = await Promise.all([
                fetch('/api/admin/hr/employees'),
                fetch('/api/admin/hr/notifications?days=90'),
            ]);

            if (empRes.ok) {
                const employees = await empRes.json();
                setStats({
                    total: employees.length,
                    active: employees.filter((e: any) => e.status === 'ACTIVE').length,
                    onLeave: employees.filter((e: any) => e.status === 'ON_LEAVE').length,
                    terminated: employees.filter((e: any) => e.status === 'TERMINATED').length,
                    resigned: employees.filter((e: any) => e.status === 'RESIGNED').length,
                });
            }

            if (notifRes.ok) {
                const data = await notifRes.json();
                setExpiringSoon(data.expiringSoon || []);
                setExpired(data.expired || []);
            }
        } catch (err) {
            console.error('Failed to load HR data:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <header className="mb-8">
                <div className="flex items-center gap-3 mb-1">
                    <Briefcase className="w-8 h-8 text-indigo-600" />
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">HR Management</h1>
                </div>
                <p className="text-gray-600 dark:text-gray-400">Employee management, documents, payroll & compliance</p>
            </header>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                        <Users className="w-8 h-8 text-indigo-500" />
                        <span className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total}</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Employees</p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                        <CheckCircle className="w-8 h-8 text-green-500" />
                        <span className="text-3xl font-bold text-green-600">{stats.active}</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                        <Coffee className="w-8 h-8 text-amber-500" />
                        <span className="text-3xl font-bold text-amber-600">{stats.onLeave}</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">On Leave</p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                        <UserX className="w-8 h-8 text-red-500" />
                        <span className="text-3xl font-bold text-red-600">{stats.terminated + stats.resigned}</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Separated</p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                        <AlertTriangle className="w-8 h-8 text-orange-500" />
                        <span className="text-3xl font-bold text-orange-600">{expiringSoon.length + expired.length}</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Doc Alerts</p>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <Link href="/admin/hr/employees"
                    className="flex items-center gap-4 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-xl p-5 transition-colors group"
                >
                    <UserPlus className="w-10 h-10 text-indigo-600 flex-shrink-0" />
                    <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">Manage Employees</h3>
                        <p className="text-sm text-gray-500">Add, edit, view profiles</p>
                    </div>
                </Link>

                <Link href="/admin/hr/payroll"
                    className="flex items-center gap-4 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-xl p-5 transition-colors group"
                >
                    <Calculator className="w-10 h-10 text-green-600 flex-shrink-0" />
                    <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">Payroll & EOS</h3>
                        <p className="text-sm text-gray-500">Calculate salary & leave</p>
                    </div>
                </Link>

                <Link href="/admin/hr/calendar"
                    className="flex items-center gap-4 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-xl p-5 transition-colors group"
                >
                    <Clock className="w-10 h-10 text-blue-600 flex-shrink-0" />
                    <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">HR Calendar</h3>
                        <p className="text-sm text-gray-500">Manage public holidays</p>
                    </div>
                </Link>

                <div className="flex items-center gap-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl p-5">
                    <FileWarning className="w-10 h-10 text-orange-600 flex-shrink-0" />
                    <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">Doc Alerts</h3>
                        <p className="text-sm text-gray-500">{expired.length} expired, {expiringSoon.length} expiring</p>
                    </div>
                </div>
            </div>

            {/* Expired Documents */}
            {expired.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-lg font-semibold text-red-600 mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Expired Documents ({expired.length})
                    </h2>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-red-200 dark:border-red-800 overflow-hidden">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-red-50 dark:bg-red-900/20 text-xs text-red-700 dark:text-red-400 uppercase">
                                    <th className="px-6 py-3">Employee</th>
                                    <th className="px-6 py-3">Document</th>
                                    <th className="px-6 py-3">Expired On</th>
                                    <th className="px-6 py-3">Overdue</th>
                                    <th className="px-6 py-3">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-red-100 dark:divide-red-900/30">
                                {expired.map(doc => (
                                    <tr key={doc.id} className="hover:bg-red-50/50 dark:hover:bg-red-900/10">
                                        <td className="px-6 py-3">
                                            <div className="font-medium text-gray-900 dark:text-white">{doc.employeeName}</div>
                                            <div className="text-xs text-gray-500">{doc.employeeCode}</div>
                                        </td>
                                        <td className="px-6 py-3 text-sm">{doc.documentType}</td>
                                        <td className="px-6 py-3 text-sm">{new Date(doc.expiryDate!).toLocaleDateString()}</td>
                                        <td className="px-6 py-3">
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                                                {doc.daysOverdue} days
                                            </span>
                                        </td>
                                        <td className="px-6 py-3">
                                            <Link href={`/admin/hr/employees/${doc.employeeId}`}
                                                className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                                                View →
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Expiring Soon */}
            {expiringSoon.length > 0 && (
                <div>
                    <h2 className="text-lg font-semibold text-amber-600 mb-3 flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        Expiring Soon ({expiringSoon.length})
                    </h2>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-amber-200 dark:border-amber-800 overflow-hidden">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-amber-50 dark:bg-amber-900/20 text-xs text-amber-700 dark:text-amber-400 uppercase">
                                    <th className="px-6 py-3">Employee</th>
                                    <th className="px-6 py-3">Document</th>
                                    <th className="px-6 py-3">Expires On</th>
                                    <th className="px-6 py-3">Days Left</th>
                                    <th className="px-6 py-3">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-amber-100 dark:divide-amber-900/30">
                                {expiringSoon.map(doc => (
                                    <tr key={doc.id} className="hover:bg-amber-50/50 dark:hover:bg-amber-900/10">
                                        <td className="px-6 py-3">
                                            <div className="font-medium text-gray-900 dark:text-white">{doc.employeeName}</div>
                                            <div className="text-xs text-gray-500">{doc.employeeCode}</div>
                                        </td>
                                        <td className="px-6 py-3 text-sm">{doc.documentType}</td>
                                        <td className="px-6 py-3 text-sm">{new Date(doc.expiryDate!).toLocaleDateString()}</td>
                                        <td className="px-6 py-3">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${doc.daysRemaining! <= 7
                                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                                    : doc.daysRemaining! <= 30
                                                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                                        : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                                }`}>
                                                {doc.daysRemaining} days
                                            </span>
                                        </td>
                                        <td className="px-6 py-3">
                                            <Link href={`/admin/hr/employees/${doc.employeeId}`}
                                                className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                                                View →
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {expired.length === 0 && expiringSoon.length === 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-8 text-center">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-green-700 dark:text-green-400">All Clear!</h3>
                    <p className="text-sm text-green-600 dark:text-green-500">No document expiry alerts at this time.</p>
                </div>
            )}
        </div>
    );
}

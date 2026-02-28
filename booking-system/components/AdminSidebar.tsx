'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Users, Calendar, Activity, BarChart2, MapPin, Tag, Stethoscope, Lock, Inbox, Settings, Package as PackageIcon, ClipboardList, Bell, Pill, Truck, ShoppingCart, LogOut, Phone, ShieldCheck, Gift, Receipt, Link2, Briefcase, Calculator, UserPlus, Wallet } from 'lucide-react';
import { User } from '@/lib/users-store';

export default function AdminSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const stored = sessionStorage.getItem('adminUser');
        if (stored) {
            setUser(JSON.parse(stored));
        }
    }, []);

    // Simple check for active link
    const isActive = (path: string) => pathname === path || pathname?.startsWith(path + '/');

    const canManageStaff = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

    const handleSignOut = () => {
        sessionStorage.removeItem('adminUser');
        router.push('/admin/login');
    };

    return (
        <aside className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-gray-800 shadow-md transform hidden md:translate-x-0 md:block z-30 flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h1 className="text-xl font-bold text-indigo-600 dark:text-indigo-400">MedAdmin</h1>
                <div className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    {user?.role || 'Guest'}
                </div>
            </div>
            <nav className="mt-6 px-4 space-y-2">
                <Link
                    href="/admin"
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${pathname === '/admin'
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                >
                    <Activity className="w-5 h-5" />
                    Dashboard
                </Link>

                <Link
                    href="/admin/appointments"
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${isActive('/admin/appointments')
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                >
                    <Calendar className="w-5 h-5" />
                    Appointments
                </Link>

                <Link
                    href="/admin/clients"
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${isActive('/admin/clients')
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                >
                    <Users className="w-5 h-5" />
                    Clients
                </Link>

                <Link
                    href="/admin/registered-users"
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${isActive('/admin/registered-users')
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                >
                    <ShieldCheck className="w-5 h-5" />
                    Registered Users
                </Link>

                <Link
                    href="/admin/schedule"
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${isActive('/admin/schedule')
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                >
                    <Calendar className="w-5 h-5" />
                    Staff Schedule
                </Link>

                <Link
                    href="/admin/doctors"
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${isActive('/admin/doctors')
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                >
                    <Stethoscope className="w-5 h-5" />
                    Doctors
                </Link>

                <Link
                    href="/admin/services"
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${isActive('/admin/services')
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                >
                    <Activity className="w-5 h-5" />
                    Services
                </Link>

                <Link
                    href="/admin/medicines"
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${isActive('/admin/medicines')
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                >
                    <Pill className="w-5 h-5" />
                    Inventory
                </Link>

                <Link
                    href="/admin/suppliers"
                    className={`flex items-center gap-3 px-4 py-3 pl-12 rounded-lg font-medium text-sm transition-colors ${isActive('/admin/suppliers')
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                >
                    <Truck className="w-4 h-4" />
                    Suppliers
                </Link>

                <Link
                    href="/admin/product-registry"
                    className={`flex items-center gap-3 px-4 py-3 pl-12 rounded-lg font-medium text-sm transition-colors ${isActive('/admin/product-registry')
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                >
                    <ClipboardList className="w-4 h-4" />
                    Product Registry
                </Link>

                <Link
                    href="/admin/purchases"
                    className={`flex items-center gap-3 px-4 py-3 pl-12 rounded-lg font-medium text-sm transition-colors ${isActive('/admin/purchases')
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                >
                    <ShoppingCart className="w-4 h-4" />
                    Purchases
                </Link>

                <Link
                    href="/admin/clinics"
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${isActive('/admin/clinics')
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                >
                    <MapPin className="w-5 h-5" />
                    Branches
                </Link>

                <Link
                    href="/admin/contracts"
                    className={`flex items-center gap-3 px-4 py-3 pl-12 rounded-lg font-medium text-sm transition-colors ${isActive('/admin/contracts')
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                >
                    <ClipboardList className="w-4 h-4" />
                    Contracts
                </Link>

                <Link
                    href="/admin/packages"
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${isActive('/admin/packages')
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                >
                    <PackageIcon className="w-5 h-5" />
                    Packages
                </Link>

                <Link
                    href="/admin/loyalty"
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${isActive('/admin/loyalty')
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                >
                    <Gift className="w-5 h-5" />
                    Loyalty Points
                </Link>

                <Link
                    href="/admin/billing"
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${isActive('/admin/billing')
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                >
                    <Receipt className="w-5 h-5" />
                    Billing
                </Link>

                <Link
                    href="/admin/client-grouping"
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${isActive('/admin/client-grouping')
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                >
                    <Link2 className="w-5 h-5" />
                    Client Grouping
                </Link>

                <Link
                    href="/admin/inbox"
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${isActive('/admin/inbox')
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                >
                    <Inbox className="w-5 h-5" />
                    Inbox
                </Link>

                <Link
                    href="/admin/promos"
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${isActive('/admin/promos')
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                >
                    <Tag className="w-5 h-5" />
                    Promo Codes
                </Link>

                <Link
                    href="/admin/settings"
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${isActive('/admin/settings')
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                >
                    <Settings className="w-5 h-5" />
                    Settings
                </Link>

                <Link
                    href="/admin/settings/notifications"
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${isActive('/admin/settings/notifications')
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                >
                    <Bell className="w-5 h-5" />
                    Notifications
                </Link>

                <Link
                    href="/admin/logs"
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${isActive('/admin/logs')
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                >
                    <ClipboardList className="w-5 h-5" />
                    Audit Logs
                </Link>

                <Link
                    href="/admin/call-agent-summaries"
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${isActive('/admin/call-agent-summaries')
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                >
                    <Phone className="w-5 h-5" />
                    Call Agent Summary
                </Link>

                <Link
                    href="/admin/reports"
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${isActive('/admin/reports')
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                >
                    <BarChart2 className="w-5 h-5" />
                    Reports
                </Link>

                {canManageStaff && (
                    <>
                        <Link
                            href="/admin/hr"
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${isActive('/admin/hr') && !isActive('/admin/hr/')
                                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                        >
                            <Briefcase className="w-5 h-5" />
                            HR Management
                        </Link>

                        <Link
                            href="/admin/hr/employees"
                            className={`flex items-center gap-3 px-4 py-3 pl-12 rounded-lg font-medium text-sm transition-colors ${isActive('/admin/hr/employees')
                                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                        >
                            <Users className="w-4 h-4" />
                            Employees
                        </Link>

                        <Link
                            href="/admin/hr/payroll"
                            className={`flex items-center gap-3 px-4 py-3 pl-12 rounded-lg font-medium text-sm transition-colors ${isActive('/admin/hr/payroll')
                                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                        >
                            <Calculator className="w-4 h-4" />
                            Payroll
                        </Link>

                        <Link
                            href="/admin/hr/letters"
                            className={`flex items-center gap-3 px-4 py-3 pl-12 rounded-lg font-medium text-sm transition-colors ${isActive('/admin/hr/letters')
                                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                        >
                            <ClipboardList className="w-4 h-4" />
                            Letters
                        </Link>

                        <Link
                            href="/admin/hr/recruitment"
                            className={`flex items-center gap-3 px-4 py-3 pl-12 rounded-lg font-medium text-sm transition-colors ${isActive('/admin/hr/recruitment')
                                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                        >
                            <UserPlus className="w-4 h-4" />
                            Recruitment
                        </Link>
                    </>
                )}

                <Link
                    href="/admin/accounting"
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${isActive('/admin/accounting')
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                >
                    <Wallet className="w-5 h-5" />
                    Accounting
                </Link>

                {canManageStaff && (
                    <Link
                        href="/admin/staff"
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${isActive('/admin/staff')
                            ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                    >
                        <Lock className="w-5 h-5" />
                        Staff Access
                    </Link>
                )}
            </nav>

            {/* Sign Out Button */}
            <div className="mt-auto p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="px-4 py-2 mb-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user?.name || 'Admin'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.username || ''}</p>
                </div>
                <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-lg font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    Sign Out
                </button>
            </div>
        </aside>
    );
}

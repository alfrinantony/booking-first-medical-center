'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Users, Calendar, Activity, BarChart2, MapPin, Tag, Stethoscope, Lock, Inbox, Settings, Package as PackageIcon, ClipboardList, Bell, Pill, Truck, ShoppingCart, LogOut, Phone, ShieldCheck, Gift, Receipt, Link2, Briefcase, Calculator, UserPlus, Wallet, Menu, X } from 'lucide-react';
import { User } from '@/lib/users-store';

export default function AdminSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const stored = sessionStorage.getItem('adminUser');
        if (stored) {
            setUser(JSON.parse(stored));
        }
    }, []);

    // Close mobile sidebar on route change
    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    // Simple check for active link
    const isActive = (path: string) => pathname === path || pathname?.startsWith(path + '/');

    const canManageStaff = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

    const handleSignOut = () => {
        sessionStorage.removeItem('adminUser');
        router.push('/admin/login');
    };

    const navContent = (
        <>
            <Link
                href="/admin"
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm ${pathname === '/admin'
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
            >
                <Activity className="w-4 h-4 shrink-0" />
                Dashboard
            </Link>

            <Link
                href="/admin/appointments"
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm ${isActive('/admin/appointments')
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
            >
                <Calendar className="w-4 h-4 shrink-0" />
                Appointments
            </Link>

            <Link
                href="/admin/clients"
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm ${isActive('/admin/clients')
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
            >
                <Users className="w-4 h-4 shrink-0" />
                Clients
            </Link>

            <Link
                href="/admin/registered-users"
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm ${isActive('/admin/registered-users')
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
            >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                Registered Users
            </Link>

            <Link
                href="/admin/schedule"
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm ${isActive('/admin/schedule')
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
            >
                <Calendar className="w-4 h-4 shrink-0" />
                Staff Schedule
            </Link>

            <Link
                href="/admin/doctors"
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm ${isActive('/admin/doctors')
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
            >
                <Stethoscope className="w-4 h-4 shrink-0" />
                Doctors
            </Link>

            <Link
                href="/admin/services"
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm ${isActive('/admin/services')
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
            >
                <Activity className="w-4 h-4 shrink-0" />
                Services
            </Link>

            <Link
                href="/admin/medicines"
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm ${isActive('/admin/medicines')
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
            >
                <Pill className="w-4 h-4 shrink-0" />
                Inventory
            </Link>

            <Link
                href="/admin/suppliers"
                className={`flex items-center gap-3 px-4 py-2 pl-10 rounded-lg font-medium text-xs transition-colors ${isActive('/admin/suppliers')
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
            >
                <Truck className="w-3.5 h-3.5 shrink-0" />
                Suppliers
            </Link>

            <Link
                href="/admin/product-registry"
                className={`flex items-center gap-3 px-4 py-2 pl-10 rounded-lg font-medium text-xs transition-colors ${isActive('/admin/product-registry')
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
            >
                <ClipboardList className="w-3.5 h-3.5 shrink-0" />
                Product Registry
            </Link>

            <Link
                href="/admin/purchases"
                className={`flex items-center gap-3 px-4 py-2 pl-10 rounded-lg font-medium text-xs transition-colors ${isActive('/admin/purchases')
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
            >
                <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
                Purchases
            </Link>

            <Link
                href="/admin/clinics"
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm ${isActive('/admin/clinics')
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
            >
                <MapPin className="w-4 h-4 shrink-0" />
                Branches
            </Link>

            <Link
                href="/admin/contracts"
                className={`flex items-center gap-3 px-4 py-2 pl-10 rounded-lg font-medium text-xs transition-colors ${isActive('/admin/contracts')
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
            >
                <ClipboardList className="w-3.5 h-3.5 shrink-0" />
                Contracts
            </Link>

            <Link
                href="/admin/packages"
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm ${isActive('/admin/packages')
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
            >
                <PackageIcon className="w-4 h-4 shrink-0" />
                Packages
            </Link>

            <Link
                href="/admin/loyalty"
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm ${isActive('/admin/loyalty')
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
            >
                <Gift className="w-4 h-4 shrink-0" />
                Loyalty Points
            </Link>

            <Link
                href="/admin/billing"
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm ${isActive('/admin/billing')
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
            >
                <Receipt className="w-4 h-4 shrink-0" />
                Billing
            </Link>

            <Link
                href="/admin/client-grouping"
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm ${isActive('/admin/client-grouping')
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
            >
                <Link2 className="w-4 h-4 shrink-0" />
                Client Grouping
            </Link>

            <Link
                href="/admin/inbox"
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm ${isActive('/admin/inbox')
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
            >
                <Inbox className="w-4 h-4 shrink-0" />
                Inbox
            </Link>

            <Link
                href="/admin/promos"
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm ${isActive('/admin/promos')
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
            >
                <Tag className="w-4 h-4 shrink-0" />
                Promo Codes
            </Link>

            <Link
                href="/admin/settings"
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm ${isActive('/admin/settings')
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
            >
                <Settings className="w-4 h-4 shrink-0" />
                Settings
            </Link>

            <Link
                href="/admin/settings/notifications"
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm ${isActive('/admin/settings/notifications')
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
            >
                <Bell className="w-4 h-4 shrink-0" />
                Notifications
            </Link>

            <Link
                href="/admin/logs"
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm ${isActive('/admin/logs')
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
            >
                <ClipboardList className="w-4 h-4 shrink-0" />
                Audit Logs
            </Link>

            <Link
                href="/admin/call-agent-summaries"
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm ${isActive('/admin/call-agent-summaries')
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
            >
                <Phone className="w-4 h-4 shrink-0" />
                Call Agent Summary
            </Link>

            <Link
                href="/admin/reports"
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm ${isActive('/admin/reports')
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
            >
                <BarChart2 className="w-4 h-4 shrink-0" />
                Reports
            </Link>

            {canManageStaff && (
                <>
                    <Link
                        href="/admin/hr"
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm ${isActive('/admin/hr') && !isActive('/admin/hr/')
                            ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                    >
                        <Briefcase className="w-4 h-4 shrink-0" />
                        HR Management
                    </Link>

                    <Link
                        href="/admin/hr/employees"
                        className={`flex items-center gap-3 px-4 py-2 pl-10 rounded-lg font-medium text-xs transition-colors ${isActive('/admin/hr/employees')
                            ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                    >
                        <Users className="w-3.5 h-3.5 shrink-0" />
                        Employees
                    </Link>

                    <Link
                        href="/admin/hr/payroll"
                        className={`flex items-center gap-3 px-4 py-2 pl-10 rounded-lg font-medium text-xs transition-colors ${isActive('/admin/hr/payroll')
                            ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                    >
                        <Calculator className="w-3.5 h-3.5 shrink-0" />
                        Payroll
                    </Link>

                    <Link
                        href="/admin/hr/letters"
                        className={`flex items-center gap-3 px-4 py-2 pl-10 rounded-lg font-medium text-xs transition-colors ${isActive('/admin/hr/letters')
                            ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                    >
                        <ClipboardList className="w-3.5 h-3.5 shrink-0" />
                        Letters
                    </Link>

                    <Link
                        href="/admin/hr/recruitment"
                        className={`flex items-center gap-3 px-4 py-2 pl-10 rounded-lg font-medium text-xs transition-colors ${isActive('/admin/hr/recruitment')
                            ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                    >
                        <UserPlus className="w-3.5 h-3.5 shrink-0" />
                        Recruitment
                    </Link>
                </>
            )}

            <Link
                href="/admin/accounting"
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm ${isActive('/admin/accounting')
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
            >
                <Wallet className="w-4 h-4 shrink-0" />
                Accounting
            </Link>

            {canManageStaff && (
                <Link
                    href="/admin/staff"
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm ${isActive('/admin/staff')
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                >
                    <Lock className="w-4 h-4 shrink-0" />
                    Staff Access
                </Link>
            )}
        </>
    );

    const userFooter = (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 shrink-0">
            <div className="px-3 py-1.5 mb-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user?.name || 'Admin'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.username || ''}</p>
            </div>
            <button
                onClick={handleSignOut}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg font-medium text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
                <LogOut className="w-4 h-4 shrink-0" />
                Sign Out
            </button>
        </div>
    );

    return (
        <>
            {/* Mobile hamburger button */}
            <button
                onClick={() => setMobileOpen(true)}
                className="fixed top-4 left-4 z-50 md:hidden bg-white dark:bg-gray-800 shadow-lg rounded-lg p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Open menu"
            >
                <Menu className="w-5 h-5" />
            </button>

            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar — Desktop: always visible, Mobile: slide in/out */}
            <aside
                className={`fixed inset-y-0 left-0 w-60 bg-white dark:bg-gray-800 shadow-md z-50 flex flex-col transition-transform duration-300 ease-in-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'
                    } md:translate-x-0`}
            >
                {/* Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
                    <h1 className="text-lg font-bold text-indigo-600 dark:text-indigo-400">MedAdmin</h1>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                            {user?.role || 'Guest'}
                        </span>
                        {/* Mobile close button */}
                        <button
                            onClick={() => setMobileOpen(false)}
                            className="md:hidden text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            aria-label="Close menu"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Scrollable Nav */}
                <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1 scrollbar-thin">
                    {navContent}
                </nav>

                {/* User Footer — always visible at bottom */}
                {userFooter}
            </aside>
        </>
    );
}

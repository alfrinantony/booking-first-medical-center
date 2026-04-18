'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Users, Calendar, Activity, BarChart2, MapPin, Tag, Stethoscope, Lock, Inbox, Settings, Package as PackageIcon, ClipboardList, Bell, Pill, Truck, ShoppingCart, LogOut, Phone, ShieldCheck, Gift, Receipt, Link2, Briefcase, Calculator, UserPlus, Wallet, Menu, X, FileText, Clock, FileSpreadsheet, Cpu, TrendingUp, BarChart3, Wrench } from 'lucide-react';
import { User } from '@/lib/users-types';

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

    // Permission-based visibility: returns true if user has 'read' access for a module
    const hasRead = (moduleKey: string): boolean => {
        if (!user) return false;
        if (user.role === 'SUPER_ADMIN') return true;
        return user.permissions?.[moduleKey]?.includes('read') ?? false;
    };

    const handleSignOut = () => {
        sessionStorage.removeItem('adminUser');
        router.push('/admin/login');
    };

    // Reusable link style helpers
    const mainLinkClass = (path: string, exact?: boolean) =>
        `flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm ${
            (exact ? pathname === path : isActive(path))
                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
        }`;
    const subLinkClass = (path: string) =>
        `flex items-center gap-3 px-4 py-2 pl-10 rounded-lg font-medium text-xs transition-colors ${
            isActive(path)
                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
        }`;
    const deepSubLinkClass = (path: string) =>
        `flex items-center gap-3 px-4 py-2 pl-14 rounded-lg font-medium text-[11px] transition-colors ${
            isActive(path)
                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                : 'text-gray-500 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
        }`;

    const navContent = (
        <>
            {hasRead('dashboard') && (
                <>
                    <Link href="/admin" className={mainLinkClass('/admin', true)}>
                        <Activity className="w-4 h-4 shrink-0" />
                        Dashboard
                    </Link>
                    <Link href="/admin/checklists" className={mainLinkClass('/admin/checklists')}>
                        <ClipboardList className="w-4 h-4 shrink-0" />
                        Daily Checklists
                    </Link>
                </>
            )}

            {hasRead('appointments') && (
                <>
                    <Link href="/admin/appointments" className={mainLinkClass('/admin/appointments')}>
                        <Calendar className="w-4 h-4 shrink-0" />
                        Appointments
                    </Link>
                    {user?.role === 'SUPER_ADMIN' && (
                        <Link href="/admin/simplybook" className={subLinkClass('/admin/simplybook')}>
                            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                            SimplyBook Sync
                        </Link>
                    )}
                </>
            )}

            {hasRead('clients') && (
                <Link href="/admin/clients" className={mainLinkClass('/admin/clients')}>
                    <Users className="w-4 h-4 shrink-0" />
                    Clients
                </Link>
            )}

            {hasRead('registered_users') && (
                <Link href="/admin/registered-users" className={mainLinkClass('/admin/registered-users')}>
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    Registered Users
                </Link>
            )}

            {hasRead('schedule') && (
                <Link href="/admin/schedule" className={mainLinkClass('/admin/schedule')}>
                    <Calendar className="w-4 h-4 shrink-0" />
                    Clinicians Schedule
                </Link>
            )}

            {hasRead('doctors') && (
                <Link href="/admin/doctors" className={mainLinkClass('/admin/doctors')}>
                    <Stethoscope className="w-4 h-4 shrink-0" />
                    Doctors
                </Link>
            )}

            {hasRead('services') && (
                <Link href="/admin/services" className={mainLinkClass('/admin/services')}>
                    <Activity className="w-4 h-4 shrink-0" />
                    Services
                </Link>
            )}

            {hasRead('inventory') && (
                <>
                    <Link href="/admin/medicines" className={mainLinkClass('/admin/medicines')}>
                        <Pill className="w-4 h-4 shrink-0" />
                        Inventory
                    </Link>
                    <Link href="/admin/suppliers" className={subLinkClass('/admin/suppliers')}>
                        <Truck className="w-3.5 h-3.5 shrink-0" />
                        Suppliers
                    </Link>
                    <Link href="/admin/product-registry" className={subLinkClass('/admin/product-registry')}>
                        <ClipboardList className="w-3.5 h-3.5 shrink-0" />
                        Product Registry
                    </Link>
                    <Link href="/admin/purchases" className={subLinkClass('/admin/purchases')}>
                        <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
                        Purchases
                    </Link>
                    <Link href="/admin/equipment" className={subLinkClass('/admin/equipment')}>
                        <Wrench className="w-3.5 h-3.5 shrink-0" />
                        Equipment
                    </Link>
                </>
            )}

            {hasRead('branches') && (
                <>
                    <Link href="/admin/clinics" className={mainLinkClass('/admin/clinics')}>
                        <MapPin className="w-4 h-4 shrink-0" />
                        Branches
                    </Link>
                    <Link href="/admin/contracts" className={subLinkClass('/admin/contracts')}>
                        <ClipboardList className="w-3.5 h-3.5 shrink-0" />
                        Contracts
                    </Link>
                </>
            )}

            {hasRead('packages') && (
                <Link href="/admin/packages" className={mainLinkClass('/admin/packages')}>
                    <PackageIcon className="w-4 h-4 shrink-0" />
                    Packages
                </Link>
            )}

            {hasRead('loyalty') && (
                <Link href="/admin/loyalty" className={mainLinkClass('/admin/loyalty')}>
                    <Gift className="w-4 h-4 shrink-0" />
                    Loyalty Points
                </Link>
            )}

            {hasRead('billing') && (
                <>
                    <Link href="/admin/billing" className={mainLinkClass('/admin/billing')}>
                        <Receipt className="w-4 h-4 shrink-0" />
                        Billing
                    </Link>
                    <Link href="/admin/transactions" className={subLinkClass('/admin/transactions')}>
                        <Wallet className="w-3.5 h-3.5 shrink-0" />
                        Transactions & Refunds
                    </Link>
                    <Link href="/admin/vat-report" className={subLinkClass('/admin/vat-report')}>
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        VAT Report
                    </Link>
                </>
            )}

            {hasRead('client_grouping') && (
                <Link href="/admin/client-grouping" className={mainLinkClass('/admin/client-grouping')}>
                    <Link2 className="w-4 h-4 shrink-0" />
                    Client Grouping
                </Link>
            )}

            {hasRead('inbox') && (
                <Link href="/admin/inbox" className={mainLinkClass('/admin/inbox')}>
                    <Inbox className="w-4 h-4 shrink-0" />
                    Inbox
                </Link>
            )}

            {hasRead('promos') && (
                <>
                    <Link href="/admin/promos" className={mainLinkClass('/admin/promos')}>
                        <Tag className="w-4 h-4 shrink-0" />
                        Promo Codes
                    </Link>
                    <Link href="/admin/marketing" className={mainLinkClass('/admin/marketing')}>
                        <TrendingUp className="w-4 h-4 shrink-0" />
                        Marketing
                    </Link>
                    <Link href="/admin/social" className={mainLinkClass('/admin/social')}>
                        <BarChart3 className="w-4 h-4 shrink-0" />
                        Social
                    </Link>
                </>
            )}

            {hasRead('settings') && (
                <>
                    <Link href="/admin/settings" className={mainLinkClass('/admin/settings')}>
                        <Settings className="w-4 h-4 shrink-0" />
                        Settings
                    </Link>
                    <Link href="/admin/settings/notifications" className={mainLinkClass('/admin/settings/notifications')}>
                        <Bell className="w-4 h-4 shrink-0" />
                        Notifications
                    </Link>
                </>
            )}

            {hasRead('audit_logs') && (
                <Link href="/admin/logs" className={mainLinkClass('/admin/logs')}>
                    <ClipboardList className="w-4 h-4 shrink-0" />
                    Audit Logs
                </Link>
            )}

            {hasRead('call_agent') && (
                <Link href="/admin/call-agent-summaries" className={mainLinkClass('/admin/call-agent-summaries')}>
                    <Phone className="w-4 h-4 shrink-0" />
                    Call Agent Summary
                </Link>
            )}

            {hasRead('reports') && (
                <Link href="/admin/reports" className={mainLinkClass('/admin/reports')}>
                    <BarChart2 className="w-4 h-4 shrink-0" />
                    Clinical Reports
                </Link>
            )}

            {hasRead('hr') && (
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
                    <Link href="/admin/hr/employees" className={subLinkClass('/admin/hr/employees')}>
                        <Users className="w-3.5 h-3.5 shrink-0" />
                        Employees
                    </Link>
                    <Link href="/admin/hr/payroll" className={subLinkClass('/admin/hr/payroll')}>
                        <Calculator className="w-3.5 h-3.5 shrink-0" />
                        Payroll
                    </Link>
                    <Link href="/admin/hr/letters" className={subLinkClass('/admin/hr/letters')}>
                        <ClipboardList className="w-3.5 h-3.5 shrink-0" />
                        Letters
                    </Link>
                    <Link href="/admin/hr/recruitment" className={subLinkClass('/admin/hr/recruitment')}>
                        <UserPlus className="w-3.5 h-3.5 shrink-0" />
                        Recruitment
                    </Link>
                    <Link
                        href="/admin/hr/attendance"
                        className={`flex items-center gap-3 px-4 py-2 pl-10 rounded-lg font-medium text-xs transition-colors ${isActive('/admin/hr/attendance') && !isActive('/admin/hr/attendance/')
                            ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                    >
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        Attendance
                    </Link>
                    <Link href="/admin/hr/attendance/timesheet" className={deepSubLinkClass('/admin/hr/attendance/timesheet')}>
                        <FileSpreadsheet className="w-3 h-3 shrink-0" />
                        Timesheet
                    </Link>
                    <Link href="/admin/hr/attendance/devices" className={deepSubLinkClass('/admin/hr/attendance/devices')}>
                        <Cpu className="w-3 h-3 shrink-0" />
                        Devices
                    </Link>
                    <Link href="/admin/hr/shifts" className={subLinkClass('/admin/hr/shifts')}>
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        Shift Schedule
                    </Link>
                </>
            )}

            {hasRead('accounting') && (
                <Link href="/admin/accounting" className={mainLinkClass('/admin/accounting')}>
                    <Wallet className="w-4 h-4 shrink-0" />
                    Accounting
                </Link>
            )}

            {hasRead('staff_access') && (
                <Link href="/admin/staff" className={mainLinkClass('/admin/staff')}>
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

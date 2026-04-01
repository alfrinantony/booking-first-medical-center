'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Users, Calendar, Activity, BarChart2, MapPin, AlertTriangle,
    Warehouse, ArrowRight, Bell, BellOff, CalendarClock, Pill,
    Building, Stethoscope, UserCheck, UserX, Clock, Coffee,
    Tag, Package, FileText, ShieldCheck, DollarSign, Heart,
    ClipboardList, Zap, TrendingUp, Briefcase, ClipboardCheck, Wrench
} from 'lucide-react';
import { Medicine, Clinic } from '@/lib/data';
import { User, ModulePermissions } from '@/lib/users-types';
import type { RoomChecklist } from '@/lib/checklist-store';

interface LowStockAlert {
    medicineId: string;
    medicineName: string;
    location: string;
    currentQty: number;
    minStock: number;
    isNotified: boolean;
}

interface AttendanceSummary {
    totalEmployees: number;
    present: number;
    absent: number;
    late: number;
    onLeave: number;
    weeklyOff: number;
}

interface Booking {
    id: string;
    patientName: string;
    phone: string;
    doctorName: string;
    serviceName: string;
    clinicName: string;
    date: string;
    slot: string;
    status: string;
}

export default function AdminPage() {
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [clinics, setClinics] = useState<Clinic[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);

    // Live data
    const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [checklists, setChecklists] = useState<RoomChecklist[]>([]);
    const [shiftSummary, setShiftSummary] = useState<{ total: number; scheduled: number; offDuty: number; clinicianAuto: number } | null>(null);

    const today = new Date().toISOString().split('T')[0];

    // Permission helper
    const hasRead = (moduleKey: string): boolean => {
        if (!user) return false;
        if (user.role === 'SUPER_ADMIN') return true;
        return user.permissions?.[moduleKey]?.includes('read') ?? false;
    };

    useEffect(() => {
        const stored = sessionStorage.getItem('adminUser');
        if (stored) setUser(JSON.parse(stored));
    }, []);

    useEffect(() => {
        if (!user) return;

        const fetches: Promise<void>[] = [];

        // Only fetch data the user has permission to see
        if (hasRead('inventory')) {
            fetches.push(
                fetch('/api/admin/medicines').then(r => r.json()).then(meds => setMedicines(Array.isArray(meds) ? meds : [])).catch(() => {})
            );
        }
        if (hasRead('branches')) {
            fetches.push(
                fetch('/api/admin/clinics').then(r => r.json()).then(cls => setClinics(Array.isArray(cls) ? cls : [])).catch(() => {})
            );
        }
        if (hasRead('hr')) {
            fetches.push(
                fetch('/api/admin/hr/attendance?summary=true').then(r => r.json()).then(att => { if (att?.summary) setAttendance(att.summary); }).catch(() => {}),
                fetch(`/api/admin/hr/shifts?date=${today}&summary=true`).then(r => r.json()).then(shifts => { if (shifts?.summary) setShiftSummary(shifts.summary); }).catch(() => {})
            );
        }
        if (hasRead('appointments')) {
            fetches.push(
                fetch('/api/admin/bookings').then(r => r.json()).then(bk => setBookings(Array.isArray(bk) ? bk.slice(0, 8) : [])).catch(() => {})
            );
        }
        
        // Fetch latest global checklists for the widget
        fetches.push(
            fetch('/api/admin/checklists').then(r => r.json()).then(data => {
                if (Array.isArray(data)) {
                    setChecklists(data.slice(0, 6)); // top 6 most recent
                }
            }).catch(() => {})
        );

        Promise.all(fetches).catch(e => console.error(e)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, today]);

    const getClinicName = (id: string) => clinics.find(c => c.id === id)?.name || id;

    // Low stock alerts
    const lowStockAlerts: LowStockAlert[] = [];
    for (const med of medicines) {
        if (med.minCentralStock && med.minCentralStock > 0 && med.centralStock < med.minCentralStock) {
            lowStockAlerts.push({
                medicineId: med.id, medicineName: med.name, location: 'Central Warehouse',
                currentQty: med.centralStock, minStock: med.minCentralStock, isNotified: !!med.isNotified
            });
        }
        for (const bs of (med.branchStock || [])) {
            if (bs.minQuantity && bs.minQuantity > 0 && bs.quantity < bs.minQuantity) {
                lowStockAlerts.push({
                    medicineId: med.id, medicineName: med.name, location: getClinicName(bs.clinicId),
                    currentQty: bs.quantity, minStock: bs.minQuantity, isNotified: !!med.isNotified
                });
            }
        }
    }
    const unacknowledgedCount = lowStockAlerts.filter(a => !a.isNotified).length;

    // Near-expiry
    const nearExpiryItems = medicines
        .filter(med => med.expiryDate)
        .map(med => {
            const daysLeft = Math.ceil((new Date(med.expiryDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            return { id: med.id, name: med.name, category: med.category || 'medicine', expiryDate: med.expiryDate!, daysLeft };
        })
        .filter(item => item.daysLeft <= 100)
        .sort((a, b) => a.daysLeft - b.daysLeft);

    // Count stats
    const totalDoctors = clinics.reduce((sum, c) => sum + c.departments.reduce((ds, d) => ds + d.doctors.length, 0), 0);
    const totalBranches = clinics.length;
    const todaysBookings = bookings.filter(b => b.date === today).length || bookings.length;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0f1117] relative overflow-hidden font-sans">
            {/* Abstract Background Orbs */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-400/10 dark:bg-indigo-900/15 blur-[100px]" />
                <div className="absolute top-[30%] right-[-5%] w-[30%] h-[50%] rounded-full bg-violet-400/10 dark:bg-violet-900/15 blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[20%] w-[40%] h-[40%] rounded-full bg-emerald-400/10 dark:bg-emerald-900/10 blur-[120px]" />
            </div>

            <main className="p-5 md:p-8 max-w-[1500px] mx-auto relative z-10 w-full">

                {/* ═══ Header ═══ */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">System Dashboard</h1>
                        <p className="text-sm font-medium tracking-wide text-gray-500 dark:text-gray-400 mt-1 uppercase">
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}  ·  First Medical Center
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {hasRead('doctors') && (
                            <Link href="/admin/doctors" className="px-4 py-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 rounded-xl text-xs font-bold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-2">
                                <Stethoscope className="w-4 h-4" /> Manage Doctors
                            </Link>
                        )}
                        {hasRead('hr') && (
                            <Link href="/admin/hr/shifts" className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.23)] hover:-translate-y-0.5 transition-all flex items-center gap-2">
                                <Clock className="w-4 h-4" /> Shift Schedule
                            </Link>
                        )}
                    </div>
                </div>

                {/* ═══ KPI Row ═══ */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                    {hasRead('branches') && <KPICard icon={<Building className="w-5 h-5 flex-shrink-0" />} label="Branches" value={totalBranches} color="indigo" />}
                    {hasRead('doctors') && <KPICard icon={<Stethoscope className="w-5 h-5 flex-shrink-0" />} label="Doctors" value={totalDoctors} color="blue" />}
                    {hasRead('appointments') && <KPICard icon={<Calendar className="w-5 h-5 flex-shrink-0" />} label="Today's Bookings" value={todaysBookings} color="emerald" />}
                    {hasRead('hr') && <KPICard icon={<UserCheck className="w-5 h-5 flex-shrink-0" />} label="Staff Present" value={attendance?.present ?? '—'} color="green" />}
                    {hasRead('hr') && <KPICard icon={<UserX className="w-5 h-5 flex-shrink-0" />} label="Absent / Late" value={attendance ? `${attendance.absent}/${attendance.late}` : '—'} color="red" />}
                    {hasRead('hr') && <KPICard icon={<ClipboardList className="w-5 h-5 flex-shrink-0" />} label="Shifts Today" value={shiftSummary?.total ?? '—'} color="purple" />}
                </div>

                {/* ═══ Main Grid: 2-column ═══ */}
                <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">

                    {/* ── Left Column ── */}
                    <div className="space-y-6">

                        {/* Alerts Row: Low Stock + Expiry side by side */}
                        {hasRead('inventory') && (lowStockAlerts.length > 0 || nearExpiryItems.length > 0) && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Low Stock */}
                                {lowStockAlerts.length > 0 && (
                                    <div className="bg-white/70 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl border border-red-200/50 dark:border-red-900/30 overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all">
                                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/50 dark:border-gray-700/50 bg-red-50/70 dark:bg-red-900/20">
                                            <div className="flex items-center gap-3">
                                                <div className="p-1.5 bg-red-100 dark:bg-red-500/20 rounded-lg">
                                                    <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                                                </div>
                                                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Low Stock Alerts</h3>
                                                {unacknowledgedCount > 0 && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-sm">{unacknowledgedCount}</span>
                                                )}
                                            </div>
                                            <Link href="/admin/medicines" className="group text-[11px] text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-bold flex items-center gap-1 transition-colors">
                                                View All <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                                            </Link>
                                        </div>
                                        <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
                                            <table className="w-full text-xs">
                                                <tbody className="divide-y divide-gray-100/50 dark:divide-gray-700/50">
                                                    {lowStockAlerts.slice(0, 6).map((alert, i) => (
                                                        <tr key={i} className={`group hover:bg-white/80 dark:hover:bg-gray-750/80 transition-colors ${alert.isNotified ? 'opacity-60' : ''}`}>
                                                            <td className="py-3 px-4 w-10 text-center">
                                                                {alert.isNotified
                                                                    ? <BellOff className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 inline" />
                                                                    : <Bell className="w-3.5 h-3.5 text-amber-500 inline animate-pulse" />}
                                                            </td>
                                                            <td className="py-3 px-2 font-bold text-gray-800 dark:text-gray-200 truncate max-w-[120px]">{alert.medicineName}</td>
                                                            <td className="py-3 px-2 text-[11px] font-medium text-gray-500 truncate max-w-[100px]">
                                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800">
                                                                    {alert.location === 'Central Warehouse' ? <Warehouse className="w-3 h-3 text-purple-500" /> : <MapPin className="w-3 h-3 text-teal-500" />}
                                                                    {alert.location}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-4 text-right">
                                                                <span className="font-extrabold text-red-600 dark:text-red-400 text-sm">{alert.currentQty}</span>
                                                                <span className="text-gray-400 dark:text-gray-500 font-medium text-[10px] ml-0.5">/{alert.minStock}</span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Expiry */}
                                {nearExpiryItems.length > 0 && (
                                    <div className="bg-white/70 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl border border-amber-200/50 dark:border-amber-900/30 overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all">
                                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/50 dark:border-gray-700/50 bg-amber-50/70 dark:bg-amber-900/20">
                                            <div className="flex items-center gap-3">
                                                <div className="p-1.5 bg-amber-100 dark:bg-amber-500/20 rounded-lg">
                                                    <CalendarClock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                                </div>
                                                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Expiring Soon</h3>
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm">{nearExpiryItems.length}</span>
                                            </div>
                                            <Link href="/admin/medicines" className="group text-[11px] text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 font-bold flex items-center gap-1 transition-colors">
                                                View All <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                                            </Link>
                                        </div>
                                        <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
                                            <table className="w-full text-xs">
                                                <tbody className="divide-y divide-gray-100/50 dark:divide-gray-700/50">
                                                    {nearExpiryItems.slice(0, 6).map(item => (
                                                        <tr key={item.id} className="group hover:bg-white/80 dark:hover:bg-gray-750/80 transition-colors">
                                                            <td className="py-3 px-4 w-10 text-center">
                                                                <Pill className={`w-3.5 h-3.5 inline ${item.category === 'consumable' ? 'text-orange-400' : 'text-blue-500'}`} />
                                                            </td>
                                                            <td className="py-3 px-2 font-bold text-gray-800 dark:text-gray-200 truncate max-w-[140px]">{item.name}</td>
                                                            <td className="py-3 px-2 text-[11px] font-medium text-gray-500">{item.expiryDate}</td>
                                                            <td className="py-3 px-4 text-right">
                                                                <span className={`inline-flex px-2 py-1 rounded-md text-[10px] font-bold shadow-[0_2px_10px_rgb(0,0,0,0.03)] border transition-all ${item.daysLeft <= 0 ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50' : item.daysLeft <= 30 ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800/50' : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/50'}`}>
                                                                    {item.daysLeft <= 0 ? 'Exp' : `${item.daysLeft}d`}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Recent Bookings */}
                        {hasRead('appointments') && (
                        <div className="bg-white/70 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl border border-white/50 dark:border-gray-700/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-white/50 dark:border-gray-700/50">
                                <h3 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2.5">
                                    <div className="p-1.5 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg">
                                        <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    Recent Appointments
                                </h3>
                                <Link href="/admin/bookings" className="group text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 font-bold flex items-center gap-1 transition-colors">
                                    View All Scheduler <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                                </Link>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-b border-gray-100/50 dark:border-gray-700/50 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                            <th className="text-left py-3 px-5">Patient & Doctor</th>
                                            <th className="text-left py-3 px-5">Service Details</th>
                                            <th className="text-left py-3 px-5">Time</th>
                                            <th className="text-left py-3 px-5">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100/40 dark:divide-gray-700/50">
                                        {bookings.length === 0 ? (
                                            <tr><td colSpan={6} className="py-10 text-center font-medium text-gray-400 text-sm">
                                                {loading ? 'Fetching appointments...' : 'No recent appointments to display'}
                                            </td></tr>
                                        ) : (
                                            bookings.map((b, i) => (
                                                <tr key={b.id || i} className="group hover:bg-white dark:hover:bg-gray-750/80 transition-all cursor-default">
                                                    <td className="py-3 px-5">
                                                        <div className="font-bold text-gray-900 dark:text-white text-[13px]">{b.patientName}</div>
                                                        <div className="text-[11px] font-medium text-gray-500 mt-0.5">Dr. {b.doctorName}</div>
                                                    </td>
                                                    <td className="py-3 px-5">
                                                        <div className="font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[200px]">{b.serviceName}</div>
                                                        <div className="text-[10px] font-medium text-gray-400 mt-0.5 flex items-center gap-1"><Building className="w-2.5 h-2.5" />{b.clinicName}</div>
                                                    </td>
                                                    <td className="py-3 px-5">
                                                        <span className="inline-block px-2.5 py-1 bg-gray-100 dark:bg-gray-800 rounded-md font-mono font-bold text-gray-600 dark:text-gray-300 text-[11px]">
                                                            {b.slot}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-5">
                                                        <span className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold shadow-sm border transition-transform group-hover:scale-105 origin-left ${b.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50' : b.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50' : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50'}`}>
                                                            {b.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        )}

                        {/* Recent Daily Checklists */}
                        <div className="bg-white/70 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl border border-white/50 dark:border-gray-700/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-white/50 dark:border-gray-700/50">
                                <h3 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2.5">
                                    <div className="p-1.5 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg">
                                        <ClipboardCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    Operations Checklists
                                </h3>
                                <Link href="/admin/checklists" className="group text-xs text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 font-bold flex items-center gap-1 transition-colors">
                                    Open Dashboard <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                                </Link>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-b border-gray-100/50 dark:border-gray-700/50 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                            <th className="text-left py-3 px-5">Location</th>
                                            <th className="text-left py-3 px-5">Supervisor</th>
                                            <th className="text-left py-3 px-5">Submitted At</th>
                                            <th className="text-left py-3 px-5">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100/40 dark:divide-gray-700/50">
                                        {checklists.length === 0 ? (
                                            <tr><td colSpan={4} className="py-10 text-center font-medium text-gray-400 text-sm">
                                                {loading ? 'Loading...' : 'No checklists submitted yet'}
                                            </td></tr>
                                        ) : (
                                            checklists.map((chk, i) => {
                                                const branch = clinics.find(c => c.id === chk.branchId);
                                                const room = branch?.rooms?.find(r => r.id === chk.roomId);
                                                const submittedDate = chk.submittedAt ? new Date(chk.submittedAt) : new Date(chk.date);
                                                
                                                return (
                                                <tr key={chk.id || i} className="group hover:bg-white dark:hover:bg-gray-750/80 transition-all">
                                                    <td className="py-3 px-5">
                                                        <div className="font-bold text-gray-900 dark:text-white leading-tight">{room?.name || 'Unknown Room'}</div>
                                                        <div className="text-[10px] font-medium text-gray-500 mt-1 flex items-center gap-1"><Building className="w-2.5 h-2.5" /> {branch?.name || chk.branchId}</div>
                                                    </td>
                                                    <td className="py-3 px-5 font-semibold text-gray-700 dark:text-gray-300">{chk.supervisorName}</td>
                                                    <td className="py-3 px-5">
                                                        <div className="text-gray-900 dark:text-gray-100 font-bold">{submittedDate.toLocaleDateString('en-GB')}</div>
                                                        <div className="text-[11px] text-gray-500 font-mono font-medium mt-0.5">{submittedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                                                    </td>
                                                    <td className="py-3 px-5">
                                                        <span className={`inline-block px-2.5 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wider shadow-sm transition-transform group-hover:scale-105 origin-left ${
                                                            chk.status === 'Complete' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50' :
                                                            chk.status === 'Pending' ? 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600' :
                                                            chk.status === 'Medicine Low' ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800/50' :
                                                            'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800/50'
                                                        }`}>
                                                            {chk.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            )})
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* ── Right Sidebar: Quick Links ── */}
                    <div className="space-y-6">

                        {/* Shift Summary Banner */}
                        {hasRead('hr') && shiftSummary && (
                            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-600 to-purple-700 text-white p-6 shadow-[0_8px_30px_rgb(99,102,241,0.3)] dark:shadow-[0_8px_30px_rgb(99,102,241,0.2)] group hover:-translate-y-1 transition-all duration-300">
                                {/* Decor */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl transform translate-x-1/2 -translate-y-1/2 group-hover:scale-150 transition-transform duration-700" />
                                
                                <h3 className="relative z-10 text-xs font-bold text-indigo-100 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <div className="p-1 bg-white/20 rounded-md backdrop-blur-sm"><Zap className="w-3.5 h-3.5 text-white" /></div> Today's Shifts
                                </h3>
                                <div className="relative z-10 flex items-baseline gap-2 mb-2">
                                    <span className="text-4xl font-black tracking-tight">{shiftSummary.scheduled}</span>
                                    <span className="text-sm font-semibold text-indigo-200">staff scheduled</span>
                                </div>
                                <div className="relative z-10 flex gap-4 text-xs font-medium text-indigo-200 mt-2">
                                    <span className="flex flex-col"><strong className="text-white text-sm">{shiftSummary.offDuty}</strong> off duty</span>
                                    <span className="flex flex-col"><strong className="text-white text-sm">{shiftSummary.clinicianAuto}</strong> auto-clinician</span>
                                </div>
                                <Link href="/admin/hr/shifts" className="relative z-10 mt-5 pt-4 border-t border-white/20 flex items-center justify-between text-sm font-bold text-white hover:text-indigo-100 transition-colors">
                                    Open Shift Dashboard
                                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm group-hover:translate-x-1 group-hover:bg-white transition-all">
                                        <ArrowRight className="w-3 h-3 group-hover:text-indigo-600 transition-colors" />
                                    </div>
                                </Link>
                            </div>
                        )}

                        {/* Attendance Snapshot */}
                        {hasRead('hr') && attendance && (
                            <div className="bg-white/70 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl border border-white/50 dark:border-gray-700/50 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)]">
                                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-emerald-500" /> Live Attendance
                                </h3>
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <MiniStat label="Present" value={attendance.present} color="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50" />
                                    <MiniStat label="Absent" value={attendance.absent} color="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-100 dark:border-red-800/50" />
                                    <MiniStat label="Late" value={attendance.late} color="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-800/50" />
                                    <MiniStat label="Weekly Off" value={attendance.weeklyOff} color="bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-700/50" />
                                </div>
                                <Link href="/admin/hr/attendance" className="group text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center justify-center gap-1.5 pt-4 border-t border-gray-200/50 dark:border-gray-700/50 transition-colors w-full">
                                    Full Attendance Report <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </Link>
                            </div>
                        )}

                        {/* Quick Navigation grid */}
                        <div className="bg-white/70 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl border border-white/50 dark:border-gray-700/50 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)]">
                            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Stethoscope className="w-4 h-4 text-indigo-500" /> Tool Access
                            </h3>
                            <div className="grid grid-cols-1 gap-1">
                                {hasRead('branches') && <QuickLink href="/admin/clinics" icon={<Building className="w-4 h-4" />} label="Manage Branches" desc="Locations & core hours" color="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30" />}
                                {hasRead('services') && <QuickLink href="/admin/services" icon={<Heart className="w-4 h-4" />} label="Services Catalog" desc="Treatments & pricing rules" color="text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/30" />}
                                {hasRead('doctors') && <QuickLink href="/admin/doctors" icon={<Stethoscope className="w-4 h-4" />} label="Doctor roster" desc="Specialists & clinic assignments" color="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30" />}
                                {hasRead('schedule') && <QuickLink href="/admin/schedule" icon={<Calendar className="w-4 h-4" />} label="Clinician Rota" desc="Availability & booking slots" color="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30" />}
                                {hasRead('hr') && <QuickLink href="/admin/hr/employees" icon={<Users className="w-4 h-4" />} label="HR Database" desc="Employee records & profiles" color="text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30" />}
                                {hasRead('inventory') && <QuickLink href="/admin/medicines" icon={<Package className="w-4 h-4" />} label="Stock & Inventory" desc="Medicines & lab supplies" color="text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30" />}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

// ── KPI Card ──
function KPICard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
    const styles: Record<string, { text: string, iconBg: string }> = {
        indigo: { text: 'text-indigo-600 dark:text-indigo-400', iconBg: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 ring-indigo-200 dark:ring-indigo-800' },
        blue: { text: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 ring-blue-200 dark:ring-blue-800' },
        emerald: { text: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800' },
        green: { text: 'text-green-600 dark:text-green-400', iconBg: 'bg-green-100 dark:bg-green-900/60 text-green-600 dark:text-green-300 ring-green-200 dark:ring-green-800' },
        red: { text: 'text-red-600 dark:text-red-400', iconBg: 'bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-300 ring-red-200 dark:ring-red-800' },
        purple: { text: 'text-purple-600 dark:text-purple-400', iconBg: 'bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-300 ring-purple-200 dark:ring-purple-800' },
    };
    const theme = styles[color] || styles.indigo;
    return (
        <div className={`bg-white/80 dark:bg-[#1a1c23]/80 backdrop-blur-md rounded-2xl border border-white/60 dark:border-white/5 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_12px_40px_rgb(0,0,0,0.3)] transition-all duration-300 group relative overflow-hidden`}>
            {/* Subtle glow effect behind card on hover */}
            <div className={`absolute -inset-1 rounded-2xl bg-gradient-to-r from-transparent via-${color}-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity blur duration-500`} />
            
            <div className="flex items-center justify-between mb-4 relative z-10">
                <div className={`p-2.5 rounded-xl ${theme.iconBg} ring-1 shadow-inner group-hover:scale-110 transition-transform duration-300 ease-out`}>{icon}</div>
            </div>
            <p className="text-3xl font-black text-gray-900 dark:text-white leading-none tracking-tight mb-2 relative z-10">{value}</p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 relative z-10">{label}</p>
        </div>
    );
}

// ── Mini Stat (sidebar) ──
function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className={`relative overflow-hidden rounded-xl px-4 py-3 border shadow-sm transition-transform hover:scale-[1.03] duration-300 ${color}`}>
            <p className="text-2xl font-black leading-none mb-1 shadow-sm relative z-10 tracking-tight">{value}</p>
            <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest relative z-10">{label}</p>
        </div>
    );
}

// ── Quick Link (sidebar) ──
function QuickLink({ href, icon, label, desc, color }: { href: string; icon: React.ReactNode; label: string; desc: string; color: string }) {
    return (
        <Link href={href} className="group flex items-center gap-3.5 px-3 py-2.5 rounded-xl hover:bg-white dark:hover:bg-gray-750/80 transition-all cursor-pointer shadow-none hover:shadow-sm hover:border-gray-200/50 dark:hover:border-gray-600/50 border border-transparent">
            <div className={`p-2.5 rounded-xl transition-colors shadow-sm ring-1 ring-black/5 dark:ring-white/5 ${color}`}>{icon}</div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors tracking-tight">{label}</p>
                <p className="text-[10px] text-gray-500 font-medium truncate mt-0.5">{desc}</p>
            </div>
            <div className="w-6 h-6 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transform -translate-x-2 group-hover:translate-x-0 transition-all shadow-sm">
                <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
            </div>
        </Link>
    );
}

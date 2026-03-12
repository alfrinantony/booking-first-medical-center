'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Users, Calendar, Activity, BarChart2, MapPin, AlertTriangle,
    Warehouse, ArrowRight, Bell, BellOff, CalendarClock, Pill,
    Building, Stethoscope, UserCheck, UserX, Clock, Coffee,
    Tag, Package, FileText, ShieldCheck, DollarSign, Heart,
    ClipboardList, Zap, TrendingUp, Briefcase
} from 'lucide-react';
import { Medicine, Clinic } from '@/lib/data';
import { User, ModulePermissions } from '@/lib/users-types';

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
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <main className="p-5 md:p-8 max-w-[1500px] mx-auto">

                {/* ═══ Header ═══ */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}  ·  First Medical Center LLC
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {hasRead('doctors') && (
                            <Link href="/admin/doctors" className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors flex items-center gap-1.5">
                                <Stethoscope className="w-3.5 h-3.5" /> Manage Doctors
                            </Link>
                        )}
                        {hasRead('hr') && (
                            <Link href="/admin/hr/shifts" className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" /> Shift Schedule
                            </Link>
                        )}
                    </div>
                </div>

                {/* ═══ KPI Row ═══ */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                    {hasRead('branches') && <KPICard icon={<Building className="w-4 h-4" />} label="Branches" value={totalBranches} color="indigo" />}
                    {hasRead('doctors') && <KPICard icon={<Stethoscope className="w-4 h-4" />} label="Doctors" value={totalDoctors} color="blue" />}
                    {hasRead('appointments') && <KPICard icon={<Calendar className="w-4 h-4" />} label="Today's Bookings" value={todaysBookings} color="emerald" />}
                    {hasRead('hr') && <KPICard icon={<UserCheck className="w-4 h-4" />} label="Staff Present" value={attendance?.present ?? '—'} color="green" />}
                    {hasRead('hr') && <KPICard icon={<UserX className="w-4 h-4" />} label="Absent / Late" value={attendance ? `${attendance.absent}/${attendance.late}` : '—'} color="red" />}
                    {hasRead('hr') && <KPICard icon={<ClipboardList className="w-4 h-4" />} label="Shifts Today" value={shiftSummary?.total ?? '—'} color="purple" />}
                </div>

                {/* ═══ Main Grid: 2-column ═══ */}
                <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5">

                    {/* ── Left Column ── */}
                    <div className="space-y-5">

                        {/* Alerts Row: Low Stock + Expiry side by side */}
                        {hasRead('inventory') && (lowStockAlerts.length > 0 || nearExpiryItems.length > 0) && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                {/* Low Stock */}
                                {lowStockAlerts.length > 0 && (
                                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 overflow-hidden">
                                        <div className="flex items-center justify-between px-4 py-3 border-b border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10">
                                            <div className="flex items-center gap-2">
                                                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                                                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Low Stock</h3>
                                                {unacknowledgedCount > 0 && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-600 text-white">{unacknowledgedCount}</span>
                                                )}
                                            </div>
                                            <Link href="/admin/medicines" className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-0.5">
                                                View All <ArrowRight className="w-3 h-3" />
                                            </Link>
                                        </div>
                                        <div className="max-h-[200px] overflow-y-auto">
                                            <table className="w-full text-xs">
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                    {lowStockAlerts.slice(0, 6).map((alert, i) => (
                                                        <tr key={i} className={alert.isNotified ? 'opacity-50' : 'hover:bg-red-50/30 dark:hover:bg-red-900/5'}>
                                                            <td className="py-2 px-3">
                                                                {alert.isNotified
                                                                    ? <BellOff className="w-3 h-3 text-gray-400" />
                                                                    : <Bell className="w-3 h-3 text-amber-500" />}
                                                            </td>
                                                            <td className="py-2 px-2 font-medium text-gray-900 dark:text-white truncate max-w-[120px]">{alert.medicineName}</td>
                                                            <td className="py-2 px-2 text-gray-500 truncate max-w-[100px]">
                                                                {alert.location === 'Central Warehouse' ? <Warehouse className="w-3 h-3 inline mr-0.5 text-purple-500" /> : <MapPin className="w-3 h-3 inline mr-0.5 text-teal-500" />}
                                                                {alert.location}
                                                            </td>
                                                            <td className="py-2 px-2 text-right">
                                                                <span className="font-bold text-red-600">{alert.currentQty}</span>
                                                                <span className="text-gray-400">/{alert.minStock}</span>
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
                                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-amber-200 dark:border-amber-800 overflow-hidden">
                                        <div className="flex items-center justify-between px-4 py-3 border-b border-amber-100 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-900/10">
                                            <div className="flex items-center gap-2">
                                                <CalendarClock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Expiring Soon</h3>
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500 text-white">{nearExpiryItems.length}</span>
                                            </div>
                                            <Link href="/admin/medicines" className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-0.5">
                                                View All <ArrowRight className="w-3 h-3" />
                                            </Link>
                                        </div>
                                        <div className="max-h-[200px] overflow-y-auto">
                                            <table className="w-full text-xs">
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                    {nearExpiryItems.slice(0, 6).map(item => (
                                                        <tr key={item.id} className="hover:bg-amber-50/30 dark:hover:bg-amber-900/5">
                                                            <td className="py-2 px-3">
                                                                <Pill className={`w-3 h-3 ${item.category === 'consumable' ? 'text-orange-500' : 'text-blue-500'}`} />
                                                            </td>
                                                            <td className="py-2 px-2 font-medium text-gray-900 dark:text-white truncate max-w-[140px]">{item.name}</td>
                                                            <td className="py-2 px-2 text-gray-500">{item.expiryDate}</td>
                                                            <td className="py-2 px-2 text-right">
                                                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${item.daysLeft <= 0 ? 'bg-red-100 text-red-700' : item.daysLeft <= 30 ? 'bg-red-50 text-red-600' : 'bg-yellow-100 text-yellow-700'}`}>
                                                                    {item.daysLeft <= 0 ? 'Expired' : `${item.daysLeft}d`}
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
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-indigo-600" /> Recent Appointments
                                </h3>
                                <Link href="/admin/bookings" className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-0.5">
                                    View All <ArrowRight className="w-3 h-3" />
                                </Link>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700 text-gray-500 uppercase tracking-wider">
                                            <th className="text-left py-2 px-4 font-semibold">Patient</th>
                                            <th className="text-left py-2 px-4 font-semibold">Doctor</th>
                                            <th className="text-left py-2 px-4 font-semibold">Service</th>
                                            <th className="text-left py-2 px-4 font-semibold">Branch</th>
                                            <th className="text-left py-2 px-4 font-semibold">Time</th>
                                            <th className="text-left py-2 px-4 font-semibold">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {bookings.length === 0 ? (
                                            <tr><td colSpan={6} className="py-8 text-center text-gray-400 text-sm">
                                                {loading ? 'Loading...' : 'No recent appointments'}
                                            </td></tr>
                                        ) : (
                                            bookings.map((b, i) => (
                                                <tr key={b.id || i} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                                                    <td className="py-2.5 px-4 font-medium text-gray-900 dark:text-white">{b.patientName}</td>
                                                    <td className="py-2.5 px-4 text-gray-600 dark:text-gray-300">{b.doctorName}</td>
                                                    <td className="py-2.5 px-4 text-gray-600 dark:text-gray-300 truncate max-w-[150px]">{b.serviceName}</td>
                                                    <td className="py-2.5 px-4">
                                                        <span className="flex items-center gap-1 text-gray-500"><Building className="w-3 h-3" />{b.clinicName}</span>
                                                    </td>
                                                    <td className="py-2.5 px-4 font-mono text-gray-600 dark:text-gray-300">{b.slot}</td>
                                                    <td className="py-2.5 px-4">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${b.status === 'confirmed' ? 'bg-green-100 text-green-700' : b.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
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
                    </div>

                    {/* ── Right Sidebar: Quick Links ── */}
                    <div className="space-y-4">

                        {/* Attendance Snapshot */}
                        {hasRead('hr') && attendance && (
                            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <Activity className="w-3.5 h-3.5" /> Today&apos;s Attendance
                                </h3>
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    <MiniStat label="Present" value={attendance.present} color="text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400" />
                                    <MiniStat label="Absent" value={attendance.absent} color="text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400" />
                                    <MiniStat label="Late" value={attendance.late} color="text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400" />
                                    <MiniStat label="Weekly Off" value={attendance.weeklyOff} color="text-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-gray-400" />
                                </div>
                                <Link href="/admin/hr/attendance" className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium flex items-center justify-center gap-0.5 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                                    Full Attendance Dashboard <ArrowRight className="w-3 h-3" />
                                </Link>
                            </div>
                        )}

                        {/* Quick Navigation */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Quick Access</h3>
                            <div className="space-y-1">
                                {hasRead('branches') && <QuickLink href="/admin/clinics" icon={<Building className="w-4 h-4" />} label="Manage Branches" desc="Locations & hours" color="text-indigo-600" />}
                                {hasRead('services') && <QuickLink href="/admin/services" icon={<Heart className="w-4 h-4" />} label="Services & Pricing" desc="Medical services" color="text-pink-600" />}
                                {hasRead('doctors') && <QuickLink href="/admin/doctors" icon={<Stethoscope className="w-4 h-4" />} label="Doctors" desc="Specialists & staff" color="text-blue-600" />}
                                {hasRead('schedule') && <QuickLink href="/admin/schedule" icon={<Calendar className="w-4 h-4" />} label="Clinician Schedule" desc="Availability & slots" color="text-emerald-600" />}
                                {hasRead('hr') && <QuickLink href="/admin/hr/shifts" icon={<Clock className="w-4 h-4" />} label="Shift Schedule" desc="Employee shifts" color="text-purple-600" />}
                                {hasRead('promos') && <QuickLink href="/admin/promos" icon={<Tag className="w-4 h-4" />} label="Promo Codes" desc="Discounts & offers" color="text-amber-600" />}
                                {hasRead('inventory') && <QuickLink href="/admin/medicines" icon={<Package className="w-4 h-4" />} label="Inventory" desc="Medicines & supplies" color="text-teal-600" />}
                                {hasRead('inventory') && <QuickLink href="/admin/resources" icon={<Briefcase className="w-4 h-4" />} label="Resources" desc="Equipment & rooms" color="text-orange-600" />}
                                {hasRead('hr') && <QuickLink href="/admin/hr/employees" icon={<Users className="w-4 h-4" />} label="HR — Employees" desc="Staff management" color="text-violet-600" />}
                                {hasRead('hr') && <QuickLink href="/admin/hr/payroll" icon={<DollarSign className="w-4 h-4" />} label="HR — Payroll" desc="Salary & timesheets" color="text-green-600" />}
                                {hasRead('settings') && <QuickLink href="/admin/settings" icon={<ShieldCheck className="w-4 h-4" />} label="Settings" desc="Config & permissions" color="text-gray-600" />}
                            </div>
                        </div>

                        {/* Shift Summary */}
                        {hasRead('hr') && shiftSummary && (
                            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl border border-purple-200 dark:border-purple-800 p-4">
                                <h3 className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <Zap className="w-3.5 h-3.5" /> Today&apos;s Shifts
                                </h3>
                                <div className="flex items-baseline gap-1 mb-1">
                                    <span className="text-2xl font-bold text-purple-700 dark:text-purple-300">{shiftSummary.scheduled}</span>
                                    <span className="text-xs text-purple-500 dark:text-purple-400">scheduled</span>
                                </div>
                                <div className="flex gap-3 text-[11px] text-purple-600 dark:text-purple-400">
                                    <span>{shiftSummary.offDuty} off duty</span>
                                    <span>{shiftSummary.clinicianAuto} auto-clinician</span>
                                </div>
                                <Link href="/admin/hr/shifts" className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium flex items-center justify-center gap-0.5 mt-3 pt-2 border-t border-purple-200 dark:border-purple-700">
                                    Open Shift Dashboard <ArrowRight className="w-3 h-3" />
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

// ── KPI Card ──
function KPICard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
    const styles: Record<string, string> = {
        indigo: 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400',
        blue: 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400',
        emerald: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400',
        green: 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400',
        red: 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400',
        purple: 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400',
    };
    return (
        <div className={`rounded-xl border p-3 ${styles[color] || styles.indigo}`}>
            <div className="flex items-center justify-between mb-1">{icon}</div>
            <p className="text-2xl font-bold leading-tight">{value}</p>
            <p className="text-[10px] font-medium opacity-70">{label}</p>
        </div>
    );
}

// ── Mini Stat (sidebar) ──
function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className={`rounded-lg px-2.5 py-2 ${color}`}>
            <p className="text-lg font-bold leading-tight">{value}</p>
            <p className="text-[10px] opacity-70">{label}</p>
        </div>
    );
}

// ── Quick Link (sidebar) ──
function QuickLink({ href, icon, label, desc, color }: { href: string; icon: React.ReactNode; label: string; desc: string; color: string }) {
    return (
        <Link href={href} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors group">
            <span className={`${color} opacity-80 group-hover:opacity-100 transition-opacity`}>{icon}</span>
            <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{label}</p>
                <p className="text-[10px] text-gray-400">{desc}</p>
            </div>
            <ArrowRight className="w-3 h-3 text-gray-300 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
    );
}

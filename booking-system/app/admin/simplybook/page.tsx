'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Calendar, Search, RefreshCw, ExternalLink, User, Clock,
    Stethoscope, CheckCircle, XCircle, AlertCircle, Loader2,
    Phone, Mail, Hash, ChevronRight, X, Wifi, WifiOff, Filter,
    AlertTriangle, Link2, CreditCard
} from 'lucide-react';
import type { SimplybookRecord } from '@/lib/simplybook-store';
import Link from 'next/link';

// â”€â”€ Types â”€â”€
type StatusFilter = 'all' | 'confirmed' | 'cancelled' | 'pending';
type MatchFilter  = 'all' | 'matched' | 'unmatched';

interface Stats { total: number; confirmed: number; cancelled: number; pending: number; }

// â”€â”€ Helpers â”€â”€
function statusBadge(status: SimplybookRecord['status']) {
    const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
        confirmed: { label: 'Confirmed', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: <CheckCircle className="w-3 h-3" /> },
        cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: <XCircle className="w-3 h-3" /> },
        pending:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: <AlertCircle className="w-3 h-3" /> },
        noshow:    { label: 'No Show',   cls: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400', icon: <XCircle className="w-3 h-3" /> },
        unknown:   { label: 'Unknown',   cls: 'bg-gray-100 text-gray-500', icon: <AlertCircle className="w-3 h-3" /> },
    };
    const s = map[status] || map.unknown;
    return (
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>
            {s.icon}{s.label}
        </span>
    );
}


function paymentBadge(record: SimplybookRecord) {
    const status = record.paymentStatus;
    const amount = record.invoiceAmount;
    const paid   = record.paidAmount;
    const cur    = record.invoiceCurrency || 'AED';
    if (!status || status === 'new') {
        return <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 px-1.5 py-0.5 rounded-full">No Invoice</span>;
    }
    if (status === 'paid') {
        return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 px-1.5 py-0.5 rounded-full">
                <CheckCircle className="w-2.5 h-2.5" /> Paid{amount ? ` · ${amount} ${cur}` : ''}{record.paymentType === 'online' ? ' · Online' : ''}
            </span>
        );
    }
    if (status === 'partial') {
        return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 px-1.5 py-0.5 rounded-full">
                <AlertCircle className="w-2.5 h-2.5" /> Partial{paid ? ` · ${paid}/${amount} ${cur}` : ''}
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 px-1.5 py-0.5 rounded-full">
            <XCircle className="w-2.5 h-2.5" /> Unpaid{amount ? ` · ${amount} ${cur}` : ''}
        </span>
    );
}
function formatTime(dt: string) {
    if (!dt) return 'â€”';
    const parts = dt.split(' ');
    return parts[1] ? parts[1].substring(0, 5) : dt;
}

function formatDate(d: string) {
    if (!d) return 'â€”';
    try {
        return new Date(d + 'T00:00:00').toLocaleDateString('en-AE', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return d; }
}

function today() { return new Date().toISOString().split('T')[0]; }
function sevenDaysAgo() {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
}

// â”€â”€ Detail Modal â”€â”€
function BookingDetailModal({ booking, onClose }: { booking: SimplybookRecord; onClose: () => void }) {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-5 text-white">
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-mono">SB#{booking.sbId}</span>
                                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">SimplyBook</span>
                                {booking.matchStatus === 'matched' ? (
                                    <span className="text-xs bg-emerald-400/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <Link2 className="w-3 h-3" /> Matched to Doctor
                                    </span>
                                ) : (
                                    <span className="text-xs bg-amber-400/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <Link2Off className="w-3 h-3" /> Doctor Not Found
                                    </span>
                                )}
                            </div>
                            <h2 className="text-xl font-bold">{booking.clientName}</h2>
                            <p className="text-indigo-100 text-sm mt-0.5">{booking.serviceName}</p>
                        </div>
                        <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                        {statusBadge(booking.status)}
                        <span className="text-xs text-indigo-100">via {booking.notificationType} event</span>
                    </div>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">
                    {/* Match info */}
                    {booking.matchStatus === 'matched' && booking.matchedDoctorId && (
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl p-3">
                            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1 flex items-center gap-1">
                                <Link2 className="w-3 h-3" /> Synced to Appointments Calendar
                            </p>
                            <p className="text-xs text-emerald-700 dark:text-emerald-300">
                                Doctor ID: <span className="font-mono">{booking.matchedDoctorId}</span>
                                {booking.syncedToBookingsId && <> Â· Booking: <span className="font-mono">{booking.syncedToBookingsId}</span></>}
                            </p>
                        </div>
                    )}
                    {booking.matchStatus === 'unmatched' && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3">
                            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> Provider Not Matched
                            </p>
                            <p className="text-xs text-amber-700 dark:text-amber-300">
                                "{booking.providerName}" was not found in the app's doctor list.
                                Add this doctor to a clinic to auto-assign future bookings.
                            </p>
                            <Link href="/admin/doctors" className="text-xs font-semibold text-amber-700 hover:underline mt-1 inline-block">
                                â†’ Manage Doctors
                            </Link>
                        </div>
                    )}

                    {/* Date & Time */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-3">
                            <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wider mb-1">Date</p>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">{formatDate(booking.date)}</p>
                        </div>
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-3">
                            <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wider mb-1">Time</p>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">
                                {formatTime(booking.startDateTime)} â€“ {formatTime(booking.endDateTime)}
                            </p>
                        </div>
                    </div>

                    {/* Service & Provider */}
                    <div className="space-y-2">
                        <Row icon={<Stethoscope className="w-4 h-4 text-purple-500" />} label="Service" value={booking.serviceName} />
                        <Row icon={<User className="w-4 h-4 text-blue-500" />} label="Provider" value={booking.providerName} />
                    </div>

                    {/* Client Info */}
                    <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Client Info</p>
                        <Row icon={<User className="w-4 h-4 text-gray-400" />} label="Name" value={booking.clientName} />
                        {booking.clientEmail && <Row icon={<Mail className="w-4 h-4 text-gray-400" />} label="Email" value={booking.clientEmail} />}
                        {booking.clientPhone && <Row icon={<Phone className="w-4 h-4 text-gray-400" />} label="Phone" value={booking.clientPhone} />}
                        <Row icon={<Hash className="w-4 h-4 text-gray-400" />} label="Client ID" value={booking.clientId || 'â€”'} />
                    </div>

                    {/* Meta */}
                    <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">System</p>
                        <Row icon={<Clock className="w-4 h-4 text-gray-400" />} label="Received"
                            value={new Date(booking.receivedAt).toLocaleString('en-AE')} />
                        <Row icon={<Clock className="w-4 h-4 text-gray-400" />} label="Updated"
                            value={new Date(booking.updatedAt).toLocaleString('en-AE')} />
                    </div>

                    {/* Link to SimplyBook */}
                    <a
                        href={`https://firstmedicalcenter.secure.simplybook.it/v2/management/#bookings/`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors mt-2"
                    >
                        <ExternalLink className="w-4 h-4" /> Open in SimplyBook
                    </a>
                </div>
            </div>
        </div>
    );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-center gap-2 text-sm">
            <span className="shrink-0">{icon}</span>
            <span className="text-gray-500 dark:text-gray-400 w-20 shrink-0">{label}</span>
            <span className="font-medium text-gray-900 dark:text-white truncate">{value}</span>
        </div>
    );
}

// â”€â”€ Stat Card â”€â”€
function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
    return (
        <div className={`rounded-2xl p-4 flex items-center gap-3 border ${color}`}>
            <div className="p-2 rounded-xl bg-white/60 dark:bg-black/20">{icon}</div>
            <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</p>
            </div>
        </div>
    );
}

// â”€â”€ Main Page â”€â”€
export default function SimplyBookPage() {
    const [bookings, setBookings] = useState<SimplybookRecord[]>([]);
    const [stats, setStats] = useState<Stats>({ total: 0, confirmed: 0, cancelled: 0, pending: 0 });
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [refreshingPayments, setRefreshingPayments] = useState(false);
    const [paymentRefreshResult, setPaymentRefreshResult] = useState<{invoicesFetched:number; bookingsUpdated:number} | null>(null);
    const [syncResult, setSyncResult] = useState<{synced:number; matched:number; unmatched:number} | null>(null);
    const [migrating, setMigrating] = useState(false);
    const [migrateResult, setMigrateResult] = useState<{migrated:number; skipped:number; matched:number; unmatched:number; total:number} | null>(null);
    const [lastSync, setLastSync] = useState<string | null>(null);
    const [lastMigrate, setLastMigrate] = useState<string | null>(null);
    const [webhookOnline, setWebhookOnline] = useState<boolean | null>(null);

    // Filters
    const [dateFrom, setDateFrom] = useState(sevenDaysAgo());
    const [dateTo, setDateTo] = useState(today());
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [matchFilter, setMatchFilter] = useState<MatchFilter>('all');
    const [search, setSearch] = useState('');

    // Detail modal
    const [selected, setSelected] = useState<SimplybookRecord | null>(null);

    const fetchBookings = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                from: dateFrom,
                to: dateTo,
                ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
                ...(matchFilter !== 'all'  ? { match:  matchFilter  } : {}),
                ...(search ? { search } : {}),
            });
            const res = await fetch(`/api/admin/simplybook?${params}`);
            if (res.ok) setBookings(await res.json());
        } catch { /* ignore */ } finally { setLoading(false); }
    }, [dateFrom, dateTo, statusFilter, matchFilter, search]);

    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch(`/api/admin/simplybook?stats=1&date=${today()}`);
            if (res.ok) setStats(await res.json());
        } catch { /* ignore */ }
    }, []);

    // Check webhook health
    const checkWebhook = useCallback(async () => {
        try {
            const res = await fetch('/api/webhooks/simplybook');
            setWebhookOnline(res.ok);
        } catch { setWebhookOnline(false); }
    }, []);

    useEffect(() => {
        fetchBookings();
        fetchStats();
        checkWebhook();
    }, [fetchBookings, fetchStats, checkWebhook]);

    // ── Super Admin role guard ──
    const [currentUser, setCurrentUser] = useState<{ role?: string } | null>(null);
    const [roleChecked, setRoleChecked] = useState(false);
    useEffect(() => {
        try {
            const stored = sessionStorage.getItem('adminUser');
            setCurrentUser(stored ? JSON.parse(stored) : null);
        } catch { setCurrentUser(null); }
        setRoleChecked(true);
    }, []);

    if (roleChecked && currentUser?.role !== 'SUPER_ADMIN') return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-8">
            <div className="text-center max-w-sm">
                <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Restricted</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    The SimplyBook Sync page is only accessible to Super Admins.
                </p>
                <Link href="/admin" className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors">
                    ← Back to Dashboard
                </Link>
            </div>
        </div>
    );

    const handleManualSync = async () => {
        setSyncing(true);
        try {
            const params = new URLSearchParams({ sync: 'true', from: dateFrom, to: dateTo });
            const res = await fetch(`/api/admin/simplybook?${params}`);
            const data = await res.json();
            if (res.ok && data.ok) {
                setLastSync(`${new Date().toLocaleTimeString('en-AE')} (${data.synced} bookings)`);
                setSyncResult({ synced: data.synced, matched: data.matched ?? 0, unmatched: data.unmatched ?? 0 });
            } else {
                console.error('Sync error:', data);
            }
            await fetchBookings();
            await fetchStats();
        } catch (err) {
            console.error('Sync failed:', err);
        } finally {
            setSyncing(false);
        }
    };

    const handleRefreshPayments = async () => {
        setRefreshingPayments(true);
        setPaymentRefreshResult(null);
        try {
            const params = new URLSearchParams({ refresh_payments: 'true', from: dateFrom, to: dateTo });
            const res = await fetch(`/api/admin/simplybook?${params}`);
            const data = await res.json();
            if (res.ok && data.ok) {
                setPaymentRefreshResult({ invoicesFetched: data.invoicesFetched ?? 0, bookingsUpdated: data.bookingsUpdated ?? 0 });
            } else {
                alert(`Payment refresh failed: ${data.error || 'Unknown error'}`);
            }
            await fetchBookings();
        } catch (err) {
            console.error('Payment refresh failed:', err);
        } finally {
            setRefreshingPayments(false);
        }
    };

    const handleMigrate = async (from: string, to: string) => {
        setMigrating(true);
        setMigrateResult(null);
        try {
            const params = new URLSearchParams({ migrate: 'true', from, to });
            const res = await fetch(`/api/admin/simplybook?${params}`);
            const data = await res.json();
            if (res.ok && data.ok) {
                setMigrateResult({ migrated: data.migrated ?? 0, skipped: data.skipped ?? 0, matched: data.matched ?? 0, unmatched: data.unmatched ?? 0, total: data.total ?? 0 });
                setLastMigrate(`${new Date().toLocaleTimeString('en-AE')} — ${data.migrated} migrated`);
            } else {
                alert(`Migration failed: ${data.error || 'Unknown error'}`);
            }
            await fetchBookings();
            await fetchStats();
        } catch (err) {
            console.error('Migration failed:', err);
        } finally {
            setMigrating(false);
        }
    };

    const migrateRange = (days: number) => {
        const t = today();
        const f = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        handleMigrate(f, t);
    };

    // Debounced search re-fetch
    useEffect(() => {
        const t = setTimeout(() => fetchBookings(), 350);
        return () => clearTimeout(t);
    }, [search]);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* â”€â”€ Header â”€â”€ */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                                webhookOnline === null ? 'bg-gray-100 text-gray-400' :
                                webhookOnline ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                            }`}>
                                {webhookOnline === null ? <Loader2 className="w-3 h-3 animate-spin" /> :
                                 webhookOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                                {webhookOnline === null ? 'Checking...' : webhookOnline ? 'Webhook Active' : 'Webhook Offline'}
                            </span>
                            {lastSync && <span className="text-xs text-gray-400">Last sync: {lastSync}</span>}
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                            <Calendar className="w-8 h-8 text-indigo-500" />
                            SimplyBook Bookings
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                            Live bookings from <span className="font-semibold text-indigo-500">firstmedicalcenter.simplybook.it</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleManualSync}
                            disabled={syncing}
                            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                            {syncing ? 'Importing...' : 'Import from SimplyBook'}
                        </button>
                        <button
                            onClick={handleRefreshPayments}
                            disabled={refreshingPayments}
                            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow transition-colors disabled:opacity-50"
                        >
                            <CreditCard className={`w-4 h-4 ${refreshingPayments ? 'animate-pulse' : ''}`} />
                            {refreshingPayments ? 'Refreshing...' : 'Refresh Payments'}
                        </button>
                        <a
                            href="https://firstmedicalcenter.secure.simplybook.it/v2/management/"
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl shadow-sm hover:bg-gray-50 transition-colors"
                        >
                            <ExternalLink className="w-4 h-4" />
                            SimplyBook Admin
                        </a>
                    </div>
                </div>

                {/* â”€â”€ Stat Cards â”€â”€ */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard label="Today Total" value={stats.total}
                        color="bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300"
                        icon={<Calendar className="w-5 h-5 text-indigo-500" />} />
                    <StatCard label="Confirmed" value={stats.confirmed}
                        color="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                        icon={<CheckCircle className="w-5 h-5 text-emerald-500" />} />
                    <StatCard label="Cancelled" value={stats.cancelled}
                        color="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
                        icon={<XCircle className="w-5 h-5 text-red-500" />} />
                    <StatCard label="Pending" value={stats.pending}
                        color="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
                        icon={<AlertCircle className="w-5 h-5 text-amber-500" />} />
                </div>

                {/* â”€â”€ Post-Sync Result Banner â”€â”€ */}
                
                {/* Migration Panel */}
                <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-5 text-white shadow-lg">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <ExternalLink className="w-5 h-5" /> Migrate SimplyBook to New App
                            </h2>
                            <p className="text-violet-100 text-sm mt-1">
                                Import bookings into the Appointments calendar. Unmatched providers are grouped for review.
                            </p>
                            {lastMigrate && <p className="text-violet-200 text-xs mt-1">Last: {lastMigrate}</p>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {[{label:'This Week',days:7},{label:'30 Days',days:30},{label:'90 Days',days:90},{label:'6 Months',days:180},{label:'1 Year',days:365}].map(({label, days}) => (
                                <button key={days} disabled={migrating}
                                    onClick={() => migrateRange(days)}
                                    className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
                                    {label}
                                </button>
                            ))}
                            <button disabled={migrating}
                                onClick={() => handleMigrate(dateFrom, dateTo)}
                                className="flex items-center gap-1.5 px-4 py-2 bg-white text-violet-700 text-sm font-bold rounded-xl shadow hover:bg-violet-50 transition-colors disabled:opacity-50">
                                {migrating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                {migrating ? 'Migrating...' : 'Migrate Selected Range'}
                            </button>
                        </div>
                    </div>
                    {migrateResult && (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-4">
                            {[
                                {label:'Total SB', value: migrateResult.total, cls:'bg-white/10'},
                                {label:'Migrated', value: migrateResult.migrated, cls:'bg-emerald-500/30'},
                                {label:'Already Exists', value: migrateResult.skipped, cls:'bg-white/10'},
                                {label:'Matched', value: migrateResult.matched, cls:'bg-emerald-500/30'},
                                {label:'Unmatched', value: migrateResult.unmatched, cls:'bg-amber-500/30'},
                            ].map(({label, value, cls}) => (
                                <div key={label} className={`${cls} rounded-xl p-3 text-center`}>
                                    <p className="text-xl font-bold">{value}</p>
                                    <p className="text-xs text-white/80">{label}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
{syncResult && (
                    <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-xl p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 text-center">
                            <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{syncResult.synced}</p>
                            <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider">Total Synced</p>
                        </div>
                        <div className="rounded-xl p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-center">
                            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{syncResult.matched}</p>
                            <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wider">Matched to Doctors</p>
                        </div>
                        <div className="rounded-xl p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-center cursor-pointer"
                            onClick={() => setMatchFilter('unmatched')}>
                            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{syncResult.unmatched}</p>
                            <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider">Unmatched â†’ Review</p>
                        </div>
                    </div>
                )}

                {/* â”€â”€ Webhook Setup Banner â”€â”€ */}
                {bookings.length === 0 && !loading && (
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-5">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl">
                                <Wifi className="w-5 h-5 text-indigo-500" />
                            </div>
                            <div>
                                <h3 className="font-bold text-indigo-900 dark:text-indigo-200 mb-1">Set Up Your SimplyBook Webhook</h3>
                                <p className="text-sm text-indigo-700 dark:text-indigo-300 mb-3">
                                    No bookings received yet. Bookings will appear here automatically once you configure the webhook in SimplyBook.
                                </p>
                                <div className="bg-white dark:bg-gray-900 rounded-xl p-3 font-mono text-xs text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 mb-3 break-all">
                                    https://ai.dubaifmc.com/api/webhooks/simplybook
                                </div>
                                <ol className="text-sm text-indigo-700 dark:text-indigo-300 space-y-1 list-decimal list-inside">
                                    <li>Go to SimplyBook Admin â†’ Custom Features â†’ API</li>
                                    <li>Scroll to <strong>Callback URL</strong> and paste the URL above</li>
                                    <li>Enable triggers: <strong>Create, Change, Cancel, Remind</strong></li>
                                    <li>Click Save â€” bookings will flow in automatically</li>
                                </ol>
                            </div>
                        </div>
                    </div>
                )}

                {/* â”€â”€ Filters â”€â”€ */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
                    <div className="flex flex-wrap gap-3 items-end">
                        <div className="flex-1 min-w-[140px]">
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5">From</label>
                            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); fetchBookings(); }}
                                className="w-full p-2 text-sm border rounded-xl dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                        <div className="flex-1 min-w-[140px]">
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5">To</label>
                            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); fetchBookings(); }}
                                className="w-full p-2 text-sm border rounded-xl dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                        <div className="flex-1 min-w-[140px]">
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Status</label>
                            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                                className="w-full p-2 text-sm border rounded-xl dark:bg-gray-700 dark:border-gray-600">
                                <option value="all">All Statuses</option>
                                <option value="confirmed">Confirmed</option>
                                <option value="cancelled">Cancelled</option>
                                <option value="pending">Pending</option>
                            </select>
                        </div>
                        <div className="flex-1 min-w-[140px]">
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Doctor Match</label>
                            <select value={matchFilter} onChange={e => setMatchFilter(e.target.value as MatchFilter)}
                                className="w-full p-2 text-sm border rounded-xl dark:bg-gray-700 dark:border-gray-600">
                                <option value="all">All Bookings</option>
                                <option value="matched">âœ… Matched (in Calendar)</option>
                                <option value="unmatched">âš ï¸ Unmatched (Review)</option>
                            </select>
                        </div>
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Search</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <input type="text" placeholder="Patient, service, phone..." value={search} onChange={e => setSearch(e.target.value)}
                                    className="w-full pl-9 p-2 text-sm border rounded-xl dark:bg-gray-700 dark:border-gray-600" />
                            </div>
                        </div>
                        <button onClick={fetchBookings}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors">
                            <Filter className="w-4 h-4" /> Apply
                        </button>
                    </div>
                </div>

                {/* â”€â”€ Bookings Table â”€â”€ */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                            <p className="text-sm">Loading SimplyBook bookings...</p>
                        </div>
                    ) : bookings.length === 0 ? (
                        <div className="text-center py-20">
                            <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                            <p className="text-gray-500 text-sm">No bookings found for this period</p>
                            <p className="text-gray-400 text-xs mt-1">Try adjusting the date range or filters</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                                        <th className="px-4 py-3">Date & Time</th>
                                        <th className="px-4 py-3">Client</th>
                                        <th className="px-4 py-3">Service</th>
                                        <th className="px-4 py-3">Provider</th>
                                        <th className="px-4 py-3">Status</th>
                                         <th className="px-4 py-3">Payment</th>
                                        <th className="px-4 py-3">Source</th>
                                        <th className="px-4 py-3 text-right">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {bookings.map(b => (
                                        <tr key={b.sbId}
                                            className={`hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors cursor-pointer ${
                                                b.matchStatus === 'unmatched' ? 'bg-amber-50/40 dark:bg-amber-900/5' : ''
                                            }`}
                                            onClick={() => setSelected(b)}>
                                            <td className="px-4 py-3">
                                                <p className="font-semibold text-gray-900 dark:text-white">{formatDate(b.date)}</p>
                                                <p className="text-xs text-indigo-500 flex items-center gap-1 mt-0.5">
                                                    <Clock className="w-3 h-3" />
                                                    {formatTime(b.startDateTime)} â€“ {formatTime(b.endDateTime)}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="font-medium text-gray-900 dark:text-white">{b.clientName}</p>
                                                {b.clientPhone && (
                                                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                                        <Phone className="w-3 h-3" />{b.clientPhone}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-gray-700 dark:text-gray-300">{b.serviceName}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                                    <Stethoscope className="w-3 h-3 text-gray-400" />{b.providerName}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3">{statusBadge(b.status)}</td>
                                             <td className="px-4 py-3">{paymentBadge(b)}</td>
                                            <td className="px-4 py-3">
                                                {b.matchStatus === 'matched' ? (
                                                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                                        <Link2 className="w-3 h-3" /> In Calendar
                                                    </span>
                                                ) : b.matchStatus === 'unmatched' ? (
                                                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                                        <AlertTriangle className="w-3 h-3" /> Review
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                                                        <ExternalLink className="w-3 h-3" /> SimplyBook
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button className="p-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg transition-colors text-indigo-500">
                                                    <ChevronRight className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Footer */}
                    {bookings.length > 0 && (
                        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 flex items-center justify-between">
                            <span>{bookings.length} booking{bookings.length !== 1 ? 's' : ''} shown</span>
                            <span>Auto-updates via webhook Â· SimplyBook.me</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Detail Modal */}
            {selected && <BookingDetailModal booking={selected} onClose={() => setSelected(null)} />}
        </div>
    );
}

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    BarChart2, TrendingUp, Calendar, MapPin, Stethoscope, Activity, Pill, ShoppingCart,
    Users, Clock, ArrowUpRight, ArrowDownRight, Package, UserX, ChevronDown, ChevronUp
} from 'lucide-react';
import { Clinic, Booking, Service, Medicine, PurchaseRecord } from '@/lib/data';

type Period = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
type Tab = 'overview' | 'branches' | 'doctors' | 'services' | 'medicines' | 'purchases' | 'clients';

function getPeriodRange(period: Period): { start: Date; end: Date; label: string } {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    let start: Date;
    let label: string;

    switch (period) {
        case 'daily':
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
            label = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            break;
        case 'weekly':
            start = new Date(now);
            start.setDate(now.getDate() - now.getDay());
            start.setHours(0, 0, 0, 0);
            label = `Week of ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
            break;
        case 'monthly':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            label = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            break;
        case 'quarterly':
            const quarter = Math.floor(now.getMonth() / 3);
            start = new Date(now.getFullYear(), quarter * 3, 1);
            label = `Q${quarter + 1} ${now.getFullYear()}`;
            break;
        case 'yearly':
            start = new Date(now.getFullYear(), 0, 1);
            label = `${now.getFullYear()}`;
            break;
    }

    return { start, end, label };
}

export default function ReportsPage() {
    const [period, setPeriod] = useState<Period>('monthly');
    const [tab, setTab] = useState<Tab>('overview');
    const [clinics, setClinics] = useState<Clinic[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch('/api/admin/clinics').then(r => r.ok ? r.json() : []),
            fetch('/api/admin/bookings').then(r => r.ok ? r.json() : []),
            fetch('/api/admin/medicines').then(r => r.ok ? r.json() : []),
            fetch('/api/admin/purchases').then(r => r.ok ? r.json() : []),
        ]).then(([c, b, m, p]) => {
            setClinics(c);
            setBookings(b);
            setMedicines(m);
            setPurchases(p);
        }).finally(() => setIsLoading(false));
    }, []);

    const { start, end, label: periodLabel } = useMemo(() => getPeriodRange(period), [period]);

    // Filter bookings by period
    const filteredBookings = useMemo(() => {
        return bookings.filter(b => {
            const d = new Date(b.createdAt || b.date);
            return d >= start && d <= end;
        });
    }, [bookings, start, end]);

    // Filter purchases by period
    const filteredPurchases = useMemo(() => {
        return purchases.filter(p => {
            const d = new Date(p.purchaseDate);
            return d >= start && d <= end;
        });
    }, [purchases, start, end]);

    // All services across all clinics
    const allServices = useMemo(() => {
        const svcs: Service[] = [];
        clinics.forEach(c => c.departments?.forEach(d => d.services?.forEach(s => {
            if (!svcs.find(x => x.id === s.id)) svcs.push(s);
        })));
        return svcs;
    }, [clinics]);

    // All doctors across all clinics
    const allDoctors = useMemo(() => {
        const docs: { id: string; name: string; specialty: string; clinicId: string; clinicName: string }[] = [];
        clinics.forEach(c => c.departments?.forEach(d => d.doctors?.forEach(doc => {
            if (!docs.find(x => x.id === doc.id)) docs.push({ ...doc, clinicId: c.id, clinicName: c.name });
        })));
        return docs;
    }, [clinics]);

    // Helper to get name by ID
    const getClinicName = (id: string) => clinics.find(c => c.id === id)?.name || id;
    const getServiceName = (id: string) => allServices.find(s => s.id === id)?.name || id;
    const getDoctorName = (id: string) => allDoctors.find(d => d.id === id)?.name || id;
    const getMedicineName = (id: string) => medicines.find(m => m.id === id)?.name || id;

    // Overview stats
    const overviewStats = useMemo(() => {
        const activeBookings = filteredBookings.filter(b => b.status !== 'cancelled' && b.status !== 'noshow');
        const totalBookings = activeBookings.length;
        const completedBookings = filteredBookings.filter(b => b.status === 'completed').length;
        const cancelledBookings = filteredBookings.filter(b => b.status === 'cancelled').length;
        const revenue = filteredBookings.reduce((sum, b) => {
            const svc = allServices.find(s => s.id === b.serviceId);
            return sum + (svc?.price || 0);
        }, 0);
        const { start: prevStart, end: prevEnd } = (() => {
            const diff = end.getTime() - start.getTime();
            return { start: new Date(start.getTime() - diff), end: new Date(start.getTime() - 1) };
        })();
        const prevBookings = bookings.filter(b => {
            const d = new Date(b.createdAt || b.date);
            return d >= prevStart && d <= prevEnd && b.status !== 'cancelled' && b.status !== 'noshow';
        });
        const bookingChange = prevBookings.length > 0
            ? ((totalBookings - prevBookings.length) / prevBookings.length * 100)
            : 0;
        const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        const avgPerDay = totalBookings / days;

        // Top service
        const svcCounts: Record<string, number> = {};
        activeBookings.forEach(b => { svcCounts[b.serviceId] = (svcCounts[b.serviceId] || 0) + 1; });
        const topServiceId = Object.entries(svcCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

        return { totalBookings, completedBookings, cancelledBookings, revenue, bookingChange, avgPerDay, topServiceId };
    }, [filteredBookings, allServices, bookings, start, end]);

    // Branch stats
    const branchStats = useMemo(() => {
        return clinics.map(clinic => {
            const cb = filteredBookings.filter(b => b.clinicId === clinic.id);
            const revenue = cb.reduce((s, b) => s + (allServices.find(sv => sv.id === b.serviceId)?.price || 0), 0);
            const svcCounts: Record<string, number> = {};
            const docCounts: Record<string, number> = {};
            cb.forEach(b => {
                svcCounts[b.serviceId] = (svcCounts[b.serviceId] || 0) + 1;
                docCounts[b.doctorId] = (docCounts[b.doctorId] || 0) + 1;
            });
            const topSvc = Object.entries(svcCounts).sort((a, b) => b[1] - a[1])[0];
            const topDoc = Object.entries(docCounts).sort((a, b) => b[1] - a[1])[0];
            return {
                id: clinic.id,
                name: clinic.name,
                bookings: cb.filter(b => b.status !== 'cancelled').length,
                completed: cb.filter(b => b.status === 'completed').length,
                cancelled: cb.filter(b => b.status === 'cancelled').length,
                revenue,
                topService: topSvc ? getServiceName(topSvc[0]) : '—',
                topDoctor: topDoc ? getDoctorName(topDoc[0]) : '—',
            };
        });
    }, [clinics, filteredBookings, allServices]);

    // Doctor stats
    const doctorStats = useMemo(() => {
        return allDoctors.map(doc => {
            const db = filteredBookings.filter(b => b.doctorId === doc.id);
            const revenue = db.reduce((s, b) => s + (allServices.find(sv => sv.id === b.serviceId)?.price || 0), 0);
            const uniquePatients = new Set(db.map(b => b.patientName)).size;
            const svcCounts: Record<string, number> = {};
            db.forEach(b => { svcCounts[b.serviceId] = (svcCounts[b.serviceId] || 0) + 1; });
            const topSvc = Object.entries(svcCounts).sort((a, b) => b[1] - a[1])[0];
            return {
                id: doc.id,
                name: doc.name,
                specialty: doc.specialty,
                clinic: doc.clinicName,
                bookings: db.filter(b => b.status !== 'cancelled').length,
                patients: uniquePatients,
                revenue,
                topService: topSvc ? getServiceName(topSvc[0]) : '—',
            };
        }).sort((a, b) => b.bookings - a.bookings);
    }, [allDoctors, filteredBookings, allServices]);

    // Service stats
    const serviceStats = useMemo(() => {
        return allServices.map(svc => {
            const sb = filteredBookings.filter(b => b.serviceId === svc.id);
            const revenue = sb.length * svc.price;
            return {
                id: svc.id,
                name: svc.name,
                category: svc.category || '—',
                price: svc.price,
                duration: svc.duration,
                bookings: sb.filter(b => b.status !== 'cancelled').length,
                revenue,
                isTaxable: svc.isTaxable,
            };
        }).sort((a, b) => b.bookings - a.bookings);
    }, [allServices, filteredBookings]);

    // Medicine stats
    const medicineStats = useMemo(() => {
        // Count dispensed from bookings where selectedMedicineIds includes this med
        return medicines.map(med => {
            const dispensed = filteredBookings.filter(b => b.selectedMedicineIds?.includes(med.id)).length;
            const totalStock = med.centralStock + (med.branchStock || []).reduce((s, bs) => s + bs.quantity, 0);
            const isLow = med.minCentralStock ? med.centralStock <= med.minCentralStock : false;
            const purchaseCost = filteredPurchases.reduce((sum, p) => {
                const item = p.items?.find(i => i.medicineId === med.id);
                return sum + (item ? item.quantity * item.unitPrice : 0);
            }, 0);
            return {
                id: med.id,
                name: med.name,
                category: med.category || 'medicine',
                dispensed,
                centralStock: med.centralStock,
                totalStock,
                isLow,
                purchaseCost,
                price: med.price,
            };
        }).sort((a, b) => b.dispensed - a.dispensed);
    }, [medicines, filteredBookings, filteredPurchases]);

    // Purchase stats
    const purchaseStats = useMemo(() => {
        const totalSpend = filteredPurchases.reduce((s, p) => s + p.totalAmount, 0);
        const totalItems = filteredPurchases.reduce((s, p) => s + (p.items?.length || 0), 0);
        const totalUnits = filteredPurchases.reduce((s, p) => s + (p.items?.reduce((u, i) => u + i.quantity, 0) || 0), 0);
        // Supplier breakdown
        const supplierSpend: Record<string, number> = {};
        filteredPurchases.forEach(p => {
            supplierSpend[p.supplierId] = (supplierSpend[p.supplierId] || 0) + p.totalAmount;
        });

        return { totalSpend, totalItems, totalUnits, count: filteredPurchases.length, supplierSpend };
    }, [filteredPurchases]);

    // Client retention / inactive clients
    const retentionBuckets = useMemo(() => {
        const now = new Date();
        const DAY = 1000 * 60 * 60 * 24;

        // Build map: client key -> { name, whatsapp, email, lastVisit }
        const clientMap: Record<string, { name: string; whatsapp: string; email: string; lastVisit: Date }> = {};
        bookings.forEach(b => {
            if (b.status === 'cancelled') return;
            const key = b.patientName.trim().toLowerCase();
            const d = new Date(b.date || b.createdAt);
            if (!clientMap[key] || d > clientMap[key].lastVisit) {
                clientMap[key] = {
                    name: b.patientName,
                    whatsapp: b.whatsappNumber || '',
                    email: b.email || '',
                    lastVisit: d,
                };
            }
        });

        const buckets: {
            label: string;
            minDays: number;
            maxDays: number;
            color: string;
            badgeBg: string;
            clients: { name: string; whatsapp: string; email: string; lastVisit: Date; daysSince: number }[];
        }[] = [
                { label: '30 – 60 days', minDays: 30, maxDays: 60, color: 'text-yellow-600', badgeBg: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400', clients: [] },
                { label: '60 – 90 days', minDays: 60, maxDays: 90, color: 'text-amber-600', badgeBg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400', clients: [] },
                { label: '90 – 120 days', minDays: 90, maxDays: 120, color: 'text-orange-600', badgeBg: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400', clients: [] },
                { label: '120 – 180 days', minDays: 120, maxDays: 180, color: 'text-red-500', badgeBg: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400', clients: [] },
                { label: '180 – 365 days', minDays: 180, maxDays: 365, color: 'text-red-600', badgeBg: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400', clients: [] },
                { label: '1 – 2 years', minDays: 365, maxDays: 730, color: 'text-red-700', badgeBg: 'bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-300', clients: [] },
                { label: 'More than 2 years', minDays: 730, maxDays: Infinity, color: 'text-gray-600', badgeBg: 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300', clients: [] },
            ];

        Object.values(clientMap).forEach(client => {
            const daysSince = Math.floor((now.getTime() - client.lastVisit.getTime()) / DAY);
            if (daysSince < 30) return; // active clients, skip
            for (const bucket of buckets) {
                if (daysSince >= bucket.minDays && daysSince < bucket.maxDays) {
                    bucket.clients.push({ ...client, daysSince });
                    break;
                }
            }
        });

        // Sort each bucket by days since (most inactive first)
        buckets.forEach(b => b.clients.sort((a, c) => c.daysSince - a.daysSince));

        return { buckets, totalInactive: buckets.reduce((s, b) => s + b.clients.length, 0), totalClients: Object.keys(clientMap).length };
    }, [bookings]);

    const [expandedBucket, setExpandedBucket] = useState<number | null>(null);

    const periods: { key: Period; label: string }[] = [
        { key: 'daily', label: 'Daily' },
        { key: 'weekly', label: 'Weekly' },
        { key: 'monthly', label: 'Monthly' },
        { key: 'quarterly', label: 'Quarterly' },
        { key: 'yearly', label: 'Yearly' },
    ];

    const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
        { key: 'overview', label: 'Overview', icon: <BarChart2 className="w-4 h-4" /> },
        { key: 'branches', label: 'Branches', icon: <MapPin className="w-4 h-4" /> },
        { key: 'doctors', label: 'Doctors', icon: <Stethoscope className="w-4 h-4" /> },
        { key: 'services', label: 'Services', icon: <Activity className="w-4 h-4" /> },
        { key: 'medicines', label: 'Medicines', icon: <Pill className="w-4 h-4" /> },
        { key: 'purchases', label: 'Purchases', icon: <ShoppingCart className="w-4 h-4" /> },
        { key: 'clients', label: 'Clients', icon: <UserX className="w-4 h-4" /> },
    ];

    if (isLoading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-gray-500">Loading reports...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <BarChart2 className="h-6 w-6 text-indigo-600" />
                    Clinical Reports
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{periodLabel}</p>
            </div>

            {/* Period Filter */}
            <div className="flex flex-wrap gap-2 mb-6">
                {periods.map(p => (
                    <button
                        key={p.key}
                        onClick={() => setPeriod(p.key)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${period === p.key
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-indigo-300 hover:text-indigo-600'
                            }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl overflow-x-auto">
                {tabs.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${tab === t.key
                            ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                            }`}
                    >
                        {t.icon}
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="space-y-6">
                {/* ============ OVERVIEW ============ */}
                {tab === 'overview' && (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard
                                title="Total Bookings"
                                value={overviewStats.totalBookings}
                                change={overviewStats.bookingChange}
                                icon={<Calendar className="w-5 h-5" />}
                                color="indigo"
                            />
                            <StatCard
                                title="Revenue"
                                value={`${overviewStats.revenue.toLocaleString()} AED`}
                                icon={<TrendingUp className="w-5 h-5" />}
                                color="emerald"
                            />
                            <StatCard
                                title="Avg / Day"
                                value={overviewStats.avgPerDay.toFixed(1)}
                                icon={<Clock className="w-5 h-5" />}
                                color="amber"
                            />
                            <StatCard
                                title="Top Service"
                                value={overviewStats.topServiceId ? getServiceName(overviewStats.topServiceId) : '—'}
                                icon={<Activity className="w-5 h-5" />}
                                color="violet"
                                isText
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <StatCard
                                title="Completed"
                                value={overviewStats.completedBookings}
                                icon={<ArrowUpRight className="w-5 h-5" />}
                                color="green"
                            />
                            <StatCard
                                title="Cancelled"
                                value={overviewStats.cancelledBookings}
                                icon={<ArrowDownRight className="w-5 h-5" />}
                                color="red"
                            />
                            <StatCard
                                title="Active Clinics"
                                value={clinics.length}
                                icon={<MapPin className="w-5 h-5" />}
                                color="blue"
                            />
                        </div>
                    </>
                )}

                {/* ============ BRANCHES ============ */}
                {tab === 'branches' && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs uppercase tracking-wider text-gray-500">
                                        <th className="p-4">Branch</th>
                                        <th className="p-4 text-center">Bookings</th>
                                        <th className="p-4 text-center">Completed</th>
                                        <th className="p-4 text-center">Cancelled</th>
                                        <th className="p-4 text-right">Revenue</th>
                                        <th className="p-4">Top Service</th>
                                        <th className="p-4">Top Doctor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {branchStats.map(b => (
                                        <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                            <td className="p-4 font-medium text-gray-900 dark:text-white">{b.name}</td>
                                            <td className="p-4 text-center">{b.bookings}</td>
                                            <td className="p-4 text-center text-green-600">{b.completed}</td>
                                            <td className="p-4 text-center text-red-500">{b.cancelled}</td>
                                            <td className="p-4 text-right font-semibold text-indigo-600 dark:text-indigo-400">{b.revenue.toLocaleString()} AED</td>
                                            <td className="p-4 text-gray-600 dark:text-gray-400 text-xs">{b.topService}</td>
                                            <td className="p-4 text-gray-600 dark:text-gray-400 text-xs">{b.topDoctor}</td>
                                        </tr>
                                    ))}
                                    {branchStats.length === 0 && (
                                        <tr><td colSpan={7} className="p-8 text-center text-gray-400">No branch data for this period.</td></tr>
                                    )}
                                </tbody>
                                {branchStats.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-900 dark:text-white">
                                            <td className="p-4">Total</td>
                                            <td className="p-4 text-center">{branchStats.reduce((s, b) => s + b.bookings, 0)}</td>
                                            <td className="p-4 text-center text-green-600">{branchStats.reduce((s, b) => s + b.completed, 0)}</td>
                                            <td className="p-4 text-center text-red-500">{branchStats.reduce((s, b) => s + b.cancelled, 0)}</td>
                                            <td className="p-4 text-right text-indigo-600 dark:text-indigo-400">{branchStats.reduce((s, b) => s + b.revenue, 0).toLocaleString()} AED</td>
                                            <td className="p-4" colSpan={2}></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                )}

                {/* ============ DOCTORS ============ */}
                {tab === 'doctors' && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs uppercase tracking-wider text-gray-500">
                                        <th className="p-4">Doctor</th>
                                        <th className="p-4">Specialty</th>
                                        <th className="p-4">Branch</th>
                                        <th className="p-4 text-center">Bookings</th>
                                        <th className="p-4 text-center">Patients</th>
                                        <th className="p-4 text-right">Revenue</th>
                                        <th className="p-4">Top Service</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {doctorStats.map(d => (
                                        <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                            <td className="p-4 font-medium text-gray-900 dark:text-white">{d.name}</td>
                                            <td className="p-4 text-gray-500 text-xs">{d.specialty}</td>
                                            <td className="p-4 text-gray-500 text-xs">{d.clinic}</td>
                                            <td className="p-4 text-center">{d.bookings}</td>
                                            <td className="p-4 text-center">{d.patients}</td>
                                            <td className="p-4 text-right font-semibold text-indigo-600 dark:text-indigo-400">{d.revenue.toLocaleString()} AED</td>
                                            <td className="p-4 text-gray-600 dark:text-gray-400 text-xs">{d.topService}</td>
                                        </tr>
                                    ))}
                                    {doctorStats.length === 0 && (
                                        <tr><td colSpan={7} className="p-8 text-center text-gray-400">No doctor data for this period.</td></tr>
                                    )}
                                </tbody>
                                {doctorStats.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-900 dark:text-white">
                                            <td className="p-4">Total ({doctorStats.length} doctors)</td>
                                            <td className="p-4" colSpan={2}></td>
                                            <td className="p-4 text-center">{doctorStats.reduce((s, d) => s + d.bookings, 0)}</td>
                                            <td className="p-4 text-center">{doctorStats.reduce((s, d) => s + d.patients, 0)}</td>
                                            <td className="p-4 text-right text-indigo-600 dark:text-indigo-400">{doctorStats.reduce((s, d) => s + d.revenue, 0).toLocaleString()} AED</td>
                                            <td className="p-4"></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                )}

                {/* ============ SERVICES ============ */}
                {tab === 'services' && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs uppercase tracking-wider text-gray-500">
                                        <th className="p-4">#</th>
                                        <th className="p-4">Service</th>
                                        <th className="p-4">Category</th>
                                        <th className="p-4 text-right">Price</th>
                                        <th className="p-4 text-center">Duration</th>
                                        <th className="p-4 text-center">Bookings</th>
                                        <th className="p-4 text-right">Revenue</th>
                                        <th className="p-4 text-center">VAT</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {serviceStats.map((s, idx) => (
                                        <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                            <td className="p-4 text-gray-400 text-xs">{idx + 1}</td>
                                            <td className="p-4 font-medium text-gray-900 dark:text-white">{s.name}</td>
                                            <td className="p-4">
                                                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs text-gray-600 dark:text-gray-300">{s.category}</span>
                                            </td>
                                            <td className="p-4 text-right">{s.price} AED</td>
                                            <td className="p-4 text-center text-gray-500">{s.duration} min</td>
                                            <td className="p-4 text-center font-medium">{s.bookings}</td>
                                            <td className="p-4 text-right font-semibold text-indigo-600 dark:text-indigo-400">{s.revenue.toLocaleString()} AED</td>
                                            <td className="p-4 text-center">
                                                {s.isTaxable ? <span className="text-xs text-orange-600 bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 rounded">+VAT</span> : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                    {serviceStats.length === 0 && (
                                        <tr><td colSpan={8} className="p-8 text-center text-gray-400">No service data for this period.</td></tr>
                                    )}
                                </tbody>
                                {serviceStats.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-900 dark:text-white">
                                            <td className="p-4"></td>
                                            <td className="p-4">Total ({serviceStats.length} services)</td>
                                            <td className="p-4" colSpan={3}></td>
                                            <td className="p-4 text-center">{serviceStats.reduce((s, sv) => s + sv.bookings, 0)}</td>
                                            <td className="p-4 text-right text-indigo-600 dark:text-indigo-400">{serviceStats.reduce((s, sv) => s + sv.revenue, 0).toLocaleString()} AED</td>
                                            <td className="p-4"></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                )}

                {/* ============ MEDICINES ============ */}
                {tab === 'medicines' && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs uppercase tracking-wider text-gray-500">
                                        <th className="p-4">Medicine</th>
                                        <th className="p-4">Type</th>
                                        <th className="p-4 text-center">Dispensed</th>
                                        <th className="p-4 text-center">Central Stock</th>
                                        <th className="p-4 text-center">Total Stock</th>
                                        <th className="p-4 text-right">Unit Price</th>
                                        <th className="p-4 text-right">Purchase Cost</th>
                                        <th className="p-4 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {medicineStats.map(m => (
                                        <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                            <td className="p-4 font-medium text-gray-900 dark:text-white">{m.name}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.category === 'consumable' ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400' : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400'}`}>
                                                    {m.category}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center font-medium">{m.dispensed}</td>
                                            <td className="p-4 text-center">{m.centralStock}</td>
                                            <td className="p-4 text-center">{m.totalStock}</td>
                                            <td className="p-4 text-right">{m.price} AED</td>
                                            <td className="p-4 text-right font-semibold text-indigo-600 dark:text-indigo-400">{m.purchaseCost > 0 ? `${m.purchaseCost.toLocaleString()} AED` : '—'}</td>
                                            <td className="p-4 text-center">
                                                {m.isLow
                                                    ? <span className="text-xs text-red-600 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full font-medium">Low Stock</span>
                                                    : <span className="text-xs text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full font-medium">OK</span>
                                                }
                                            </td>
                                        </tr>
                                    ))}
                                    {medicineStats.length === 0 && (
                                        <tr><td colSpan={8} className="p-8 text-center text-gray-400">No medicine data.</td></tr>
                                    )}
                                </tbody>
                                {medicineStats.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-900 dark:text-white">
                                            <td className="p-4">Total ({medicineStats.length} items)</td>
                                            <td className="p-4"></td>
                                            <td className="p-4 text-center">{medicineStats.reduce((s, m) => s + m.dispensed, 0)}</td>
                                            <td className="p-4 text-center">{medicineStats.reduce((s, m) => s + m.centralStock, 0)}</td>
                                            <td className="p-4 text-center">{medicineStats.reduce((s, m) => s + m.totalStock, 0)}</td>
                                            <td className="p-4"></td>
                                            <td className="p-4 text-right text-indigo-600 dark:text-indigo-400">{medicineStats.reduce((s, m) => s + m.purchaseCost, 0).toLocaleString()} AED</td>
                                            <td className="p-4 text-center">
                                                <span className="text-xs text-red-600">{medicineStats.filter(m => m.isLow).length} low</span>
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                )}

                {/* ============ PURCHASES ============ */}
                {tab === 'purchases' && (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard
                                title="Total Spend"
                                value={`${purchaseStats.totalSpend.toLocaleString()} AED`}
                                icon={<ShoppingCart className="w-5 h-5" />}
                                color="indigo"
                            />
                            <StatCard
                                title="Purchase Orders"
                                value={purchaseStats.count}
                                icon={<Package className="w-5 h-5" />}
                                color="emerald"
                            />
                            <StatCard
                                title="Line Items"
                                value={purchaseStats.totalItems}
                                icon={<Pill className="w-5 h-5" />}
                                color="amber"
                            />
                            <StatCard
                                title="Total Units"
                                value={purchaseStats.totalUnits}
                                icon={<Users className="w-5 h-5" />}
                                color="violet"
                            />
                        </div>

                        {/* Purchase list */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs uppercase tracking-wider text-gray-500">
                                            <th className="p-4">Bill #</th>
                                            <th className="p-4">Date</th>
                                            <th className="p-4 text-center">Items</th>
                                            <th className="p-4 text-right">Subtotal</th>
                                            <th className="p-4 text-right">Tax</th>
                                            <th className="p-4 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {filteredPurchases.map(p => (
                                            <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                                <td className="p-4 font-medium text-gray-900 dark:text-white">{p.billNumber}</td>
                                                <td className="p-4 text-gray-500">{new Date(p.purchaseDate).toLocaleDateString()}</td>
                                                <td className="p-4 text-center">{p.items?.length || 0}</td>
                                                <td className="p-4 text-right">{p.subtotal?.toLocaleString()} AED</td>
                                                <td className="p-4 text-right text-gray-500">{(p.taxAmount || 0) > 0 ? `${p.taxAmount?.toLocaleString()} AED` : '—'}</td>
                                                <td className="p-4 text-right font-semibold text-indigo-600 dark:text-indigo-400">{p.totalAmount.toLocaleString()} AED</td>
                                            </tr>
                                        ))}
                                        {filteredPurchases.length === 0 && (
                                            <tr><td colSpan={6} className="p-8 text-center text-gray-400">No purchases for this period.</td></tr>
                                        )}
                                    </tbody>
                                    {filteredPurchases.length > 0 && (
                                        <tfoot>
                                            <tr className="bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-900 dark:text-white">
                                                <td className="p-4">Total ({filteredPurchases.length} bills)</td>
                                                <td className="p-4"></td>
                                                <td className="p-4 text-center">{filteredPurchases.reduce((s, p) => s + (p.items?.length || 0), 0)}</td>
                                                <td className="p-4 text-right">{filteredPurchases.reduce((s, p) => s + (p.subtotal || 0), 0).toLocaleString()} AED</td>
                                                <td className="p-4 text-right">{filteredPurchases.reduce((s, p) => s + (p.taxAmount || 0), 0).toLocaleString()} AED</td>
                                                <td className="p-4 text-right text-indigo-600 dark:text-indigo-400">{purchaseStats.totalSpend.toLocaleString()} AED</td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    </>
                )}

                {/* ============ CLIENTS (Retention) ============ */}
                {tab === 'clients' && (
                    <>
                        {/* Summary cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <StatCard
                                title="Total Clients"
                                value={retentionBuckets.totalClients}
                                icon={<Users className="w-5 h-5" />}
                                color="blue"
                            />
                            <StatCard
                                title="Inactive (30+ days)"
                                value={retentionBuckets.totalInactive}
                                icon={<UserX className="w-5 h-5" />}
                                color="red"
                            />
                            <StatCard
                                title="Active (< 30 days)"
                                value={retentionBuckets.totalClients - retentionBuckets.totalInactive}
                                icon={<ArrowUpRight className="w-5 h-5" />}
                                color="green"
                            />
                        </div>

                        {/* Retention buckets */}
                        <div className="space-y-3">
                            {retentionBuckets.buckets.map((bucket, idx) => (
                                <div key={idx} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                                    <button
                                        onClick={() => setExpandedBucket(expandedBucket === idx ? null : idx)}
                                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${bucket.badgeBg}`}>
                                                {bucket.clients.length}
                                            </span>
                                            <span className="font-medium text-gray-900 dark:text-white">
                                                {bucket.label}
                                            </span>
                                            <span className="text-xs text-gray-400">since last visit</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {bucket.clients.length > 0 && (
                                                expandedBucket === idx
                                                    ? <ChevronUp className="w-4 h-4 text-gray-400" />
                                                    : <ChevronDown className="w-4 h-4 text-gray-400" />
                                            )}
                                        </div>
                                    </button>

                                    {expandedBucket === idx && bucket.clients.length > 0 && (
                                        <div className="border-t border-gray-100 dark:border-gray-700">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs uppercase tracking-wider text-gray-500">
                                                        <th className="p-3 pl-4">Client Name</th>
                                                        <th className="p-3">WhatsApp</th>
                                                        <th className="p-3">Email</th>
                                                        <th className="p-3">Last Visit</th>
                                                        <th className="p-3 text-right pr-4">Days Since</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                    {bucket.clients.map((client, ci) => (
                                                        <tr key={ci} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                                            <td className="p-3 pl-4 font-medium text-gray-900 dark:text-white">{client.name}</td>
                                                            <td className="p-3 text-gray-500 text-xs">{client.whatsapp || '—'}</td>
                                                            <td className="p-3 text-gray-500 text-xs">{client.email || '—'}</td>
                                                            <td className="p-3 text-gray-500 text-xs">{client.lastVisit.toLocaleDateString()}</td>
                                                            <td className={`p-3 text-right pr-4 font-semibold ${bucket.color}`}>{client.daysSince}d</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {expandedBucket === idx && bucket.clients.length === 0 && (
                                        <div className="border-t border-gray-100 dark:border-gray-700 p-4 text-center text-sm text-gray-400">
                                            No clients in this range.
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ---- Stat Card Component ----
function StatCard({ title, value, change, icon, color, isText }: {
    title: string;
    value: string | number;
    change?: number;
    icon: React.ReactNode;
    color: string;
    isText?: boolean;
}) {
    const colorMap: Record<string, { bg: string; text: string; iconBg: string }> = {
        indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-600 dark:text-indigo-400', iconBg: 'bg-indigo-100 dark:bg-indigo-900/40' },
        emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-100 dark:bg-emerald-900/40' },
        amber: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', iconBg: 'bg-amber-100 dark:bg-amber-900/40' },
        violet: { bg: 'bg-violet-50 dark:bg-violet-900/20', text: 'text-violet-600 dark:text-violet-400', iconBg: 'bg-violet-100 dark:bg-violet-900/40' },
        green: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400', iconBg: 'bg-green-100 dark:bg-green-900/40' },
        red: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400', iconBg: 'bg-red-100 dark:bg-red-900/40' },
        blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-blue-100 dark:bg-blue-900/40' },
    };
    const c = colorMap[color] || colorMap.indigo;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</span>
                <div className={`w-8 h-8 rounded-lg ${c.iconBg} ${c.text} flex items-center justify-center`}>
                    {icon}
                </div>
            </div>
            <div className={`${isText ? 'text-lg' : 'text-2xl'} font-bold text-gray-900 dark:text-white`}>
                {value}
            </div>
            {change !== undefined && change !== 0 && (
                <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${change > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {change > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(change).toFixed(1)}% vs prev period
                </div>
            )}
        </div>
    );
}

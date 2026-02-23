'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Calendar, Activity, BarChart2, MapPin, Tag, AlertTriangle, Warehouse, ArrowRight, Bell, BellOff, CalendarClock, Pill } from 'lucide-react';
import { Medicine, Clinic } from '@/lib/data';

interface LowStockAlert {
    medicineId: string;
    medicineName: string;
    location: string; // "Central" or clinic name
    currentQty: number;
    minStock: number;
    isNotified: boolean;
}

export default function AdminPage() {
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [clinics, setClinics] = useState<Clinic[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch('/api/admin/medicines').then(r => r.json()),
            fetch('/api/admin/clinics').then(r => r.json())
        ]).then(([meds, cls]) => {
            setMedicines(Array.isArray(meds) ? meds : []);
            setClinics(Array.isArray(cls) ? cls : []);
        }).catch(e => console.error(e)).finally(() => setLoading(false));
    }, []);

    const getClinicName = (id: string) => clinics.find(c => c.id === id)?.name || id;

    // Build low-stock alerts
    const lowStockAlerts: LowStockAlert[] = [];
    for (const med of medicines) {
        // Central stock
        if (med.minCentralStock && med.minCentralStock > 0 && med.centralStock < med.minCentralStock) {
            lowStockAlerts.push({
                medicineId: med.id,
                medicineName: med.name,
                location: 'Central Warehouse',
                currentQty: med.centralStock,
                minStock: med.minCentralStock,
                isNotified: !!med.isNotified
            });
        }
        // Branch stock — each branch has its own threshold
        for (const bs of (med.branchStock || [])) {
            if (bs.minQuantity && bs.minQuantity > 0 && bs.quantity < bs.minQuantity) {
                lowStockAlerts.push({
                    medicineId: med.id,
                    medicineName: med.name,
                    location: getClinicName(bs.clinicId),
                    currentQty: bs.quantity,
                    minStock: bs.minQuantity,
                    isNotified: !!med.isNotified
                });
            }
        }
    }

    const unacknowledgedCount = lowStockAlerts.filter(a => !a.isNotified).length;

    // Build near-expiry alerts (≤100 days)
    const nearExpiryItems = medicines
        .filter(med => med.expiryDate)
        .map(med => {
            const daysLeft = Math.ceil((new Date(med.expiryDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            return { id: med.id, name: med.name, category: med.category || 'medicine', expiryDate: med.expiryDate!, daysLeft };
        })
        .filter(item => item.daysLeft <= 100)
        .sort((a, b) => a.daysLeft - b.daysLeft);

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
            <main className="p-8">
                <header className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Dashboard Overview</h2>
                    <div className="flex items-center gap-4">
                        <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Add New Doctor</button>
                    </div>
                </header>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {[
                        { label: 'Total Patients', value: '1,248', icon: Users, color: 'bg-blue-500' },
                        { label: 'Appointments Today', value: '42', icon: Calendar, color: 'bg-emerald-500' },
                        { label: 'Revenue (Month)', value: '$158k', icon: BarChart2, color: 'bg-purple-500' },
                        { label: 'Active Doctors', value: '15', icon: Activity, color: 'bg-orange-500' },
                    ].map((stat, i) => (
                        <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`p-3 rounded-lg ${stat.color} bg-opacity-10`}>
                                    <stat.icon className={`w-6 h-6 ${stat.color.replace('bg-', 'text-')}`} />
                                </div>
                                <span className="text-xs font-medium text-green-500">+4.5%</span>
                            </div>
                            <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{stat.value}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
                        </div>
                    ))}
                </div>

                {/* Low Stock Alerts */}
                {lowStockAlerts.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-red-200 dark:border-red-800 p-6 mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-lg bg-red-100 dark:bg-red-900/30">
                                    <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Low Stock Alerts</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {unacknowledgedCount > 0
                                            ? <span className="text-red-600 dark:text-red-400 font-medium">{unacknowledgedCount} unacknowledged alert{unacknowledgedCount !== 1 ? 's' : ''}</span>
                                            : <span className="text-green-600 dark:text-green-400">All alerts acknowledged</span>
                                        }
                                        {' · '}{lowStockAlerts.length} total
                                    </p>
                                </div>
                            </div>
                            <Link href="/admin/medicines" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                                View Inventory <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500">
                                        <th className="text-left py-2 px-3 font-medium">Status</th>
                                        <th className="text-left py-2 px-3 font-medium">Item</th>
                                        <th className="text-left py-2 px-3 font-medium">Location</th>
                                        <th className="text-right py-2 px-3 font-medium">Current</th>
                                        <th className="text-right py-2 px-3 font-medium">Minimum</th>
                                        <th className="text-right py-2 px-3 font-medium">Deficit</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {lowStockAlerts.map((alert, i) => (
                                        <tr key={i} className={`transition-colors ${alert.isNotified ? 'opacity-50' : 'hover:bg-red-50/50 dark:hover:bg-red-900/10'}`}>
                                            <td className="py-2.5 px-3">
                                                {alert.isNotified
                                                    ? <span className="inline-flex items-center gap-1 text-xs text-gray-400"><BellOff className="w-3 h-3" /> Acknowledged</span>
                                                    : <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium"><Bell className="w-3 h-3" /> Action Needed</span>
                                                }
                                            </td>
                                            <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-white">{alert.medicineName}</td>
                                            <td className="py-2.5 px-3">
                                                <span className="inline-flex items-center gap-1 text-xs">
                                                    {alert.location === 'Central Warehouse'
                                                        ? <><Warehouse className="w-3 h-3 text-purple-500" /> {alert.location}</>
                                                        : <><MapPin className="w-3 h-3 text-teal-500" /> {alert.location}</>
                                                    }
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-bold text-red-600 dark:text-red-400">{alert.currentQty}</td>
                                            <td className="py-2.5 px-3 text-right text-gray-500">{alert.minStock}</td>
                                            <td className="py-2.5 px-3 text-right">
                                                <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
                                                    -{alert.minStock - alert.currentQty}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Near Expiry Alerts */}
                {nearExpiryItems.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-amber-200 dark:border-amber-800 p-6 mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                                    <CalendarClock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Expiring Soon</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        <span className="text-amber-600 dark:text-amber-400 font-medium">{nearExpiryItems.length} item{nearExpiryItems.length !== 1 ? 's' : ''}</span>
                                        {' '}expiring within 100 days
                                    </p>
                                </div>
                            </div>
                            <Link href="/admin/medicines" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                                View Inventory <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500">
                                        <th className="text-left py-2 px-3 font-medium">Item</th>
                                        <th className="text-left py-2 px-3 font-medium">Category</th>
                                        <th className="text-left py-2 px-3 font-medium">Expiry Date</th>
                                        <th className="text-right py-2 px-3 font-medium">Days Left</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {nearExpiryItems.map(item => (
                                        <tr key={item.id} className="hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-colors">
                                            <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-white">{item.name}</td>
                                            <td className="py-2.5 px-3">
                                                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${item.category === 'consumable' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                                    <Pill className="w-3 h-3" />
                                                    {item.category === 'consumable' ? 'Consumable' : 'Medicine'}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300">{item.expiryDate}</td>
                                            <td className="py-2.5 px-3 text-right">
                                                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${item.daysLeft <= 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : item.daysLeft <= 30 ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
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

                {/* Admin Dashboard Navigation Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    <Link href="/admin/clinics" className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700">
                        <h2 className="text-xl font-bold mb-2 text-indigo-600">Manage Branches</h2>
                        <p className="text-gray-600 dark:text-gray-400">Manage clinic locations, hours, and contact info.</p>
                    </Link>

                    <Link href="/admin/services" className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700">
                        <h2 className="text-xl font-bold mb-2 text-indigo-600">Manage Services</h2>
                        <p className="text-gray-600 dark:text-gray-400">Add, edit, or remove medical services and pricing.</p>
                    </Link>

                    <Link href="/admin/doctors" className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700">
                        <h2 className="text-xl font-bold mb-2 text-indigo-600">Manage Doctors</h2>
                        <p className="text-gray-600 dark:text-gray-400">Add or remove doctors and specialists.</p>
                    </Link>

                    <Link href="/admin/schedule" className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700">
                        <h2 className="text-xl font-bold mb-2 text-indigo-600">Staff Schedules</h2>
                        <p className="text-gray-600 dark:text-gray-400">Set availability and shifts for doctors.</p>
                    </Link>

                    <Link href="/admin/promos" className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700">
                        <h2 className="text-xl font-bold mb-2 text-indigo-600">Promo Codes</h2>
                        <p className="text-gray-600 dark:text-gray-400">Create and manage discounts and offers.</p>
                    </Link>

                    <Link href="/admin/resources" className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700">
                        <h2 className="text-xl font-bold mb-2 text-indigo-600">Resources</h2>
                        <p className="text-gray-600 dark:text-gray-400">Manage equipment and room inventory.</p>
                    </Link>
                </div>

                {/* Recent Activity */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Recent Appointments</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                                    <th className="py-3 px-4">Patient</th>
                                    <th className="py-3 px-4">Doctor</th>
                                    <th className="py-3 px-4">Service</th>
                                    <th className="py-3 px-4">Time</th>
                                    <th className="py-3 px-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {[1, 2, 3, 4, 5].map((_, i) => (
                                    <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">Jane Cooper</td>
                                        <td className="py-3 px-4 text-gray-600 dark:text-gray-300">Dr. Smith</td>
                                        <td className="py-3 px-4 text-gray-600 dark:text-gray-300">Cardiology Consult</td>
                                        <td className="py-3 px-4 text-gray-600 dark:text-gray-300">10:00 AM</td>
                                        <td className="py-3 px-4">
                                            <span className="inline-flex px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">Confirmed</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}

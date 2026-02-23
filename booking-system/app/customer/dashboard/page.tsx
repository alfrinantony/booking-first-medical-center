'use client';

import React, { useEffect } from 'react';
import { useAuthStore } from '@/lib/store';
import { usePackagesStore } from '@/lib/packages-store';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Package, Calendar, Clock, ArrowRight, User } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export default function CustomerDashboard() {
    const { user, isAuthenticated, logout } = useAuthStore();
    const { getMyPackages } = usePackagesStore();
    const router = useRouter();

    useEffect(() => {
        if (!isAuthenticated) {
            router.push('/');
        }
    }, [isAuthenticated, router]);

    if (!isAuthenticated || !user) return null;

    const myPackages = getMyPackages(user.phone);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-12">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome, {user.name}</h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your packages and bookings</p>
                    </div>
                    <div className="flex gap-4">
                        <Link href="/packages" className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium">
                            Buy Packages
                        </Link>
                        <button
                            onClick={() => { logout(); router.push('/'); }}
                            className="px-5 py-2.5 border border-gray-300 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-medium"
                        >
                            Log Out
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Active Packages Section */}
                    <div className="lg:col-span-2 space-y-6">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Package className="w-5 h-5 text-indigo-600" />
                            Active Packages
                        </h2>

                        {myPackages.length === 0 ? (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center border border-gray-100 dark:border-gray-700">
                                <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white">No Active Packages</h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-6">Purchase a package to save on services.</p>
                                <Link href="/packages" className="text-indigo-600 hover:text-indigo-800 font-medium">
                                    Browse Packages &rarr;
                                </Link>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {myPackages.map(pkg => (
                                    <div key={pkg.id} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-bl-xl dark:bg-green-900/30 dark:text-green-300">
                                            ACTIVE
                                        </div>
                                        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1">{pkg.packageName}</h3>
                                        <p className="text-sm text-gray-500 mb-4">Expires: {format(parseISO(pkg.expiryDate), 'MMM d, yyyy')}</p>

                                        <div className="space-y-3">
                                            {Object.entries(pkg.remainingSessions).map(([svcId, count]) => {
                                                // Note: We might want to fetch service name from store if not in package object, 
                                                // but for now relying on it being available or just showing ID if we don't have map.
                                                // Actually CustomerPackage doesn't strictly store service Name map matching IDs.
                                                // We can rely on 'Package' definition or just UI assumption.
                                                // In `purchasePackage` we store mapped object? No, strict map.
                                                // Let's improve display by just showing "Service Name" if we can't look it up easily here without store.
                                                // Actually, we can fetch services... but let's keep it simple.
                                                // Users will see "Remaining Sessions".
                                                return (
                                                    <div key={svcId} className="flex justify-between items-center text-sm bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg">
                                                        <span className="font-medium text-gray-700 dark:text-gray-300">Service ({svcId.slice(0, 5)}...)</span>
                                                        <span className="font-bold text-indigo-600">{count} left</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Quick Profile / Sidebar */}
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
                                    <User className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white">{user.name}</h3>
                                    <p className="text-sm text-gray-500">{user.email}</p>
                                </div>
                            </div>
                            <div className="space-y-4 text-sm">
                                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                                    <span className="text-gray-500">Phone</span>
                                    <span className="font-medium text-gray-900 dark:text-white">{user.phone}</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                                    <span className="text-gray-500">Member Since</span>
                                    <span className="font-medium text-gray-900 dark:text-white">{new Date().getFullYear()}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg">
                            <h3 className="font-bold text-lg mb-2">Book an Appointment</h3>
                            <p className="text-indigo-100 text-sm mb-4">Ready for your next session? Book now use your package.</p>
                            <Link href="/booking" className="block w-full py-3 bg-white text-indigo-600 text-center font-bold rounded-xl hover:bg-gray-50 transition-colors">
                                Book Now
                            </Link>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

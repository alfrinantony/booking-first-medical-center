'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store';
import type { Package as PkgType, CustomerPackage } from '@/types/packages';
import { Package, Check, ShieldCheck, Clock, ArrowRight, Calendar, User } from 'lucide-react';
import CustomerAuth from '@/components/auth/CustomerAuth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function PackagesPage() {
    const [availablePackages, setAvailablePackages] = useState<PkgType[]>([]);
    const [myPackages, setMyPackages] = useState<CustomerPackage[]>([]);
    const { user, isAuthenticated } = useAuthStore();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'browse' | 'my'>('browse');

    useEffect(() => {
        fetch('/api/admin/packages').then(r => r.json()).then(setAvailablePackages).catch(() => {});
    }, []);

    // Fetch customer's packages when authenticated
    useEffect(() => {
        if (isAuthenticated && user?.phone) {
            fetch(`/api/session-packages?phone=${encodeURIComponent(user.phone)}`)
                .then(r => r.json())
                .then(data => { if (Array.isArray(data)) setMyPackages(data); })
                .catch(() => {});
        }
    }, [isAuthenticated, user]);

    const [showAuthModal, setShowAuthModal] = useState(false);
    const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
    const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);

    const handleBuyClick = (pkgId: string) => {
        if (!isAuthenticated) {
            setSelectedPackageId(pkgId);
            setShowAuthModal(true);
        } else {
            executePurchase(pkgId);
        }
    };

    const executePurchase = async (pkgId: string) => {
        if (!user) return;
        try {
            const res = await fetch('/api/admin/packages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'purchase', packageId: pkgId, customerName: user.name, customerPhone: user.phone }),
            });
            const result = await res.json();
            if (result && !result.error) {
                setPurchaseSuccess(pkgId);
                setTimeout(() => setPurchaseSuccess(null), 3000);
                // Refresh my packages
                if (user.phone) {
                    fetch(`/api/session-packages?phone=${encodeURIComponent(user.phone)}`)
                        .then(r => r.json())
                        .then(data => { if (Array.isArray(data)) setMyPackages(data); })
                        .catch(() => {});
                }
            }
        } catch {
            // handle error silently
        }
    };

    const onAuthSuccess = () => {
        setShowAuthModal(false);
        if (selectedPackageId) {
            executePurchase(selectedPackageId);
            setSelectedPackageId(null);
        }
    };

    const getDaysRemaining = (expiryDate: string) => {
        const now = new Date();
        const expiry = new Date(expiryDate);
        const diff = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return Math.max(0, diff);
    };

    const getTotalRemainingSessions = (pkg: CustomerPackage) => {
        return Object.values(pkg.remainingSessions).reduce((sum, count) => sum + count, 0);
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white sm:text-5xl sm:tracking-tight lg:text-6xl">
                        Service Packages
                    </h1>
                    <p className="mt-5 max-w-xl mx-auto text-xl text-gray-500 dark:text-gray-400">
                        Save more with our exclusive service bundles.
                        Valid across all our clinics.
                    </p>
                </div>

                {/* Tab Switcher */}
                {isAuthenticated && (
                    <div className="flex justify-center mb-8">
                        <div className="flex bg-gray-100 dark:bg-gray-700/50 p-1 rounded-lg">
                            <button
                                onClick={() => setActiveTab('browse')}
                                className={`px-6 py-2.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'browse' ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'}`}
                            >
                                Browse Packages
                            </button>
                            <button
                                onClick={() => setActiveTab('my')}
                                className={`px-6 py-2.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'my' ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'}`}
                            >
                                My Packages
                                {myPackages.length > 0 && (
                                    <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold px-2 py-0.5 rounded-full">
                                        {myPackages.length}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {purchaseSuccess && (
                    <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-4 rounded-xl shadow-2xl z-50 animate-bounce">
                        <div className="flex items-center gap-2">
                            <Check className="w-6 h-6" />
                            <span className="font-bold text-lg">Package purchased successfully!</span>
                        </div>
                    </div>
                )}

                {/* Browse Packages Tab */}
                {activeTab === 'browse' && (
                    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                        {availablePackages.filter(p => p.active).map((pkg) => (
                            <div key={pkg.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden hover:scale-105 transition-transform duration-300 border border-gray-100 dark:border-gray-700 flex flex-col">
                                <div className="p-8 flex-1">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="bg-indigo-100 dark:bg-indigo-900/30 p-3 rounded-xl">
                                            <Package className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                                        </div>
                                        <span className="bg-green-100 text-green-800 text-xs font-bold px-2.5 py-1 rounded-full dark:bg-green-900/30 dark:text-green-300">
                                            SAVE BUNDLE
                                        </span>
                                    </div>
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{pkg.name}</h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">{pkg.description}</p>

                                    <div className="flex items-baseline mb-6">
                                        <span className="text-4xl font-extrabold text-gray-900 dark:text-white">{pkg.price}</span>
                                        <span className="text-xl text-gray-500 dark:text-gray-400 ml-2">AED</span>
                                    </div>

                                    <ul className="space-y-4 mb-8">
                                        <li className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                            <Clock className="w-5 h-5 text-indigo-500 mr-3 flex-shrink-0" />
                                            Valid for {pkg.validityInDays} days
                                        </li>
                                        {pkg.items.map((item, idx) => (
                                            <li key={idx} className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                                <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                                                <span className="font-semibold mr-1">{item.count}x</span> {item.serviceName}
                                            </li>
                                        ))}
                                        <li className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                            <ShieldCheck className="w-5 h-5 text-indigo-500 mr-3 flex-shrink-0" />
                                            Use at any clinic branch
                                        </li>
                                    </ul>
                                </div>

                                <div className="p-8 bg-gray-50 dark:bg-gray-700/50 mt-auto">
                                    <button
                                        onClick={() => handleBuyClick(pkg.id)}
                                        className="w-full flex items-center justify-center px-6 py-4 border border-transparent text-base font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-indigo-500/30"
                                    >
                                        Purchase Now <ArrowRight className="ml-2 w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {availablePackages.filter(p => p.active).length === 0 && (
                            <div className="col-span-full text-center py-16">
                                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-500">No packages available yet</h3>
                                <p className="text-gray-400 mt-2">Check back later or browse our services to buy session packages.</p>
                                <Link href="/booking" className="mt-4 inline-flex items-center gap-2 text-indigo-600 font-medium hover:text-indigo-500">
                                    Browse Services <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                        )}
                    </div>
                )}

                {/* My Packages Tab */}
                {activeTab === 'my' && isAuthenticated && (
                    <div>
                        {myPackages.length === 0 ? (
                            <div className="text-center py-16">
                                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-500">No active packages</h3>
                                <p className="text-gray-400 mt-2">Purchase a session package to get started!</p>
                                <button onClick={() => setActiveTab('browse')} className="mt-4 inline-flex items-center gap-2 text-indigo-600 font-medium hover:text-indigo-500">
                                    Browse Packages <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {myPackages.map(pkg => {
                                    const daysLeft = getDaysRemaining(pkg.expiryDate);
                                    const totalSessions = getTotalRemainingSessions(pkg);
                                    const isExpired = daysLeft <= 0;

                                    return (
                                        <div key={pkg.id} className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg border overflow-hidden ${isExpired ? 'border-red-200 dark:border-red-800 opacity-60' : 'border-gray-100 dark:border-gray-700'}`}>
                                            {/* Package header */}
                                            <div className={`px-6 py-4 ${isExpired ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gradient-to-r from-indigo-500 to-purple-600'}`}>
                                                <div className="flex items-center justify-between">
                                                    <h3 className={`text-lg font-bold ${isExpired ? 'text-red-700 dark:text-red-400' : 'text-white'}`}>{pkg.packageName}</h3>
                                                    {isExpired ? (
                                                        <span className="bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full">EXPIRED</span>
                                                    ) : (
                                                        <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full backdrop-blur">
                                                            {daysLeft} days left
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="p-6">
                                                {/* Sessions info */}
                                                <div className="flex items-center justify-between mb-4">
                                                    <div>
                                                        <span className="text-sm text-gray-500">Sessions Remaining</span>
                                                        <div className="text-3xl font-extrabold text-gray-900 dark:text-white">{totalSessions}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-sm text-gray-500">Purchased</span>
                                                        <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                                            {new Date(pkg.purchaseDate).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Service breakdown */}
                                                <div className="space-y-2 mb-6">
                                                    {Object.entries(pkg.remainingSessions).map(([serviceId, count]) => (
                                                        <div key={serviceId} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/30 px-4 py-2.5 rounded-lg">
                                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                                {/* Try to get a readable name */}
                                                                {pkg.packageName.replace(/ - \d+ Sessions$/, '')}
                                                            </span>
                                                            <span className={`text-sm font-bold ${count > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                                {count} session{count !== 1 ? 's' : ''} left
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Book button */}
                                                {!isExpired && totalSessions > 0 && (
                                                    <button
                                                        onClick={() => {
                                                            const firstServiceId = Object.keys(pkg.remainingSessions)[0];
                                                            router.push(`/booking?packageId=${pkg.id}&serviceId=${firstServiceId}`);
                                                        }}
                                                        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg"
                                                    >
                                                        <Calendar className="w-5 h-5" />
                                                        Book Appointment
                                                    </button>
                                                )}

                                                {/* Validity bar */}
                                                {!isExpired && (
                                                    <div className="mt-4">
                                                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                                                            <span>Validity</span>
                                                            <span>{daysLeft} days remaining</span>
                                                        </div>
                                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                                            <div
                                                                className={`h-1.5 rounded-full transition-all ${daysLeft > 30 ? 'bg-green-500' : daysLeft > 7 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                                style={{ width: `${Math.min(100, (daysLeft / 180) * 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Auth Modal */}
            {showAuthModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="relative w-full max-w-md">
                        <button
                            onClick={() => setShowAuthModal(false)}
                            className="absolute -top-12 right-0 text-white hover:text-gray-200"
                        >
                            Close
                        </button>
                        <CustomerAuth onSuccess={onAuthSuccess} />
                    </div>
                </div>
            )}
        </div>
    );
}

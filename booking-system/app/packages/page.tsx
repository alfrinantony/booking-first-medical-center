'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store';
import type { Package as PkgType } from '@/types/packages';
import { Package, Check, ShieldCheck, Clock, ArrowRight } from 'lucide-react';
import CustomerAuth from '@/components/auth/CustomerAuth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function PackagesPage() {
    const [availablePackages, setAvailablePackages] = useState<PkgType[]>([]);
    const { user, isAuthenticated } = useAuthStore();
    const router = useRouter();

    useEffect(() => {
        fetch('/api/admin/packages').then(r => r.json()).then(setAvailablePackages).catch(() => {});
    }, []);

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

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white sm:text-5xl sm:tracking-tight lg:text-6xl">
                        Service Packages
                    </h1>
                    <p className="mt-5 max-w-xl mx-auto text-xl text-gray-500 dark:text-gray-400">
                        Save more with our exclusive service bundles.
                        Valid across all our clinics.
                    </p>
                </div>

                {purchaseSuccess && (
                    <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-4 rounded-xl shadow-2xl z-50 animate-bounce">
                        <div className="flex items-center gap-2">
                            <Check className="w-6 h-6" />
                            <span className="font-bold text-lg">Successfully purchased {purchaseSuccess}!</span>
                        </div>
                    </div>
                )}

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
                                    <span className="text-4xl font-extrabold text-gray-900 dark:text-white">${pkg.price}</span>
                                    <span className="text-xl text-gray-500 dark:text-gray-400 ml-2">/ package</span>
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
                </div>
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

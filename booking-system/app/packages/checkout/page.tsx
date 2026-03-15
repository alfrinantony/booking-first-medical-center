'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import CustomerAuth from '@/components/auth/CustomerAuth';
import { Package, Check, Clock, ShieldCheck, ArrowRight, ArrowLeft, Sparkles, Tag } from 'lucide-react';
import Link from 'next/link';

function CheckoutContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();

    const serviceId = searchParams.get('serviceId') || '';
    const serviceName = searchParams.get('serviceName') || '';
    const sessions = Number(searchParams.get('sessions') || '3');
    const price = Number(searchParams.get('price') || '0');
    const validity = Number(searchParams.get('validity') || '90');
    const singlePrice = Number(searchParams.get('singlePrice') || '0');

    const [showAuth, setShowAuth] = useState(false);
    const [purchasing, setPurchasing] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const [purchasedPkgId, setPurchasedPkgId] = useState('');

    const totalSavings = singlePrice > 0 ? (singlePrice * sessions) - price : 0;
    const perSession = price > 0 ? Math.round(price / sessions) : 0;

    const handlePurchase = async () => {
        if (!isAuthenticated || !user) {
            setShowAuth(true);
            return;
        }

        setPurchasing(true);
        setError('');

        try {
            const res = await fetch('/api/session-packages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'buy',
                    serviceId,
                    serviceName,
                    sessionCount: sessions,
                    price,
                    validity,
                    customerName: user.name,
                    customerPhone: user.phone,
                }),
            });
            const result = await res.json();
            if (result.success) {
                setSuccess(true);
                setPurchasedPkgId(result.package?.id || '');
            } else {
                setError(result.error || 'Purchase failed. Please try again.');
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setPurchasing(false);
        }
    };

    const onAuthSuccess = () => {
        setShowAuth(false);
        handlePurchase();
    };

    if (!serviceId || !serviceName) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Invalid Checkout</h1>
                    <p className="text-gray-500 mb-6">No service selected. Please go back and select a package.</p>
                    <Link href="/booking" className="text-indigo-600 hover:text-indigo-500 font-medium">
                        ← Back to Services
                    </Link>
                </div>
            </div>
        );
    }

    // Success state
    if (success) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
                <div className="max-w-lg w-full bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 text-center">
                    <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
                        <Check className="w-10 h-10 text-green-600 dark:text-green-400" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Purchase Successful!</h1>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">
                        Your <strong>{sessions}-session package</strong> for <strong>{serviceName}</strong> is now active.
                        Valid for {validity} days at all branches.
                    </p>

                    <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-6 mb-8">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-sm text-gray-500">Package</span>
                            <span className="font-bold text-gray-900 dark:text-white">{serviceName} × {sessions}</span>
                        </div>
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-sm text-gray-500">Sessions Remaining</span>
                            <span className="font-bold text-green-600">{sessions}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-500">Validity</span>
                            <span className="font-bold text-gray-900 dark:text-white">{validity} days</span>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={() => router.push(`/booking?packageId=${purchasedPkgId}&serviceId=${serviceId}`)}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg"
                        >
                            Book Now <ArrowRight className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => router.push('/packages')}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 border-2 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:border-indigo-400 transition-colors"
                        >
                            <Package className="w-5 h-5" /> My Packages
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
            <div className="max-w-2xl mx-auto">
                {/* Back link */}
                <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 hover:text-indigo-600 mb-6 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to Services
                </button>

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-500 to-emerald-500 rounded-2xl flex items-center justify-center text-white text-2xl mb-4">📦</div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Session Package Checkout</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">Complete your purchase and start booking</p>
                </div>

                {/* Package Card */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden mb-6">
                    {/* Top banner */}
                    <div className={`px-6 py-4 ${sessions === 3 ? 'bg-gradient-to-r from-blue-500 to-blue-600' : 'bg-gradient-to-r from-emerald-500 to-emerald-600'} text-white`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5" />
                                <span className="font-bold text-lg">{sessions}-Session Package</span>
                            </div>
                            {totalSavings > 0 && (
                                <span className="bg-white/20 backdrop-blur px-3 py-1 rounded-full text-sm font-bold">
                                    Save {totalSavings} AED
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="p-6 sm:p-8">
                        {/* Service name */}
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{serviceName}</h2>

                        {/* Price breakdown */}
                        <div className="space-y-4 mb-8">
                            {singlePrice > 0 && (
                                <div className="flex justify-between items-center text-gray-500">
                                    <span>Single session price</span>
                                    <span className="line-through">{singlePrice} AED</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center text-gray-500">
                                <span>Per session (package rate)</span>
                                <span className="font-medium text-gray-900 dark:text-white">{perSession} AED</span>
                            </div>
                            <div className="flex justify-between items-center text-gray-500">
                                <span>Number of sessions</span>
                                <span className="font-medium text-gray-900 dark:text-white">× {sessions}</span>
                            </div>
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-lg font-bold text-gray-900 dark:text-white">Total</span>
                                    <span className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">{price} AED</span>
                                </div>
                            </div>
                        </div>

                        {/* Benefits */}
                        <div className="bg-gray-50 dark:bg-gray-700/30 rounded-2xl p-5 mb-8">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">What&apos;s Included</h3>
                            <ul className="space-y-3">
                                <li className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                                    <span><strong>{sessions} sessions</strong> of {serviceName}</span>
                                </li>
                                <li className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                                    <Clock className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                                    <span>Valid for <strong>{validity} days</strong> from purchase</span>
                                </li>
                                <li className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                                    <ShieldCheck className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                                    <span>Use at <strong>any clinic branch</strong></span>
                                </li>
                                {totalSavings > 0 && (
                                    <li className="flex items-center gap-3 text-sm text-green-700 dark:text-green-400 font-medium">
                                        <Tag className="w-5 h-5 flex-shrink-0" />
                                        <span>You save <strong>{totalSavings} AED</strong> compared to single sessions</span>
                                    </li>
                                )}
                            </ul>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl mb-4 text-sm font-medium">
                                {error}
                            </div>
                        )}

                        {/* Purchase button */}
                        <button
                            onClick={handlePurchase}
                            disabled={purchasing}
                            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white font-bold text-lg rounded-xl hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {purchasing ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    Confirm Purchase — {price} AED <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>

                        <p className="text-center text-xs text-gray-400 mt-4">
                            By purchasing, you agree to our terms. Package is non-refundable after first use.
                        </p>
                    </div>
                </div>
            </div>

            {/* Auth Modal */}
            {showAuth && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="relative w-full max-w-md">
                        <button onClick={() => setShowAuth(false)} className="absolute -top-12 right-0 text-white hover:text-gray-200">Close</button>
                        <CustomerAuth onSuccess={onAuthSuccess} />
                    </div>
                </div>
            )}
        </div>
    );
}

export default function CheckoutPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
        }>
            <CheckoutContent />
        </Suspense>
    );
}

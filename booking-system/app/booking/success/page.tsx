'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { CheckCircle, Printer, Home } from 'lucide-react';
import { format } from 'date-fns';

function SuccessContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { user } = useAuthStore();
    const [bookingDetails, setBookingDetails] = useState<any>(null);

    useEffect(() => {
        // In a real app, you'd fetch the booking details from the API using a booking ID
        // For now, we'll simulate it based on URL params and mock data
        const method = searchParams.get('method');
        const amountParam = searchParams.get('amount');
        const amountReceived = searchParams.get('amount_received');
        const serviceName = searchParams.get('serviceName') || 'Medical Service';

        // Calculate amount: prefer amount_received (from Stripe, in cents), then amount param, then fallback
        let finalAmount: string;
        if (amountReceived) {
            finalAmount = (parseInt(amountReceived) / 100).toFixed(2);
        } else if (amountParam) {
            finalAmount = parseFloat(amountParam).toFixed(2);
        } else {
            finalAmount = '0.00';
        }

        // Simulate retrieving booking data
        setBookingDetails({
            id: 'BK-' + Math.floor(Math.random() * 100000),
            date: new Date(),
            status: method === 'clinic' ? 'Confirmed (Pay at Clinic)' : 'Paid',
            amount: finalAmount,
            serviceName: serviceName,
        });
    }, [searchParams]);

    if (!bookingDetails || !user) {
        return <div className="min-h-screen flex items-center justify-center">Loading invoice...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden">

                {/* Header */}
                <div className="bg-indigo-600 px-8 py-10 text-center">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                        <CheckCircle className="h-10 w-10 text-green-600" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-white">Booking Confirmed!</h2>
                    <p className="mt-2 text-indigo-100">Thank you for choosing Booking First Medical Center.</p>
                </div>

                {/* Invoice Body */}
                <div className="px-8 py-10">
                    <div className="flex justify-between items-start mb-8 border-b border-gray-200 dark:border-gray-700 pb-8">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Invoice To:</h3>
                            <p className="text-gray-600 dark:text-gray-400 mt-1">{user.name}</p>
                            <p className="text-gray-600 dark:text-gray-400">{user.email}</p>
                            <p className="text-gray-600 dark:text-gray-400">{user.phone}</p>
                        </div>
                        <div className="text-right">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Booking Details:</h3>
                            <p className="text-gray-600 dark:text-gray-400 mt-1">Invoice ID: <span className="font-mono text-gray-900 dark:text-white">{bookingDetails.id}</span></p>
                            <p className="text-gray-600 dark:text-gray-400">Date: {format(bookingDetails.date, 'MMM d, yyyy')}</p>
                            <div className="mt-2 inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                {bookingDetails.status}
                            </div>
                            {searchParams.get('method') === 'clinic' && (
                                <p className="text-xs text-red-600 dark:text-red-400 font-bold mt-2">
                                    Note: Payment required at reception before service.
                                </p>
                            )}
                        </div>
                    </div>

                    <table className="min-w-full mb-8">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="text-left py-3 text-gray-500 dark:text-gray-400 font-medium">Description</th>
                                <th className="text-right py-3 text-gray-500 dark:text-gray-400 font-medium">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                <td className="py-4 text-gray-900 dark:text-white font-medium">{bookingDetails.serviceName}</td>
                                <td className="py-4 text-right text-gray-900 dark:text-white font-bold">{bookingDetails.amount} AED</td>
                            </tr>
                            {/* Tax logic would go here */}
                            <tr>
                                <td className="py-4 text-gray-500 dark:text-gray-400 font-medium">Total</td>
                                <td className="py-4 text-right text-indigo-600 font-extrabold text-xl">{bookingDetails.amount} AED</td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12">
                        <button
                            onClick={() => window.print()}
                            className="flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            <Printer className="w-5 h-5" />
                            Print Invoice
                        </button>
                        <button
                            onClick={() => router.push('/')}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors"
                        >
                            <Home className="w-5 h-5" />
                            Back to Home
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}

export default function SuccessPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <SuccessContent />
        </Suspense>
    );
}

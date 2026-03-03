'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { CheckCircle, Printer, Home, Calendar, Clock, User, MapPin, Stethoscope } from 'lucide-react';
import { format, parseISO } from 'date-fns';

function SuccessContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { user } = useAuthStore();
    const [bookingDetails, setBookingDetails] = useState<any>(null);

    useEffect(() => {
        const method = searchParams.get('method');
        const amountParam = searchParams.get('amount');
        const amountReceived = searchParams.get('amount_received');
        const serviceName = searchParams.get('serviceName') || 'Medical Service';
        const bookingDate = searchParams.get('bookingDate') || '';
        const slot = searchParams.get('slot') || '';
        const doctorName = searchParams.get('doctorName') || '';
        const clinicName = searchParams.get('clinicName') || '';

        let finalAmount: string;
        if (amountReceived) {
            finalAmount = (parseInt(amountReceived) / 100).toFixed(2);
        } else if (amountParam) {
            finalAmount = parseFloat(amountParam).toFixed(2);
        } else {
            finalAmount = '0.00';
        }

        setBookingDetails({
            id: 'BK-' + Math.floor(Math.random() * 100000),
            date: new Date(),
            status: method === 'clinic' ? 'Confirmed (Pay at Clinic)' : 'Paid',
            amount: finalAmount,
            serviceName,
            bookingDate,
            slot,
            doctorName,
            clinicName,
        });
    }, [searchParams]);

    if (!bookingDetails || !user) {
        return <div className="min-h-screen flex items-center justify-center">Loading invoice...</div>;
    }

    const formattedBookingDate = bookingDetails.bookingDate
        ? format(parseISO(bookingDetails.bookingDate), 'EEEE, MMMM d, yyyy')
        : 'N/A';

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden">

                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-8 py-10 text-center">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                        <CheckCircle className="h-10 w-10 text-green-600" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-white">Booking Confirmed!</h2>
                    <p className="mt-2 text-indigo-100">Thank you for choosing First Medical Center LLC.</p>
                    <div className="mt-3 inline-flex px-4 py-1.5 rounded-full text-sm font-semibold bg-green-100 text-green-800">
                        {bookingDetails.status}
                    </div>
                </div>

                {/* Receipt Body */}
                <div className="px-8 py-10">

                    {/* Invoice and Patient Info */}
                    <div className="flex flex-col sm:flex-row justify-between items-start mb-8 pb-8 border-b border-gray-200 dark:border-gray-700">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Patient Details</h3>
                            <p className="text-gray-600 dark:text-gray-400 mt-1">{user.name}</p>
                            <p className="text-gray-600 dark:text-gray-400">{user.email}</p>
                            <p className="text-gray-600 dark:text-gray-400">{user.phone}</p>
                        </div>
                        <div className="text-right mt-4 sm:mt-0">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Receipt</h3>
                            <p className="text-gray-600 dark:text-gray-400 mt-1">ID: <span className="font-mono font-semibold text-gray-900 dark:text-white">{bookingDetails.id}</span></p>
                            <p className="text-gray-600 dark:text-gray-400">Issued: {format(bookingDetails.date, 'MMM d, yyyy h:mm a')}</p>
                        </div>
                    </div>

                    {/* Booking Details Grid */}
                    <div className="mb-8 pb-8 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Appointment Details</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                                <Stethoscope className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Service</p>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{bookingDetails.serviceName}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                                <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Date</p>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{formattedBookingDate}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                                <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Time</p>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{bookingDetails.slot || 'N/A'}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                                <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Technician / Doctor</p>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{bookingDetails.doctorName || 'Any Available Doctor'}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg sm:col-span-2">
                                <MapPin className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Clinic Branch</p>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{bookingDetails.clinicName || 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Price Breakdown */}
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
                            <tr>
                                <td className="py-4 text-gray-500 dark:text-gray-400 font-medium text-lg">Total</td>
                                <td className="py-4 text-right text-indigo-600 font-extrabold text-xl">{bookingDetails.amount} AED</td>
                            </tr>
                        </tbody>
                    </table>

                    {searchParams.get('method') === 'clinic' && (
                        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200 font-semibold">
                                ⚠ Payment required at reception before service. Please arrive 15 minutes early.
                            </p>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                        <button
                            onClick={() => window.print()}
                            className="flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            <Printer className="w-5 h-5" />
                            Print Receipt
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

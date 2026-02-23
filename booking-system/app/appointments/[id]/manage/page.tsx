'use client';

import React, { useState, useEffect } from 'react';
import { Booking } from '@/lib/data';
import { Calendar, Clock, MapPin, User, CheckCircle, XCircle, AlertCircle, Edit, Check } from 'lucide-react';
import { format } from 'date-fns';

export default function AppointmentManagePage({ params }: { params: { id: string } }) {
    const [booking, setBooking] = useState<Booking | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    // Reschedule State
    const [isRescheduling, setIsRescheduling] = useState(false);
    const [newDate, setNewDate] = useState('');
    const [newSlot, setNewSlot] = useState('');

    useEffect(() => {
        const fetchBooking = async () => {
            try {
                const res = await fetch(`/api/bookings/${params.id}`);
                if (res.ok) {
                    const data = await res.json();
                    setBooking(data);
                    // Initialize reschedule fields
                    setNewDate(data.date);
                    setNewSlot(data.slot);
                } else {
                    setError('Booking not found');
                }
            } catch (err) {
                setError('Failed to load booking');
            } finally {
                setIsLoading(false);
            }
        };
        fetchBooking();
    }, [params.id]);

    const handleAction = async (action: 'confirm' | 'cancel' | 'reschedule') => {
        if (!booking) return;

        let updates: Partial<Booking> = {};

        if (action === 'confirm') {
            updates = { confirmationStatus: 'confirmed' };
        } else if (action === 'cancel') {
            if (!confirm('Are you sure you want to cancel this appointment?')) return;
            updates = { status: 'cancelled', confirmationStatus: 'cancelled' };
        } else if (action === 'reschedule') {
            updates = {
                confirmationStatus: 'rescheduled',
                date: newDate,
                slot: newSlot
            };
        }

        try {
            const res = await fetch(`/api/bookings/${params.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });

            if (res.ok) {
                const updated = await res.json();
                setBooking(updated);
                if (action === 'reschedule') setIsRescheduling(false);
                alert(`Appointment ${action}ed successfully!`);
            } else {
                alert('Failed to update appointment');
            }
        } catch (err) {
            console.error(err);
            alert('An error occurred');
        }
    };

    if (isLoading) return <div className="p-8 text-center text-gray-500">Loading booking details...</div>;
    if (error || !booking) return <div className="p-8 text-center text-red-500">{error || 'Booking not found'}</div>;

    const isConfirmed = booking.confirmationStatus === 'confirmed';
    const isCancelled = booking.status === 'cancelled';

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 flex items-center justify-center">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-indigo-600 p-6 text-white text-center">
                    <h1 className="text-2xl font-bold mb-2">Manage Appointment</h1>
                    <p className="text-indigo-100 text-sm">Booking ID: {booking.id}</p>
                </div>

                <div className="p-6 space-y-6">
                    {/* Status Banner */}
                    <div className={`p-4 rounded-lg flex items-center gap-3 ${isCancelled ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300' :
                            isConfirmed ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' :
                                'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300'
                        }`}>
                        {isCancelled ? <XCircle className="w-6 h-6" /> :
                            isConfirmed ? <CheckCircle className="w-6 h-6" /> :
                                <AlertCircle className="w-6 h-6" />}
                        <div className="font-semibold">
                            {isCancelled ? 'Cancelled' :
                                isConfirmed ? 'Confirmed' : 'Action Required'}
                        </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <User className="w-5 h-5 text-gray-400 mt-1" />
                            <div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">Patient</div>
                                <div className="font-medium text-gray-900 dark:text-white">{booking.patientName}</div>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <Calendar className="w-5 h-5 text-gray-400 mt-1" />
                            <div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">Date</div>
                                {isRescheduling ? (
                                    <input
                                        type="date"
                                        value={newDate}
                                        onChange={(e) => setNewDate(e.target.value)}
                                        className="mt-1 p-2 border rounded text-sm w-full dark:bg-gray-700 dark:border-gray-600"
                                    />
                                ) : (
                                    <div className="font-medium text-gray-900 dark:text-white">
                                        {format(new Date(booking.date), 'EEEE, MMMM d, yyyy')}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <Clock className="w-5 h-5 text-gray-400 mt-1" />
                            <div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">Time</div>
                                {isRescheduling ? (
                                    <input
                                        type="text"
                                        value={newSlot}
                                        onChange={(e) => setNewSlot(e.target.value)}
                                        className="mt-1 p-2 border rounded text-sm w-full dark:bg-gray-700 dark:border-gray-600"
                                        placeholder="e.g. 10:00 AM"
                                    />
                                ) : (
                                    <div className="font-medium text-gray-900 dark:text-white">{booking.slot}</div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <MapPin className="w-5 h-5 text-gray-400 mt-1" />
                            <div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">Clinic</div>
                                <div className="font-medium text-gray-900 dark:text-white">Branch {booking.clinicId}</div>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    {!isCancelled && (
                        <div className="flex flex-col gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                            {!isRescheduling && !isConfirmed && (
                                <button
                                    onClick={() => handleAction('confirm')}
                                    className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all flex items-center justify-center gap-2"
                                >
                                    <Check className="w-5 h-5" />
                                    Confirm Appointment
                                </button>
                            )}

                            {isRescheduling ? (
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setIsRescheduling(false)}
                                        className="flex-1 py-3 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => handleAction('reschedule')}
                                        className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setIsRescheduling(true)}
                                    className="w-full py-3 border border-indigo-200 text-indigo-700 rounded-xl font-bold hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-900/20 transition-all flex items-center justify-center gap-2"
                                >
                                    <Edit className="w-4 h-4" />
                                    Reschedule
                                </button>
                            )}

                            {!isRescheduling && (
                                <button
                                    onClick={() => handleAction('cancel')}
                                    className="w-full py-3 text-red-600 hover:bg-red-50 rounded-xl font-medium transition-all dark:hover:bg-red-900/20"
                                >
                                    Cancel Appointment
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

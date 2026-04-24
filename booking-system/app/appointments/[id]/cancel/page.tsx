'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Calendar, Clock, CheckCircle, XCircle, Loader2, Phone, AlertTriangle } from 'lucide-react';

interface Booking {
    id: string;
    patientName: string;
    date: string;
    slot: string;
    serviceName: string;
    clinicId: string;
    status: string;
    email?: string;
    whatsappNumber?: string;
}

const CANCEL_HOURS = 6; // Must match policy

function formatDate(dateStr: string): string {
    try {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-AE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return dateStr; }
}

/** Convert "10:00 AM" slot → minutes-since-midnight */
function slotToMinutes(slot: string): number {
    const m = slot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return 0;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
    if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
    return h * 60 + min;
}

/** Returns true if cancellation is still within the allowed window */
function canCancel(date: string, slot: string): boolean {
    const now = new Date();
    const apptDate = new Date(date + 'T00:00:00');
    apptDate.setMinutes(apptDate.getMinutes() + slotToMinutes(slot));
    const diffHours = (apptDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    return diffHours > CANCEL_HOURS;
}

type Step = 'loading' | 'confirm' | 'too-late' | 'not-found' | 'already-cancelled' | 'cancelling' | 'done' | 'error';

export default function CancelBookingPage() {
    const params = useParams<{ id: string }>();
    const bookingId = params?.id || '';

    const [booking, setBooking] = useState<Booking | null>(null);
    const [step, setStep] = useState<Step>('loading');
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (!bookingId) { setStep('not-found'); return; }
        fetch(`/api/bookings/${bookingId}`)
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then((b: Booking) => {
                setBooking(b);
                if (b.status === 'cancelled') {
                    setStep('already-cancelled');
                } else if (!canCancel(b.date, b.slot)) {
                    setStep('too-late');
                } else {
                    setStep('confirm');
                }
            })
            .catch(code => setStep(code === 404 ? 'not-found' : 'error'));
    }, [bookingId]);

    const handleCancel = async () => {
        if (!booking) return;
        setStep('cancelling');
        try {
            const res = await fetch(`/api/bookings/${booking.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'cancelled', cancelledByPatient: true }),
            });
            if (!res.ok) throw new Error(await res.text());
            setStep('done');
        } catch (e) {
            setErrorMsg(String(e));
            setStep('error');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 text-white text-center">
                    <h1 className="text-xl font-bold">First Medical Center</h1>
                    <p className="text-indigo-200 text-sm mt-0.5">Appointment Management</p>
                </div>

                <div className="p-6">
                    {/* LOADING */}
                    {step === 'loading' && (
                        <div className="flex flex-col items-center gap-3 py-10">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                            <p className="text-gray-500 text-sm">Loading your appointment…</p>
                        </div>
                    )}

                    {/* NOT FOUND */}
                    {step === 'not-found' && (
                        <div className="text-center py-8">
                            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                            <h2 className="text-lg font-bold text-gray-900 mb-2">Appointment Not Found</h2>
                            <p className="text-gray-500 text-sm">This booking link appears to be invalid or expired.</p>
                            <p className="text-gray-500 text-sm mt-2">Call us at <a href="tel:+97142506262" className="text-indigo-600 font-semibold">+971 4 250 6262</a> for help.</p>
                        </div>
                    )}

                    {/* ALREADY CANCELLED */}
                    {step === 'already-cancelled' && booking && (
                        <div className="text-center py-8">
                            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                            <h2 className="text-lg font-bold text-gray-900 mb-2">Already Cancelled</h2>
                            <p className="text-gray-500 text-sm">This appointment was already cancelled.</p>
                            <a href="/booking" className="mt-4 inline-block px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">
                                Book New Appointment
                            </a>
                        </div>
                    )}

                    {/* TOO LATE TO CANCEL */}
                    {step === 'too-late' && booking && (
                        <div className="py-4">
                            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-5">
                                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-bold text-amber-800">Cancellation Window Closed</p>
                                    <p className="text-xs text-amber-700 mt-0.5">Appointments can only be cancelled up to <strong>6 hours before</strong> the scheduled time.</p>
                                </div>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm mb-5">
                                <div className="flex items-center gap-2 text-gray-700">
                                    <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
                                    <span className="font-semibold">{formatDate(booking.date)}</span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-700">
                                    <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
                                    <span>{booking.slot}</span>
                                </div>
                            </div>
                            <p className="text-sm text-gray-500 mb-4">Please contact us directly if you have an emergency:</p>
                            <a href="tel:+97142506262" className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors">
                                <Phone className="w-4 h-4" /> Call +971 4 250 6262
                            </a>
                        </div>
                    )}

                    {/* CONFIRM CANCELLATION */}
                    {step === 'confirm' && booking && (
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 mb-1">Cancel Appointment?</h2>
                            <p className="text-sm text-gray-500 mb-5">Are you sure you want to cancel the following appointment?</p>

                            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm mb-6">
                                <div className="font-semibold text-gray-900">{booking.patientName}</div>
                                <div className="flex items-center gap-2 text-gray-600">
                                    <Calendar className="w-4 h-4 text-indigo-500" />
                                    {formatDate(booking.date)}
                                </div>
                                <div className="flex items-center gap-2 text-gray-600">
                                    <Clock className="w-4 h-4 text-indigo-500" />
                                    {booking.slot}
                                </div>
                                <div className="text-gray-600">{booking.serviceName}</div>
                            </div>

                            <div className="flex gap-3">
                                <a href="/" className="flex-1 py-2.5 text-center text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors">
                                    Keep Appointment
                                </a>
                                <button
                                    onClick={handleCancel}
                                    className="flex-1 py-2.5 text-sm text-white bg-red-600 hover:bg-red-700 rounded-xl font-semibold transition-colors"
                                >
                                    Yes, Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* CANCELLING */}
                    {step === 'cancelling' && (
                        <div className="flex flex-col items-center gap-3 py-10">
                            <Loader2 className="w-8 h-8 animate-spin text-red-500" />
                            <p className="text-gray-500 text-sm">Cancelling your appointment…</p>
                        </div>
                    )}

                    {/* DONE */}
                    {step === 'done' && (
                        <div className="text-center py-8">
                            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                            <h2 className="text-lg font-bold text-gray-900 mb-2">Appointment Cancelled</h2>
                            <p className="text-gray-500 text-sm">Your appointment has been successfully cancelled. A confirmation has been sent to your email.</p>
                            <a href="/booking" className="mt-5 inline-block px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">
                                Book New Appointment
                            </a>
                        </div>
                    )}

                    {/* ERROR */}
                    {step === 'error' && (
                        <div className="text-center py-8">
                            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                            <h2 className="text-lg font-bold text-gray-900 mb-2">Something Went Wrong</h2>
                            <p className="text-gray-500 text-sm">{errorMsg || 'Unable to process your request. Please try again or call us.'}</p>
                            <a href="tel:+97142506262" className="mt-5 flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors">
                                <Phone className="w-4 h-4" /> Call +971 4 250 6262
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

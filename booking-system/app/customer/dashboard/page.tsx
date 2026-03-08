'use client';

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { usePackagesStore } from '@/lib/packages-store';
import { useReviewDiscountStore } from '@/lib/review-discount-store';
import { useSettingsStore } from '@/lib/settings-store';
import { clinics as allClinics } from '@/lib/data';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Package, Calendar, Clock, ChevronRight, User, X, RefreshCw, Plus, AlertCircle, Star, ExternalLink } from 'lucide-react';
import { format, parseISO, isFuture, isToday } from 'date-fns';

interface PatientBooking {
    id: string;
    clinicId: string;
    deptId: string;
    doctorId: string;
    serviceId: string;
    date: string;
    slot: string;
    patientName: string;
    status: string;
    confirmationStatus?: string;
}

export default function CustomerDashboard() {
    const { user, isAuthenticated, logout } = useAuthStore();
    const { getMyPackages } = usePackagesStore();
    const { getReviewDiscount, getCustomerReviews, submitReview } = useReviewDiscountStore();
    const { settings } = useSettingsStore();
    const router = useRouter();

    const [upcomingBookings, setUpcomingBookings] = useState<PatientBooking[]>([]);
    const [loadingBookings, setLoadingBookings] = useState(false);
    const [cancelingId, setCancelingId] = useState<string | null>(null);
    const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
    const [rescheduleBooking, setRescheduleBooking] = useState<PatientBooking | null>(null);
    const [newDate, setNewDate] = useState('');
    const [newSlot, setNewSlot] = useState('');
    const [actionError, setActionError] = useState('');
    const [actionSuccess, setActionSuccess] = useState('');

    useEffect(() => {
        if (!isAuthenticated) router.push('/');
    }, [isAuthenticated, router]);

    useEffect(() => {
        if (user?.phone) fetchUpcomingBookings();
    }, [user?.phone]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchUpcomingBookings = async () => {
        if (!user?.phone) return;
        setLoadingBookings(true);
        try {
            const res = await fetch(`/api/bookings/by-patient?phone=${encodeURIComponent(user.phone)}&name=${encodeURIComponent(user.name)}`);
            const data = await res.json();
            setUpcomingBookings(data.bookings || []);
        } catch {
            console.error('Failed to fetch bookings');
        } finally {
            setLoadingBookings(false);
        }
    };

    const handleCancel = async (id: string) => {
        setCancelingId(id);
        setActionError('');
        try {
            const res = await fetch(`/api/bookings/by-patient?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                setActionSuccess('Appointment cancelled successfully.');
                setConfirmCancelId(null);
                await fetchUpcomingBookings();
            } else {
                const d = await res.json();
                setActionError(d.error || 'Failed to cancel.');
            }
        } catch {
            setActionError('Failed to cancel. Try again.');
        } finally {
            setCancelingId(null);
        }
    };

    const handleReschedule = async () => {
        if (!rescheduleBooking || !newDate || !newSlot) return;
        setActionError('');
        try {
            const res = await fetch('/api/bookings/by-patient', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: rescheduleBooking.id, date: newDate, slot: newSlot }),
            });
            if (res.ok) {
                setActionSuccess('Appointment rescheduled successfully.');
                setRescheduleBooking(null);
                setNewDate(''); setNewSlot('');
                await fetchUpcomingBookings();
            } else {
                const d = await res.json();
                setActionError(d.error || 'Failed to reschedule.');
            }
        } catch {
            setActionError('Failed to reschedule. Try again.');
        }
    };

    if (!isAuthenticated || !user) return null;

    const myPackages = getMyPackages(user.phone);

    const statusColors: Record<string, string> = {
        booked: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
        confirmed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
        rescheduled: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
        cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-12">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome back, {user.name} 👋</h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your appointments and packages</p>
                    </div>
                    <div className="flex gap-4">
                        <Link href="/booking" className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium">
                            <Plus className="w-4 h-4" /> New Booking
                        </Link>
                        <Link href="/packages" className="px-5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium">
                            Packages
                        </Link>
                        <button
                            onClick={() => { logout(); router.push('/'); }}
                            className="px-5 py-2.5 border border-gray-300 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-medium"
                        >
                            Log Out
                        </button>
                    </div>
                </div>

                {/* Action feedback */}
                {actionSuccess && (
                    <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-green-700 dark:text-green-300 flex items-center justify-between">
                        <span>{actionSuccess}</span>
                        <button onClick={() => setActionSuccess('')}><X className="w-4 h-4" /></button>
                    </div>
                )}
                {actionError && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{actionError}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* ── Upcoming Appointments ── */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-indigo-600" /> Upcoming Appointments
                            </h2>
                            <button onClick={fetchUpcomingBookings} className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                                <RefreshCw className="w-3 h-3" /> Refresh
                            </button>
                        </div>

                        {loadingBookings ? (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center text-gray-400">Loading appointments...</div>
                        ) : upcomingBookings.length === 0 ? (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center border border-gray-100 dark:border-gray-700">
                                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white">No Upcoming Appointments</h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-6">Book your first appointment to get started.</p>
                                <Link href="/booking" className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium">
                                    Book Now <ChevronRight className="w-4 h-4" />
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {upcomingBookings.map(booking => {
                                    const bookingDate = parseISO(booking.date);
                                    const isUpcoming = isFuture(bookingDate) || isToday(bookingDate);
                                    return (
                                        <div key={booking.id} className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColors[booking.status] || 'bg-gray-100 text-gray-600'}`}>
                                                            {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                                                        </span>
                                                        {isToday(bookingDate) && (
                                                            <span className="text-xs font-bold text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-full">Today</span>
                                                        )}
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                                            <Calendar className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                                                            <span>{format(bookingDate, 'EEE, MMM d, yyyy')}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                                            <Clock className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                                                            <span>{booking.slot}</span>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-gray-400 mt-2">Booking ID: {booking.id}</p>
                                                </div>
                                                {isUpcoming && booking.status !== 'cancelled' && (
                                                    <div className="flex gap-2 flex-shrink-0">
                                                        <button
                                                            onClick={() => { setRescheduleBooking(booking); setActionError(''); setActionSuccess(''); }}
                                                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 dark:border-indigo-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                                                        >
                                                            <RefreshCw className="w-3 h-3" /> Reschedule
                                                        </button>
                                                        <button
                                                            onClick={() => { setConfirmCancelId(booking.id); setActionError(''); }}
                                                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                        >
                                                            <X className="w-3 h-3" /> Cancel
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* ── Active Packages ── */}
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 pt-4">
                            <Package className="w-5 h-5 text-indigo-600" /> Active Packages
                        </h2>
                        {myPackages.length === 0 ? (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center border border-gray-100 dark:border-gray-700">
                                <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white">No Active Packages</h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-6">Purchase a package to save on services.</p>
                                <Link href="/packages" className="text-indigo-600 hover:text-indigo-800 font-medium">Browse Packages &rarr;</Link>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {myPackages.map(pkg => (
                                    <div key={pkg.id} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-bl-xl dark:bg-green-900/30 dark:text-green-300">ACTIVE</div>
                                        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1">{pkg.packageName}</h3>
                                        <p className="text-sm text-gray-500 mb-4">Expires: {format(parseISO(pkg.expiryDate), 'MMM d, yyyy')}</p>
                                        <div className="space-y-3">
                                            {Object.entries(pkg.remainingSessions).map(([svcId, count]) => (
                                                <div key={svcId} className="flex justify-between items-center text-sm bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg">
                                                    <span className="font-medium text-gray-700 dark:text-gray-300">Service ({svcId.slice(0, 5)}...)</span>
                                                    <span className="font-bold text-indigo-600">{count} left</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── Profile Sidebar ── */}
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
                                    <span className="text-gray-500">Gender</span>
                                    <span className="font-medium text-gray-900 dark:text-white capitalize">{user.gender || '—'}</span>
                                </div>
                                <div className="flex justify-between py-2">
                                    <span className="text-gray-500">Member Since</span>
                                    <span className="font-medium text-gray-900 dark:text-white">{new Date().getFullYear()}</span>
                                </div>
                            </div>
                        </div>

                        {/* ── Google Reviews & Discounts ── */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                                Google Reviews & Discounts
                            </h3>
                            {(() => {
                                const rd = getReviewDiscount(user.phone);
                                const myReviews = getCustomerReviews(user.phone);
                                return (
                                    <>
                                        {/* Discount Status */}
                                        <div className={`text-sm font-medium px-3 py-2 rounded-lg mb-4 ${rd.percent === 3 ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' :
                                                rd.percent === 1 ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' :
                                                    rd.hasSubFiveReview ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' :
                                                        'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                            }`}>
                                            {rd.percent === 3 ? '🎉 3% discount active — all branches reviewed!' :
                                                rd.percent === 1 ? `⭐ 1% discount active — review ${rd.totalBranches - rd.reviewedBranches} more for 3%` :
                                                    rd.hasSubFiveReview ? '❌ No discount — only 5★ reviews qualify' :
                                                        '💡 Leave 5★ Google reviews to earn discounts!'}
                                        </div>

                                        {/* Branch Review List */}
                                        <div className="space-y-3">
                                            {allClinics.map(clinic => {
                                                const existingReview = myReviews.find(r => r.clinicId === clinic.id);
                                                const reviewUrl = settings.googleReviewUrls?.[clinic.id] || clinic.locationMap || '#';
                                                return (
                                                    <div key={clinic.id} className="border border-gray-100 dark:border-gray-700 rounded-xl p-3">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-sm font-semibold text-gray-800 dark:text-white truncate">{clinic.name}</span>
                                                            <a href={reviewUrl} target="_blank" rel="noopener noreferrer"
                                                                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 flex-shrink-0">
                                                                <ExternalLink className="w-3 h-3" /> Google
                                                            </a>
                                                        </div>
                                                        {existingReview ? (
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex">
                                                                    {[1, 2, 3, 4, 5].map(s => (
                                                                        <Star key={s} className={`w-4 h-4 cursor-pointer transition-colors ${s <= existingReview.rating
                                                                                ? 'fill-yellow-500 text-yellow-500'
                                                                                : 'text-gray-300 dark:text-gray-600'
                                                                            }`}
                                                                            onClick={() => submitReview(user.phone, clinic.id, s)}
                                                                        />
                                                                    ))}
                                                                </div>
                                                                <span className="text-xs text-green-600 dark:text-green-400 font-medium">✓ Rated {existingReview.rating}★</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex">
                                                                    {[1, 2, 3, 4, 5].map(s => (
                                                                        <Star key={s}
                                                                            className="w-4 h-4 text-gray-300 dark:text-gray-600 cursor-pointer hover:text-yellow-500 hover:fill-yellow-500 transition-colors"
                                                                            onClick={() => submitReview(user.phone, clinic.id, s)}
                                                                        />
                                                                    ))}
                                                                </div>
                                                                <span className="text-xs text-gray-400">Not rated</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Info */}
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                                            5★ for 1 branch = 1% off • 5★ for all = 3% off
                                        </p>
                                    </>
                                );
                            })()}
                        </div>

                        <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg">
                            <h3 className="font-bold text-lg mb-2">Need Help?</h3>
                            <p className="text-indigo-100 text-sm mb-4">Use the voice assistant to manage your bookings or ask questions.</p>
                            <Link href="/booking" className="block w-full py-3 bg-white text-indigo-600 text-center font-bold rounded-xl hover:bg-gray-50 transition-colors">
                                Book Appointment
                            </Link>
                        </div>
                    </div>

                </div>
            </div>

            {/* ── Cancel Confirmation Modal ── */}
            {confirmCancelId && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Cancel Appointment?</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">This action cannot be undone. Are you sure you want to cancel this appointment?</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmCancelId(null)}
                                className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
                            >
                                Keep It
                            </button>
                            <button
                                onClick={() => handleCancel(confirmCancelId)}
                                disabled={cancelingId === confirmCancelId}
                                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium disabled:opacity-50"
                            >
                                {cancelingId === confirmCancelId ? 'Cancelling...' : 'Yes, Cancel'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Reschedule Modal ── */}
            {rescheduleBooking && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Reschedule Appointment</h3>
                            <button onClick={() => setRescheduleBooking(null)}><X className="w-5 h-5 text-gray-400" /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Date</label>
                                <input
                                    type="date"
                                    value={newDate}
                                    min={new Date().toISOString().split('T')[0]}
                                    onChange={e => setNewDate(e.target.value)}
                                    className="w-full p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Time</label>
                                <select
                                    value={newSlot}
                                    onChange={e => setNewSlot(e.target.value)}
                                    className="w-full p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                >
                                    <option value="">Select a time slot</option>
                                    {['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
                                        '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM',
                                        '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM', '05:00 PM'].map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                </select>
                            </div>
                            {actionError && <p className="text-red-500 text-sm">{actionError}</p>}
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setRescheduleBooking(null)} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl font-medium text-gray-700 dark:text-gray-300">
                                Cancel
                            </button>
                            <button
                                onClick={handleReschedule}
                                disabled={!newDate || !newSlot}
                                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium disabled:opacity-50"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

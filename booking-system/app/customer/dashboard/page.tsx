'use client';

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { clinics as allClinics } from '@/lib/data';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Package, Calendar, Clock, ChevronRight, User, X, RefreshCw, Plus, AlertCircle, Star, ExternalLink } from 'lucide-react';
import type { CustomerPackage } from '@/types/packages';
import type { GoogleReview, ReviewDiscountResult } from '@/lib/review-discount-store';
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
    const router = useRouter();

    // API-fetched state
    const [myPackages, setMyPackages] = useState<CustomerPackage[]>([]);
    const [myReviews, setMyReviews] = useState<GoogleReview[]>([]);
    const [reviewDiscount, setReviewDiscount] = useState<ReviewDiscountResult>({ percent: 0, reviewedBranches: 0, totalBranches: allClinics.length, hasSubFiveReview: false });
    const [googleReviewUrls, setGoogleReviewUrls] = useState<Record<string, string>>({});

    const [upcomingBookings, setUpcomingBookings] = useState<PatientBooking[]>([]);
    const [loadingBookings, setLoadingBookings] = useState(false);
    const [cancelingId, setCancelingId] = useState<string | null>(null);
    const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
    const [rescheduleBooking, setRescheduleBooking] = useState<PatientBooking | null>(null);
    const [newDate, setNewDate] = useState('');
    const [newSlot, setNewSlot] = useState('');
    const [actionError, setActionError] = useState('');
    const [actionSuccess, setActionSuccess] = useState('');
    const [autoDetectedCount, setAutoDetectedCount] = useState(0);
    const [hasBookingHistory, setHasBookingHistory] = useState(false);
    const [visitedClinicIds, setVisitedClinicIds] = useState<string[]>([]);

    // Transfer Package State
    const [transferModalOpen, setTransferModalOpen] = useState(false);
    const [transferPkgId, setTransferPkgId] = useState<string | null>(null);
    const [transferPhone, setTransferPhone] = useState('');
    const [transferName, setTransferName] = useState('');
    const [transferReason, setTransferReason] = useState('');
    
    // Extension Package State
    const [extensionModalOpen, setExtensionModalOpen] = useState(false);
    const [extensionPkgId, setExtensionPkgId] = useState<string | null>(null);
    const [extensionReason, setExtensionReason] = useState<'medical' | 'pregnancy_breastfeeding'>('medical');
    const [extensionDoc, setExtensionDoc] = useState('');
    const [extensionDays, setExtensionDays] = useState(30);

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Gmail check: customer needs a Google account (Gmail) to post Google reviews
    const isGmailEligible = user?.email?.toLowerCase().endsWith('@gmail.com') ||
        user?.email?.toLowerCase().endsWith('@googlemail.com') || false;

    useEffect(() => {
        if (!isAuthenticated) router.push('/');
    }, [isAuthenticated, router]);

    // Fetch packages, reviews, and settings via API
    useEffect(() => {
        if (!user) return;
        const customerId = user.phone || user.email;

        // Fetch active packages
        fetch(`/api/admin/packages?type=my&phone=${encodeURIComponent(user.phone)}`)
            .then(r => r.json()).then(setMyPackages).catch(() => {});

        // Fetch settings for google review URLs
        fetch('/api/admin/settings')
            .then(r => r.json()).then(s => setGoogleReviewUrls(s.googleReviewUrls || {})).catch(() => {});

        // Fetch customer reviews
        fetch(`/api/admin/reviews?customerPhone=${encodeURIComponent(customerId)}`)
            .then(r => r.json()).then((reviews: GoogleReview[]) => {
                setMyReviews(reviews);
                // Calculate discount from reviews
                const fiveStarBranches = new Set(reviews.filter(r => r.rating === 5).map(r => r.clinicId));
                const hasSubFive = reviews.some(r => r.rating < 5);
                const percent = hasSubFive ? 0 : Math.min(fiveStarBranches.size, 3);
                setReviewDiscount({
                    percent,
                    reviewedBranches: fiveStarBranches.size,
                    totalBranches: allClinics.length,
                    hasSubFiveReview: hasSubFive,
                });
            }).catch(() => {});

        // Check booking history
        const params = new URLSearchParams();
        if (user.phone) params.set('phone', user.phone);
        if (user.name) params.set('name', user.name);
        params.set('includeAll', 'true');
        fetch(`/api/bookings/by-patient?${params}`)
            .then(r => r.json())
            .then(data => {
                const bookings = data.bookings || [];
                const visited: string[] = data.visitedClinicIds || [];
                setHasBookingHistory(bookings.length > 0);
                setVisitedClinicIds(visited);
            })
            .catch(() => {});
    }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const handleTransferSubmit = async () => {
        if (!transferPkgId || !transferPhone || !transferName || !transferReason) {
            setActionError('Please fill in all transfer fields.');
            return;
        }
        setIsSubmitting(true);
        setActionError('');
        try {
            const res = await fetch('/api/admin/packages/transfers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerPackageId: transferPkgId,
                    fromCustomerPhone: user?.phone,
                    fromCustomerName: user?.name,
                    toCustomerPhone: transferPhone,
                    toCustomerName: transferName,
                    reason: transferReason
                })
            });
            if (res.ok) {
                setActionSuccess('Transfer request submitted successfully. It will be reviewed by our team.');
                setTransferModalOpen(false);
                setTransferPkgId(null);
                setTransferPhone(''); setTransferName(''); setTransferReason('');
            } else {
                const d = await res.json();
                setActionError(d.error || 'Failed to submit transfer request.');
            }
        } catch {
            setActionError('Network error submitting transfer request.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleExtensionSubmit = async () => {
        if (!extensionPkgId || !extensionDoc) {
            setActionError('Please fill in all extension fields, including a document link/name.');
            return;
        }
        setIsSubmitting(true);
        setActionError('');
        try {
            const res = await fetch('/api/admin/packages/extensions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerPackageId: extensionPkgId,
                    customerPhone: user?.phone,
                    customerName: user?.name,
                    reason: extensionReason,
                    documentUrl: extensionDoc,
                    requestedDays: extensionDays
                })
            });
            if (res.ok) {
                setActionSuccess('Extension request submitted successfully. It will be reviewed by our team.');
                setExtensionModalOpen(false);
                setExtensionPkgId(null);
                setExtensionDoc(''); setExtensionDays(30);
            } else {
                const d = await res.json();
                setActionError(d.error || 'Failed to submit extension request.');
            }
        } catch {
            setActionError('Network error submitting extension request.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isAuthenticated || !user) return null;

    const customerId = user.phone || user.email;

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
                                                        <Link
                                                            href={`/booking?rescheduleId=${booking.id}`}
                                                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 dark:border-indigo-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                                                        >
                                                            <RefreshCw className="w-3 h-3" /> Reschedule
                                                        </Link>
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
                                {myPackages.map(pkg => {
                                    const daysLeft = Math.max(0, Math.ceil((new Date(pkg.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                                    const expiryFormatted = format(parseISO(pkg.expiryDate), 'MMM d, yyyy');
                                    const isPending = pkg.paymentStatus === 'pending' || (!pkg.active && pkg.paymentStatus !== 'paid');
                                    return (
                                        <div key={pkg.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden">
                                            {/* Header badge */}
                                            <div className={`px-5 py-3 ${isPending ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-indigo-500 to-purple-600'}`}>
                                                <div className="flex items-center justify-between">
                                                    <h3 className="font-bold text-white truncate">{pkg.packageName}</h3>
                                                    <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full backdrop-blur flex-shrink-0">
                                                        {isPending ? '⏳ Pending' : `${daysLeft}d left`}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="p-5 space-y-4">
                                                {/* Transferred Notice */}
                                                {pkg.isTransferred && pkg.transferredFrom && (
                                                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-xs text-blue-700 dark:text-blue-400">
                                                        <strong>Transferred Package</strong> — This package was generously transferred to you by {pkg.transferredFrom}.
                                                    </div>
                                                )}

                                                {/* Pending payment notice */}
                                                {isPending && (
                                                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-400">
                                                        <strong>Payment Required</strong> — Visit any branch to complete payment and activate.
                                                    </div>
                                                )}

                                                {/* Session tracking per service */}
                                                {Object.entries(pkg.remainingSessions).map(([svcId, remaining]) => {
                                                    const total = pkg.totalSessions?.[svcId] || remaining;
                                                    const used = total - remaining;
                                                    const nextSession = used + 1;
                                                    // Show the service name from package name
                                                    const serviceName = pkg.packageName.replace(/ - \d+ Sessions?$/i, '');
                                                    return (
                                                        <div key={svcId}>
                                                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{serviceName}</p>
                                                            {/* Session info grid */}
                                                            <div className="grid grid-cols-3 gap-2 text-center mb-2">
                                                                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-2">
                                                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Next Session</p>
                                                                    <p className="text-lg font-extrabold text-indigo-600">{nextSession} <span className="text-xs font-normal text-gray-400">of {total}</span></p>
                                                                </div>
                                                                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2">
                                                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Remaining</p>
                                                                    <p className="text-lg font-extrabold text-emerald-600">{remaining}</p>
                                                                </div>
                                                                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
                                                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Expires</p>
                                                                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{expiryFormatted}</p>
                                                                    <p className="text-[10px] text-gray-400">{daysLeft}d left</p>
                                                                </div>
                                                            </div>
                                                            {/* Progress bar */}
                                                            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full transition-all ${remaining > 0 ? 'bg-gradient-to-r from-indigo-500 to-emerald-500' : 'bg-red-500'}`}
                                                                    style={{ width: `${(used / total) * 100}%` }}
                                                                />
                                                            </div>
                                                            <p className="text-[10px] text-gray-400 mt-1">{used} of {total} sessions used</p>
                                                            
                                                            {/* Book button for this specific service */}
                                                            {!isPending && pkg.active && remaining > 0 && (
                                                                <Link
                                                                    href={`/booking?packageId=${pkg.id}&serviceId=${encodeURIComponent(svcId)}`}
                                                                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 mt-3 mb-4 bg-indigo-50 text-indigo-700 font-bold rounded-xl hover:bg-indigo-100 transition-colors shadow-sm dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 text-sm border border-indigo-100 dark:border-indigo-800"
                                                                >
                                                                    <Calendar className="w-4 h-4" /> Book Session
                                                                </Link>
                                                            )}
                                                        </div>
                                                    );
                                                })}

                                                {/* Actions */}
                                                {!isPending && pkg.active && (
                                                    <div className="space-y-2 mt-4">
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <button 
                                                                onClick={() => { setTransferPkgId(pkg.id); setTransferModalOpen(true); }}
                                                                className="w-full py-2 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-100 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
                                                            >
                                                                Transfer
                                                            </button>
                                                            <button 
                                                                onClick={() => { setExtensionPkgId(pkg.id); setExtensionModalOpen(true); }}
                                                                className="w-full py-2 text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors border border-teal-100 dark:bg-teal-900/30 dark:border-teal-800 dark:text-teal-300 dark:hover:bg-teal-900/50"
                                                            >
                                                                Extend
                                                            </button>
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

                        {/* ── Google Reviews & Discounts (only for customers with booking history) ── */}
                        {hasBookingHistory && (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                                <h3 className="font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                                    Google Reviews & Discounts
                                </h3>

                                {!isGmailEligible ? (
                                    /* Non-Gmail user: show info message */
                                    <div className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg mt-2">
                                        📧 A Google (Gmail) account is required to post Google reviews and earn discounts.
                                        Your current email ({user.email}) is not a Gmail address.
                                    </div>
                                ) : (() => {
                                    const rd = reviewDiscount;
                                    return (
                                        <>
                                            {/* Discount Status */}
                                            <div className={`text-sm font-medium px-3 py-2 rounded-lg mb-2 ${rd.percent >= 3 ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' :
                                                rd.percent === 2 ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' :
                                                    rd.percent === 1 ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' :
                                                        rd.hasSubFiveReview ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' :
                                                            'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                                }`}>
                                                {rd.percent >= 3 ? '🎉 3% discount active — all visited branches reviewed!' :
                                                    rd.percent === 2 ? '⭐ 2% discount active — review 1 more visited branch for 3%' :
                                                        rd.percent === 1 ? '⭐ 1% discount active — review more visited branches to increase' :
                                                            rd.hasSubFiveReview ? '❌ No discount — only 5★ reviews qualify' :
                                                                '💡 Leave 5★ Google reviews for visited branches to earn discounts!'}
                                            </div>
                                            {autoDetectedCount > 0 && (
                                                <div className="text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-3 py-1.5 rounded-lg mb-3 flex items-center gap-1">
                                                    🔍 {autoDetectedCount} review(s) auto-detected from Google
                                                </div>
                                            )}

                                            {/* Branch Review List */}
                                            <div className="space-y-3">
                                                {allClinics.map(clinic => {
                                                    const hasVisited = visitedClinicIds.includes(clinic.id);
                                                    const existingReview = myReviews.find(r => r.clinicId === clinic.id);
                                                    const reviewUrl = googleReviewUrls[clinic.id] || clinic.locationMap || '#';
                                                    return (
                                                        <div key={clinic.id} className={`border rounded-xl p-3 ${hasVisited ? 'border-gray-100 dark:border-gray-700' : 'border-gray-100 dark:border-gray-700 opacity-60'
                                                            }`}>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-sm font-semibold text-gray-800 dark:text-white truncate">{clinic.name}</span>
                                                                {hasVisited && (
                                                                    <a href={reviewUrl} target="_blank" rel="noopener noreferrer"
                                                                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 flex-shrink-0">
                                                                        <ExternalLink className="w-3 h-3" /> Google
                                                                    </a>
                                                                )}
                                                            </div>
                                                            {!hasVisited ? (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs text-gray-400 italic">Not yet visited — book a service here to unlock review</span>
                                                                </div>
                                                            ) : existingReview ? (
                                                                <div className="flex items-center gap-2">
                                                                    <div className="flex">
                                                                        {[1, 2, 3, 4, 5].map(s => (
                                                                            <Star key={s} className={`w-4 h-4 cursor-pointer transition-colors ${s <= existingReview.rating
                                                                                ? 'fill-yellow-500 text-yellow-500'
                                                                                : 'text-gray-300 dark:text-gray-600'
                                                                                }`}
                                                                                onClick={() => { fetch('/api/admin/reviews', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ customerPhone: customerId, clinicId: clinic.id, rating: s }) }).then(() => { setMyReviews(prev => { const filtered = prev.filter(r => !(r.customerPhone === customerId && r.clinicId === clinic.id)); return [...filtered, { id: `temp-${Date.now()}`, customerPhone: customerId, clinicId: clinic.id, rating: s, submittedAt: new Date().toISOString() }]; }); }); }}
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
                                                                                onClick={() => { fetch('/api/admin/reviews', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ customerPhone: customerId, clinicId: clinic.id, rating: s }) }).then(() => { setMyReviews(prev => [...prev, { id: `temp-${Date.now()}`, customerPhone: customerId, clinicId: clinic.id, rating: s, submittedAt: new Date().toISOString() }]); }); }}
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
                                                5★ for 1 branch = 1% off • 2 branches = 2% off • all 3 = 3% off
                                            </p>
                                        </>
                                    );
                                })()}
                            </div>
                        )}

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

            {/* ── Transfer Package Modal ── */}
            {transferModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Transfer Package</h3>
                            <button onClick={() => setTransferModalOpen(false)}><X className="w-5 h-5 text-gray-400" /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recipient Name</label>
                                <input type="text" value={transferName} onChange={e => setTransferName(e.target.value)} className="w-full p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recipient Phone Number</label>
                                <input type="tel" value={transferPhone} onChange={e => setTransferPhone(e.target.value)} className="w-full p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason for Transfer</label>
                                <textarea value={transferReason} onChange={e => setTransferReason(e.target.value)} rows={2} className="w-full p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"></textarea>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => { setTransferModalOpen(false); setTransferPkgId(null); }} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl font-medium text-gray-700 dark:text-gray-300">
                                Cancel
                            </button>
                            <button onClick={handleTransferSubmit} disabled={isSubmitting || !transferName || !transferPhone || !transferReason} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium disabled:opacity-50">
                                {isSubmitting ? 'Submitting...' : 'Submit Request'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Extend Package Modal ── */}
            {extensionModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Extend Package Request</h3>
                            <button onClick={() => setExtensionModalOpen(false)}><X className="w-5 h-5 text-gray-400" /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
                                <select value={extensionReason} onChange={e => setExtensionReason(e.target.value as any)} className="w-full p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                                    <option value="medical">Medical Condition</option>
                                    <option value="pregnancy_breastfeeding">Pregnancy / Breastfeeding</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Requested Days to Extend</label>
                                <select value={extensionDays} onChange={e => setExtensionDays(Number(e.target.value))} className="w-full p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                                    <option value={30}>30 Days</option>
                                    <option value={60}>60 Days</option>
                                    <option value={90}>90 Days</option>
                                    <option value={180}>180 Days (6 Months)</option>
                                    <option value={365}>365 Days (1 Year)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Medical Document Link / Name</label>
                                <input type="text" value={extensionDoc} onChange={e => setExtensionDoc(e.target.value)} placeholder="URL or Document description" className="w-full p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                                <p className="text-[10px] text-gray-400 mt-1">Please provide a link to your medical report or physical document reference.</p>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => { setExtensionModalOpen(false); setExtensionPkgId(null); }} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl font-medium text-gray-700 dark:text-gray-300">
                                Cancel
                            </button>
                            <button onClick={handleExtensionSubmit} disabled={isSubmitting || !extensionDoc} className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-medium disabled:opacity-50">
                                {isSubmitting ? 'Submitting...' : 'Submit Request'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

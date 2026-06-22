'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { History, Search, ArrowLeft, Calendar as CalendarIcon, Clock, User, Phone, XCircle } from 'lucide-react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import type { Booking } from '@/lib/data';
import type { SimplybookRecord } from '@/lib/simplybook-store';

interface CancelledBooking {
    id: string;
    source: 'app' | 'simplybook';
    patientName: string;
    patientPhone: string;
    serviceName: string;
    date: string;
    time: string;
    cancellationDate: string;
    cancelledBy: string;
    originalRecord: Booking | SimplybookRecord;
}

export default function CancelledAppointmentsPage() {
    const [bookings, setBookings] = useState<CancelledBooking[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [cancellationDateFilter, setCancellationDateFilter] = useState('');

    useEffect(() => {
        fetchCancelledBookings();
    }, []);

    const fetchCancelledBookings = async () => {
        setIsLoading(true);
        try {
            // Fetch normal bookings
            const resBookings = await fetch('/api/admin/bookings?limit=10000');
            let allAppBookings: Booking[] = [];
            let appBookings: Booking[] = [];
            if (resBookings.ok) {
                const data = await resBookings.json();
                allAppBookings = Array.isArray(data) ? data : data.data || [];
                appBookings = allAppBookings.filter((b: Booking) => b.status === 'cancelled');
            }

            // Fetch SB bookings
            const defaultFrom = new Date(); defaultFrom.setMonth(defaultFrom.getMonth() - 6);
            const defaultTo = new Date(); defaultTo.setMonth(defaultTo.getMonth() + 6);
            const fmt = (d: Date) => d.toISOString().split('T')[0];
            const resSb = await fetch(`/api/admin/simplybook?from=${fmt(defaultFrom)}&to=${fmt(defaultTo)}`);
            let sbBookings: SimplybookRecord[] = [];
            if (resSb.ok) {
                const data = await resSb.json();
                sbBookings = (Array.isArray(data) ? data : []).filter((sb: SimplybookRecord) => sb.status === 'cancelled');
            }

            // Combine and format
            const combined: CancelledBooking[] = [];

            // Helper to get cancellation info from App Booking
            const getAppCancellationInfo = (b: Booking) => {
                let cancellationDate = b.createdAt;
                let cancelledBy = 'Unknown';
                if (b.statusHistory && Array.isArray(b.statusHistory)) {
                    const cancelEvent = b.statusHistory.slice().reverse().find(h => h.newStatus === 'cancelled');
                    if (cancelEvent) {
                        cancellationDate = cancelEvent.timestamp;
                        cancelledBy = cancelEvent.changedBy;
                    }
                }
                return { cancellationDate, cancelledBy };
            };

            // Process App Bookings
            appBookings.forEach(b => {
                const { cancellationDate, cancelledBy } = getAppCancellationInfo(b);
                combined.push({
                    id: b.id,
                    source: 'app',
                    patientName: b.patientName || 'Unknown',
                    patientPhone: b.whatsappNumber || b.email || 'N/A',
                    serviceName: b.serviceName || 'Unknown Service',
                    date: b.date,
                    time: b.slot,
                    cancellationDate,
                    cancelledBy,
                    originalRecord: b
                });
            });

            // Process SimplyBook Bookings
            // Avoid adding SB bookings that are already imported into app bookings
            const importedSbIds = new Set(allAppBookings.map(b => b.sbId).filter(Boolean));
            sbBookings.forEach(sb => {
                if (importedSbIds.has(sb.sbId)) return;
                
                combined.push({
                    id: sb.sbId,
                    source: 'simplybook',
                    patientName: sb.clientName || 'Unknown',
                    patientPhone: sb.clientPhone || sb.clientEmail || 'N/A',
                    serviceName: sb.serviceName || 'Unknown Service',
                    date: sb.date,
                    time: sb.time,
                    cancellationDate: sb.updatedAt || sb.receivedAt || new Date().toISOString(),
                    cancelledBy: 'SimplyBook',
                    originalRecord: sb
                });
            });

            // Sort by cancellation date descending
            combined.sort((a, b) => new Date(b.cancellationDate).getTime() - new Date(a.cancellationDate).getTime());
            setBookings(combined);

        } catch (error) {
            console.error('Failed to fetch cancelled bookings', error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredBookings = useMemo(() => {
        return bookings.filter(b => {
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const matchName = b.patientName.toLowerCase().includes(q);
                const matchPhone = b.patientPhone.toLowerCase().includes(q);
                const matchBy = b.cancelledBy.toLowerCase().includes(q);
                if (!matchName && !matchPhone && !matchBy) return false;
            }
            if (dateFilter && b.date !== dateFilter) return false;
            if (cancellationDateFilter) {
                const cancelDate = b.cancellationDate.split('T')[0];
                if (cancelDate !== cancellationDateFilter) return false;
            }
            return true;
        });
    }, [bookings, searchQuery, dateFilter, cancellationDateFilter]);

    const formatDate = (isoString: string) => {
        try {
            return format(parseISO(isoString), 'MMM d, yyyy h:mm a');
        } catch {
            return isoString;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-7xl mx-auto">
                <header className="mb-8">
                    <Link href="/admin/appointments" className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:underline mb-4">
                        <ArrowLeft className="w-4 h-4" /> Back to Calendar
                    </Link>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                                <XCircle className="w-8 h-8 text-red-500" />
                                Cancelled Appointments
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400 mt-1">
                                View and filter all cancelled bookings across the system.
                            </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-3">
                            <div className="text-center px-4 border-r border-gray-200 dark:border-gray-700">
                                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{filteredBookings.length}</div>
                                <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Cancelled</div>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-8">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex flex-wrap gap-4 items-center">
                        <div className="flex-1 min-w-[250px] relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by patient name, phone, or cancelled by..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="w-full sm:w-auto flex items-center gap-2">
                            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Booking Date:</label>
                            <input
                                type="date"
                                value={dateFilter}
                                onChange={e => setDateFilter(e.target.value)}
                                className="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                            />
                        </div>
                        <div className="w-full sm:w-auto flex items-center gap-2">
                            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Cancel Date:</label>
                            <input
                                type="date"
                                value={cancellationDateFilter}
                                onChange={e => setCancellationDateFilter(e.target.value)}
                                className="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                            />
                        </div>
                        {(searchQuery || dateFilter || cancellationDateFilter) && (
                            <button
                                onClick={() => { setSearchQuery(''); setDateFilter(''); setCancellationDateFilter(''); }}
                                className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                            >
                                Clear Filters
                            </button>
                        )}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-750 text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Patient Details</th>
                                    <th className="px-6 py-4 font-medium">Service & Source</th>
                                    <th className="px-6 py-4 font-medium">Booking Date & Time</th>
                                    <th className="px-6 py-4 font-medium">Cancelled On</th>
                                    <th className="px-6 py-4 font-medium">Cancelled By</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                            Loading cancelled appointments...
                                        </td>
                                    </tr>
                                ) : filteredBookings.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                            No cancelled appointments found matching your filters.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredBookings.map(booking => (
                                        <tr key={`${booking.source}-${booking.id}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
                                                        <User className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-gray-900 dark:text-white">{booking.patientName}</div>
                                                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                                            <Phone className="w-3 h-3" /> {booking.patientPhone}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900 dark:text-white">{booking.serviceName}</div>
                                                <span className={`inline-flex items-center px-2 py-0.5 mt-1 rounded text-[10px] font-bold ${
                                                    booking.source === 'simplybook'
                                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                        : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                                                }`}>
                                                    {booking.source === 'simplybook' ? 'SimplyBook' : 'App Booking'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5 text-gray-900 dark:text-white font-medium">
                                                    <CalendarIcon className="w-4 h-4 text-gray-400" />
                                                    {booking.date}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {booking.time}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                                                {formatDate(booking.cancellationDate)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200">
                                                    <History className="w-3.5 h-3.5 text-gray-400" />
                                                    {booking.cancelledBy}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

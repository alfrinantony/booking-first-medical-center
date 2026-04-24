'use client';

import React, { useState, useEffect } from 'react';
import { Clinic, Booking, timeSlots, Medicine } from '@/lib/data';
import { Calendar, Filter, User, MapPin, Stethoscope, Clock, FileText, Plus, Pill, UserPlus, X, History, Sparkles, ExternalLink, Phone, CreditCard, Package, CheckCircle, Pencil, Mail } from 'lucide-react';
import { ClientsStore } from '@/lib/clients-store';
import Link from 'next/link';
import type { SimplybookRecord } from '@/lib/simplybook-store';
import {
    format, startOfMonth, endOfMonth, eachDayOfInterval,
    isSameMonth, isSameDay, isToday,
    startOfWeek, endOfWeek, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays
} from 'date-fns';

export default function AdminAppointmentsPage() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [sbBookings, setSbBookings] = useState<SimplybookRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [medicineCatalog, setMedicineCatalog] = useState<Medicine[]>([]);
    const [clinics, setClinics] = useState<Clinic[]>([]);
    const [clinicsLoading, setClinicsLoading] = useState(true);
    // App invoice lookup: bookingId / sbId → { id, invoiceNumber }
    const [appInvoiceMap, setAppInvoiceMap] = useState<Record<string, { id: string; invoiceNumber: string }>>({});
    // On-demand fetched SB invoice data: sbId → { invoiceNumber, invoiceAmount, paymentProcessor, ... }
    const [invoiceFetchMap, setInvoiceFetchMap] = useState<Record<string, {
        invoiceNumber?: string; invoiceAmount?: number; invoiceCurrency?: string;
        paymentProcessor?: string; paymentStatus?: string; error?: string;
    }>>({});
    const [fetchingInvoices, setFetchingInvoices] = useState<Record<string, boolean>>({});
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMsg, setSyncMsg] = useState<{ text: string; ok: boolean } | null>(null);

    // ── Edit SB Client Info ──
    const [editClientModal, setEditClientModal] = useState<false | { sbId: string; name: string; phone: string; email: string }>(false);
    const [editClientSaving, setEditClientSaving] = useState(false);

    const handleSaveClientEdit = async () => {
        if (!editClientModal) return;
        setEditClientSaving(true);
        try {
            const res = await fetch(`/api/admin/simplybook/${editClientModal.sbId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientName: editClientModal.name, clientPhone: editClientModal.phone, clientEmail: editClientModal.email }),
            });
            if (res.ok) {
                // Refresh SB bookings so the updated name/phone shows immediately
                await fetchSbBookings();
                setEditClientModal(false);
            } else {
                alert('Failed to save. Please try again.');
            }
        } catch { alert('Save failed.'); } finally { setEditClientSaving(false); }
    };

    // Filters
    const [selectedClinicId, setSelectedClinicId] = useState<string>('');
    const [selectedDeptId, setSelectedDeptId] = useState<string>('');
    const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');

    // Calendar State
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');

    // Current User & Permissions
    const [currentUser, setCurrentUser] = useState<any>(null);
    useEffect(() => {
        try {
            const user = JSON.parse(sessionStorage.getItem('adminUser') || '{}');
            setCurrentUser(user);
        } catch { }
    }, []);

    const canReassignDoctor = currentUser?.role === 'SUPER_ADMIN' ||
        (currentUser?.permissions?.['reassign_doctor']?.length > 0) ||
        false;

    // Fetch live clinic data from API
    useEffect(() => {
        const fetchClinics = async () => {
            try {
                const res = await fetch('/api/admin/services');
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    setClinics(data);
                }
            } catch (error) {
                console.error('Failed to fetch clinics', error);
            } finally {
                setClinicsLoading(false);
            }
        };
        fetchClinics();
    }, []);

    // Derived Data — work independently, not cascading
    const selectedClinic = clinics.find(c => c.id === selectedClinicId);
    // Categories: collect unique department names from all clinics or selected clinic
    const allDepts = (selectedClinic ? selectedClinic.departments : clinics.flatMap(c => c.departments));
    const uniqueDeptNames = Array.from(new Set(allDepts.map(d => d.name)));
    const deptOptions = uniqueDeptNames.map(name => {
        const dept = allDepts.find(d => d.name === name)!;
        return { id: dept.id, name: dept.name };
    });
    // Doctors: collect all doctors from all departments (not filtered by category)
    const allDoctors = (() => {
        const seen = new Set<string>();
        const docs: { id: string; name: string }[] = [];
        const clinicList = selectedClinicId ? [selectedClinic].filter(Boolean) as Clinic[] : clinics;
        for (const clinic of clinicList) {
            for (const dept of clinic.departments) {
                for (const doc of dept.doctors) {
                    if (!seen.has(doc.id)) {
                        seen.add(doc.id);
                        docs.push({ id: doc.id, name: doc.name });
                    }
                }
            }
        }
        return docs.sort((a, b) => a.name.localeCompare(b.name));
    })();

    useEffect(() => {
        // Debounce search
        const timeoutId = setTimeout(() => {
            fetchBookings();
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [selectedClinicId, selectedDeptId, selectedDoctorId, searchQuery]);

    // Fetch SB bookings from local store (cached after sync)
    const fetchSbBookings = async (from?: string, to?: string) => {
        try {
            const fmt = (d: Date) => d.toISOString().split('T')[0];
            const defaultFrom = new Date(); defaultFrom.setMonth(defaultFrom.getMonth() - 1);
            const defaultTo   = new Date(); defaultTo.setMonth(defaultTo.getMonth() + 3);
            const url = `/api/admin/simplybook?from=${from ?? fmt(defaultFrom)}&to=${to ?? fmt(defaultTo)}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) setSbBookings(data);
            }
        } catch { /* ignore */ }
    };

    // Sync upcoming appointments from SimplyBook's live API into local store, then refresh
    const syncUpcoming = async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        setSyncMsg(null);
        try {
            const fmt = (d: Date) => d.toISOString().split('T')[0];
            const from = new Date(); // today
            const to   = new Date(); to.setMonth(to.getMonth() + 3); // 3 months ahead
            const res = await fetch(
                `/api/admin/simplybook?sync=true&from=${fmt(from)}&to=${fmt(to)}`
            );
            const data = await res.json();
            if (data.ok) {
                setSyncMsg({ ok: true, text: `✓ ${data.synced ?? 0} appointments synced from SimplyBook` });
                // Refresh the SB bookings list from store
                await fetchSbBookings();
            } else {
                setSyncMsg({ ok: false, text: `Sync failed: ${data.error || 'Unknown error'}` });
            }
        } catch (e) {
            setSyncMsg({ ok: false, text: 'Sync failed — check SimplyBook API connection' });
        } finally {
            setIsSyncing(false);
            // Auto-clear message after 6 seconds
            setTimeout(() => setSyncMsg(null), 6000);
        }
    };

    // Fetch SimplyBook bookings for current month ± 3 months, then auto-sync future appointments
    useEffect(() => {
        (async () => {
            await fetchSbBookings();
            // Silently auto-sync upcoming 3 months in background
            try {
                const fmt = (d: Date) => d.toISOString().split('T')[0];
                const from = new Date();
                const to   = new Date(); to.setMonth(to.getMonth() + 3);
                const res = await fetch(`/api/admin/simplybook?sync=true&from=${fmt(from)}&to=${fmt(to)}`);
                const data = await res.json();
                if (data.ok && (data.synced ?? 0) > 0) await fetchSbBookings();
            } catch { /* silent - don't disrupt UI */ }
        })();
    }, []);

    // Build app invoice map: fetch billing invoices and index by bookingId + sbId
    useEffect(() => {
        const buildInvoiceMap = async () => {
            try {
                const res = await fetch('/api/admin/billing');
                if (!res.ok) return;
                const invoices: Array<{ id: string; invoiceNumber: string; bookingId?: string; sbId?: string }> = await res.json();
                const map: Record<string, { id: string; invoiceNumber: string }> = {};
                for (const inv of invoices) {
                    if (inv.bookingId) map[inv.bookingId] = { id: inv.id, invoiceNumber: inv.invoiceNumber };
                    if (inv.sbId) map[inv.sbId] = { id: inv.id, invoiceNumber: inv.invoiceNumber };
                }
                setAppInvoiceMap(map);
            } catch { /* ignore */ }
        };
        buildInvoiceMap();
    }, []);

    // Fetch SB invoice number on-demand for a specific booking
    const fetchInvoiceForBooking = async (sbId: string, date: string) => {
        if (fetchingInvoices[sbId]) return;
        setFetchingInvoices(prev => ({ ...prev, [sbId]: true }));
        try {
            const res = await fetch(`/api/admin/simplybook?fetch_invoice=true&sbId=${sbId}&date=${date}`);
            const data = await res.json();
            if (data.ok) {
                setInvoiceFetchMap(prev => ({ ...prev, [sbId]: {
                    invoiceNumber:    data.invoiceNumber,
                    invoiceAmount:    data.invoiceAmount,
                    invoiceCurrency:  data.invoiceCurrency,
                    paymentProcessor: data.paymentProcessor,
                    paymentStatus:    data.paymentStatus,
                }}));
                // Update sbBookings state so SB-only cards refresh
                setSbBookings(prev => prev.map(b =>
                    b.sbId === sbId ? { ...b,
                        invoiceNumber:    data.invoiceNumber,
                        invoiceAmount:    data.invoiceAmount ?? b.invoiceAmount,
                        paymentProcessor: data.paymentProcessor ?? b.paymentProcessor,
                        paymentStatus:    data.paymentStatus ?? b.paymentStatus,
                    } as any : b
                ));
                // Also patch bookings state so merged SB cards refresh live
                setBookings(prev => prev.map(b =>
                    (b as any).sbId === sbId ? { ...b,
                        sbPaymentStatus:    data.paymentStatus    ?? (b as any).sbPaymentStatus,
                        sbInvoiceNumber:    data.invoiceNumber    ?? (b as any).sbInvoiceNumber,
                        sbInvoiceAmount:    data.invoiceAmount    ?? (b as any).sbInvoiceAmount,
                        sbInvoiceCurrency:  data.invoiceCurrency  ?? (b as any).sbInvoiceCurrency,
                        sbPaymentProcessor: data.paymentProcessor ?? (b as any).sbPaymentProcessor,
                    } as any : b
                ));
            } else {
                setInvoiceFetchMap(prev => ({ ...prev, [sbId]: { error: data.error || 'Not found' } }));
            }
        } catch {
            setInvoiceFetchMap(prev => ({ ...prev, [sbId]: { error: 'Fetch failed' } }));
        } finally {
            setFetchingInvoices(prev => ({ ...prev, [sbId]: false }));
        }
    };

    useEffect(() => {
        fetch('/api/admin/medicines').then(r => r.json()).then(data => {
            if (Array.isArray(data)) setMedicineCatalog(data);
        }).catch(() => { });
    }, []);

    const fetchBookings = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (selectedClinicId) params.append('clinicId', selectedClinicId);
            if (selectedDeptId) params.append('deptId', selectedDeptId);
            if (selectedDoctorId) params.append('doctorId', selectedDoctorId);
            if (searchQuery) params.append('search', searchQuery);

            const res = await fetch(`/api/admin/bookings?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setBookings(data);
            }
        } catch (error) {
            console.error('Failed to fetch bookings', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getBookingsForDate = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return bookings.filter(b => b.date === dateStr);
    };

    const getSbBookingsForDate = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return sbBookings.filter(b => b.date === dateStr && b.status !== 'cancelled');
    };

    const selectedDayBookings = getBookingsForDate(selectedDate);
    // Exclude SB bookings that have been migrated (already shown in selectedDayBookings)
    const migratedSbIds = new Set(bookings.filter(b => (b as any).source === 'simplybook').map(b => (b as any).sbId).filter(Boolean));
    const selectedDaySbBookings = getSbBookingsForDate(selectedDate).filter(sb => !migratedSbIds.has(sb.sbId));

    const getServiceName = (booking: Booking) => {
        if (booking.serviceName) return booking.serviceName;
        for (const clinic of clinics) {
            for (const dept of clinic.departments) {
                const svc = dept.services.find(s => s.id === booking.serviceId);
                if (svc) return svc.name;
            }
        }
        return 'Unknown Service';
    };

    const getClinicName = (booking: Booking) => {
        if (booking.clinicId === 'simplybook-import') return 'SimplyBook Import';
        const c = clinics.find(c => c.id === booking.clinicId);
        return c ? c.name : booking.clinicId;
    };

    const getDoctorName = (booking: Booking) => {
        if (booking.anyDoctor) return 'Any Available Doctor';
        if (booking.doctorId === 'sb-unmatched') return (booking as any).sbProviderName || 'SimplyBook Provider (Unmatched)';
        for (const clinic of clinics) {
            for (const dept of clinic.departments) {
                const doc = dept.doctors.find(d => d.id === booking.doctorId);
                if (doc) return doc.name;
            }
        }
        return booking.doctorId;
    };

    // Navigation
    const handlePrevious = () => {
        if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
        if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1));
        if (viewMode === 'day') {
            const newDate = subDays(currentDate, 1);
            setCurrentDate(newDate);
            setSelectedDate(newDate);
        }
    };

    const handleNext = () => {
        if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
        if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
        if (viewMode === 'day') {
            const newDate = addDays(currentDate, 1);
            setCurrentDate(newDate);
            setSelectedDate(newDate);
        }
    };

    const handleToday = () => {
        const now = new Date();
        setCurrentDate(now);
        setSelectedDate(now);
    };

    // Calendar Generation
    const getDaysToRender = () => {
        if (viewMode === 'month') {
            const monthStart = startOfMonth(currentDate);
            const monthEnd = endOfMonth(currentDate);
            const start = startOfWeek(monthStart);
            const end = endOfWeek(monthEnd);
            return eachDayOfInterval({ start, end });
        }
        if (viewMode === 'week') {
            const start = startOfWeek(currentDate);
            const end = endOfWeek(currentDate);
            return eachDayOfInterval({ start, end });
        }
        return [currentDate]; // Day view
    };

    const calendarDays = getDaysToRender();

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
    const [editForm, setEditForm] = useState<{
        status: Booking['status'];
        date: string;
        slot: string;
        doctorId: string;
        duration: number;
    }>({ status: 'booked', date: '', slot: '', doctorId: '', duration: 30 });
    const [availableToRescheduleSlots, setAvailableToRescheduleSlots] = useState<string[]>([]);
    const [isLoadingRescheduleSlots, setIsLoadingRescheduleSlots] = useState(false);

    // History Modal
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [historyBooking, setHistoryBooking] = useState<Booking | null>(null);

    // Get admin user name for audit
    const getStaffName = () => {
        try {
            const user = JSON.parse(sessionStorage.getItem('adminUser') || '{}');
            return user.name || user.username || 'Admin';
        } catch { return 'Admin'; }
    };

    const getNextStatusOptions = (currentStatus: Booking['status']) => {
        const flow: Record<string, Booking['status'][]> = {
            'booked': ['confirmed', 'cancelled'],
            'confirmed': ['arrived', 'cancelled', 'rescheduled', 'no_show'],
            'rescheduled': ['confirmed', 'cancelled'],
            'arrived': ['in_service', 'cancelled', 'no_show'],
            'in_service': ['completed', 'cancelled'],
            'completed': [], // Terminal state
            'cancelled': [],  // Terminal state
            'no_show': []     // Terminal state
        };
        return flow[currentStatus] || [];
    };

    const handleGenerateReceipt = (bookingId: string, sbRef?: string, sbId?: string) => {
        const params = new URLSearchParams({ bookId: bookingId });
        if (sbRef) params.set('sbRef', sbRef);
        if (sbId)  params.set('sbId',  sbId);
        window.location.href = `/admin/billing?${params.toString()}`;
    };

    const handleEditClick = (booking: Booking) => {
        if (booking.billingStatus === 'billed') {
            alert("This appointment has already been billed and cannot be edited.");
            return;
        }
        setEditingBooking(booking);
        setEditForm({
            status: booking.status,
            date: booking.date,
            slot: booking.slot,
            doctorId: booking.doctorId,
            duration: booking.duration || 30 // Default if missing
        });
        setIsEditModalOpen(true);
        // Initial fetch for slots if dates are different or just to populate
        fetchRescheduleSlots(booking.doctorId, booking.date, booking.serviceId);
    };

    const fetchRescheduleSlots = async (doctorId: string, date: string, serviceId: string) => {
        setIsLoadingRescheduleSlots(true);
        try {
            const res = await fetch(`/api/admin/schedule?doctorId=${doctorId}&date=${date}&serviceId=${serviceId}`);
            if (res.ok) {
                const data = await res.json();
                setAvailableToRescheduleSlots(data.slots || []);
            }
        } catch (error) {
            console.error('Failed to fetch slots', error);
        } finally {
            setIsLoadingRescheduleSlots(false);
        }
    };

    useEffect(() => {
        if (isEditModalOpen && editingBooking) {
            fetchRescheduleSlots(editForm.doctorId, editForm.date, editingBooking.serviceId);
        }
    }, [editForm.date, editForm.doctorId, editForm.duration, isEditModalOpen]);

    const handleSaveChanges = async () => {
        if (!editingBooking) return;

        try {
            const res = await fetch(`/api/bookings/${editingBooking.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: editForm.status,
                    date: editForm.date,
                    slot: editForm.slot,
                    doctorId: editForm.doctorId,
                    duration: editForm.duration,
                    staffName: getStaffName(),
                    ...(editForm.status === 'completed' && editingBooking.status !== 'completed' ? { billingStatus: 'pending_bill' } : {})
                })
            });

            if (res.ok) {
                // If status changed to no_show, record the restriction
                if (editForm.status === 'no_show' && editingBooking.status !== 'no_show') {
                    const clientId = editingBooking.whatsappNumber || editingBooking.email || editingBooking.patientName;
                    fetch('/api/admin/restrictions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'recordNoShow', clientId }) });
                }
                setIsEditModalOpen(false);
                fetchBookings(); // Refresh list
            } else {
                alert('Failed to update booking');
            }
        } catch (error) {
            console.error('Update failed', error);
            alert('Error updating booking');
        }
    };

    const availableDocsForEdit = (() => {
        if (!editingBooking) return [];

        // For unmatched SimplyBook bookings, show ALL doctors across ALL clinics
        const isUnmatched = editingBooking.doctorId === 'sb-unmatched' ||
            editingBooking.clinicId === 'simplybook-import';
        if (isUnmatched) {
            const docsMap = new Map<string, { id: string; name: string }>();
            clinics.forEach(c =>
                c.departments.forEach(d =>
                    (d.doctors || []).forEach(doc => docsMap.set(doc.id, doc))
                )
            );
            return Array.from(docsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        }

        const clinic = clinics.find(c => c.id === editingBooking.clinicId);
        if (!clinic) return [];

        let docs: any[] = [];
        if (editingBooking.deptId) {
            const dept = clinic.departments.find(d => d.id === editingBooking.deptId);
            if (dept) docs = dept.doctors || [];
        }

        if (docs.length === 0 && editingBooking.serviceId) {
            const deptsWithService = clinic.departments.filter(d => 
                d.services && d.services.some(s => s.id === editingBooking.serviceId)
            );
            const docsMap = new Map();
            deptsWithService.forEach(d => {
                (d.doctors || []).forEach(doc => docsMap.set(doc.id, doc));
            });
            docs = Array.from(docsMap.values());
        }

        if (docs.length === 0) {
            const docsMap = new Map();
            clinic.departments.forEach(d => {
                (d.doctors || []).forEach(doc => docsMap.set(doc.id, doc));
            });
            docs = Array.from(docsMap.values());
        }
        return docs;
    })();

    // Quick Client Registration
    const [isQuickRegOpen, setIsQuickRegOpen] = useState(false);
    const [quickForm, setQuickForm] = useState({ firstName: '', lastName: '', email: '', phone: '', gender: '', dateOfBirth: '' });

    const saveQuickClient = () => {
        const fullName = `${quickForm.firstName} ${quickForm.lastName}`.trim();
        if (!fullName) { alert('Please enter first and last name'); return; }
        // Generate a unique ID
        const clientId = `client_${Date.now()}`;
        ClientsStore.update(clientId, {
            name: fullName,
            firstName: quickForm.firstName,
            lastName: quickForm.lastName,
            email: quickForm.email || undefined,
            mobile: quickForm.phone || undefined,
            phone: quickForm.phone || undefined,
            gender: (quickForm.gender as 'Male' | 'Female') || undefined,
            dateOfBirth: quickForm.dateOfBirth || undefined,
        });
        setIsQuickRegOpen(false);
        setQuickForm({ firstName: '', lastName: '', email: '', phone: '', gender: '', dateOfBirth: '' });
        alert(`Client "${fullName}" registered successfully!\nRemaining details can be filled at the clinic.`);
    };


    return (
        <div className="h-dvh flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">

            {/* ── HEADER ── */}
            <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-violet-600 px-6 py-4 shrink-0">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Calendar className="h-5 w-5 text-indigo-200" />
                            <h1 className="text-white font-bold text-xl tracking-tight">Appointments</h1>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[11px] text-indigo-300 font-medium">Today:</span>
                            <span className="text-[11px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full">
                                {getBookingsForDate(new Date()).length + getSbBookingsForDate(new Date()).length} Total
                            </span>
                            <span className="text-[11px] font-bold bg-green-400/30 text-green-100 px-2 py-0.5 rounded-full">
                                {getBookingsForDate(new Date()).filter(b => ['confirmed','arrived','in_service'].includes(b.status)).length} Active
                            </span>
                            <span className="text-[11px] font-bold bg-amber-400/30 text-amber-100 px-2 py-0.5 rounded-full">
                                {getBookingsForDate(new Date()).filter(b => b.status === 'booked').length} Pending
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsQuickRegOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold rounded-lg transition-all border border-white/20"
                        >
                            <UserPlus className="w-3.5 h-3.5" />
                            New Client
                        </button>
                        <Link
                            href="/admin/appointments/book"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-50 transition-all shadow-sm"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Book Now
                        </Link>
                    </div>
                </div>
            </div>

            {/* ── FILTERS ── */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-2.5 flex flex-wrap items-center gap-3 shrink-0">
                <div className="flex items-center gap-1.5 text-gray-400">
                    <Filter className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-bold uppercase tracking-widest">Filter</span>
                </div>
                <div className="relative">
                    <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                    <select
                        className="pl-7 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 min-w-[130px]"
                        value={selectedClinicId}
                        onChange={(e) => { setSelectedClinicId(e.target.value); setSelectedDeptId(''); setSelectedDoctorId(''); }}
                    >
                        <option value="">All Branches</option>
                        <option value="simplybook-import">📋 SimplyBook</option>
                        {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div className="relative">
                    <Stethoscope className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                    <select
                        className="pl-7 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 min-w-[130px]"
                        value={selectedDeptId}
                        onChange={(e) => { setSelectedDeptId(e.target.value); setSelectedDoctorId(''); }}
                    >
                        <option value="">All Categories</option>
                        {deptOptions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                </div>
                <div className="relative">
                    <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                    <select
                        className="pl-7 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 min-w-[130px]"
                        value={selectedDoctorId}
                        onChange={(e) => setSelectedDoctorId(e.target.value)}
                    >
                        <option value="">All Doctors</option>
                        {allDoctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                </div>
                <div className="relative ml-auto">
                    <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search patient…"
                        className="pl-7 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 w-48"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* ── CALENDAR TOOLBAR ── */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-2.5 flex items-center gap-4 shrink-0">
                <div className="flex bg-gray-100 dark:bg-gray-700 p-0.5 rounded-lg">
                    {(['month', 'week', 'day'] as const).map((mode) => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-all ${
                                viewMode === mode
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                            }`}
                        >
                            {mode}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={handlePrevious} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 text-base font-bold transition-colors">‹</button>
                    <span className="text-sm font-bold text-gray-900 dark:text-white min-w-[180px] text-center">
                        {viewMode === 'day' ? format(currentDate, 'EEE, MMM d, yyyy') : format(currentDate, 'MMMM yyyy')}
                        {viewMode === 'week' && ` · ${format(startOfWeek(currentDate), 'd')}–${format(endOfWeek(currentDate), 'd MMM')}`}
                    </span>
                    <button onClick={handleNext} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 text-base font-bold transition-colors">›</button>
                </div>
                <button
                    onClick={handleToday}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 rounded-full hover:bg-indigo-100 transition-colors border border-indigo-200 dark:border-indigo-700"
                >
                    Today
                </button>
                {isLoading && (
                    <span className="text-xs text-gray-400 flex items-center gap-1.5 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
                        Loading…
                    </span>
                )}
                {/* Sync message */}
                {syncMsg && (
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        syncMsg.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                    }`}>{syncMsg.text}</span>
                )}
                {/* Sync button — right-aligned */}
                <button
                    onClick={syncUpcoming}
                    disabled={isSyncing}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-violet-700 bg-violet-50 dark:bg-violet-900/30 dark:text-violet-300 border border-violet-200 dark:border-violet-700 rounded-full hover:bg-violet-100 disabled:opacity-60 transition-colors"
                    title="Sync upcoming appointments from SimplyBook"
                >
                    {isSyncing ? (
                        <><span className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin inline-block" /> Syncing…</>
                    ) : (
                        <><ExternalLink className="w-3 h-3" /> Sync SB</>
                    )}
                </button>
            </div>

            {/* ── MAIN GRID ── */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 overflow-hidden">

                {/* ── CALENDAR ── */}
                <div className="lg:col-span-2 min-h-0 bg-white dark:bg-gray-800 flex flex-col overflow-hidden border-r border-gray-200 dark:border-gray-700">
                    {viewMode !== 'day' && (
                        <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-700 shrink-0">
                            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                                <div key={d} className="py-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">{d}</div>
                            ))}
                        </div>
                    )}

                    <div
                        className={`flex-1 grid gap-px bg-gray-100 dark:bg-gray-700 ${
                            viewMode === 'day'
                                ? 'grid-cols-1 bg-transparent gap-0 overflow-y-auto'
                                : 'grid-cols-7 overflow-hidden'
                        }`}
                        style={viewMode !== 'day' ? { gridAutoRows: '1fr' } : undefined}
                    >
                        {calendarDays.map((day) => {
                            const dayBookings = getBookingsForDate(day);
                            const daySbBookings = getSbBookingsForDate(day);
                            const isSelected = isSameDay(day, selectedDate);
                            const isTodayDate = isToday(day);
                            const isCurrentMonth = isSameMonth(day, currentDate);

                            if (viewMode === 'day') {
                                return (
                                    <div key={day.toISOString()} className="flex flex-col">
                                        {timeSlots.map(slot => {
                                            const slotBookings = dayBookings.filter(b => b.slot === slot);
                                            const isAvailable = slotBookings.length === 0;
                                            return (
                                                <div key={slot} className="flex border-b border-gray-50 dark:border-gray-700/50 group min-h-[44px]">
                                                    <div className="w-20 text-[11px] text-gray-400 font-mono py-2.5 px-3 border-r border-gray-100 dark:border-gray-700 shrink-0 select-none bg-gray-50/60 dark:bg-gray-800/60">
                                                        {slot}
                                                    </div>
                                                    <div className={`flex-1 px-3 py-1.5 ${
                                                        isAvailable ? 'hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 cursor-pointer' : ''
                                                    }`}>
                                                        {isAvailable ? (
                                                            <div className="h-full flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <span className="text-[11px] text-indigo-400 flex items-center gap-1">
                                                                    <Plus className="w-3 h-3" /> Book slot
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            slotBookings.map(b => (
                                                                <div
                                                                    key={b.id}
                                                                    onClick={() => handleEditClick(b)}
                                                                    className={`mb-1 px-2.5 py-1 rounded-md cursor-pointer text-xs border-l-2 ${
                                                                        b.anyDoctor
                                                                            ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/10'
                                                                            : 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-900/15'
                                                                    } hover:opacity-90 transition-opacity`}
                                                                >
                                                                    <span className="font-semibold text-gray-900 dark:text-white">{b.patientName}</span>
                                                                    <span className="text-gray-400 ml-1.5 text-[11px]">· {getServiceName(b)}</span>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            }

                            return (
                                <button
                                    key={day.toISOString()}
                                    onClick={() => setSelectedDate(day)}
                                    className={`bg-white dark:bg-gray-800 p-2 flex flex-col items-start h-full w-full text-left transition-all overflow-hidden
                                        ${ !isCurrentMonth && viewMode === 'month' ? 'opacity-30' : '' }
                                        ${ isSelected ? 'ring-2 ring-inset ring-indigo-500' : '' }
                                        ${ isTodayDate ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50' }
                                    `}
                                >
                                    <span className={`text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1.5 ${
                                        isTodayDate ? 'bg-indigo-600 text-white' : 'text-gray-700 dark:text-gray-300'
                                    }`}>
                                        {format(day, 'd')}
                                    </span>
                                    {(dayBookings.length > 0 || daySbBookings.length > 0) && (
                                        <div className="flex flex-col gap-0.5 w-full">
                                            {dayBookings.length > 0 && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/40 px-1.5 py-0.5 rounded-full w-fit">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" />
                                                    {dayBookings.length}
                                                </span>
                                            )}
                                            {daySbBookings.length > 0 && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/40 px-1.5 py-0.5 rounded-full w-fit">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block" />
                                                    +{daySbBookings.length} SB
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── DAY DETAIL PANEL ── */}
                <div className="min-h-0 bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
                    <div className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
                        <h2 className="text-sm font-bold text-gray-900 dark:text-white">{format(selectedDate, 'EEEE, MMM d')}</h2>
                        <span className="text-xs font-semibold text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                            {selectedDayBookings.length + selectedDaySbBookings.length} appts
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                        {selectedDayBookings.map((booking) => {
                            const statusBorder = ({
                                'booked': 'border-l-blue-400',
                                'confirmed': 'border-l-green-500',
                                'arrived': 'border-l-teal-500',
                                'in_service': 'border-l-purple-500',
                                'completed': 'border-l-emerald-600',
                                'cancelled': 'border-l-red-400',
                                'no_show': 'border-l-red-600',
                                'rescheduled': 'border-l-amber-400',
                            } as Record<string, string>)[booking.status] ?? 'border-l-gray-300';

                            const statusBadge = ({
                                'booked': 'bg-blue-100 text-blue-700',
                                'confirmed': 'bg-green-100 text-green-700',
                                'arrived': 'bg-teal-100 text-teal-700',
                                'in_service': 'bg-purple-100 text-purple-700',
                                'completed': 'bg-emerald-100 text-emerald-700',
                                'cancelled': 'bg-red-100 text-red-600',
                                'no_show': 'bg-red-200 text-red-800',
                                'rescheduled': 'bg-amber-100 text-amber-700',
                            } as Record<string, string>)[booking.status] ?? 'bg-gray-100 text-gray-600';

                            const isSb = (booking as any).source === 'simplybook';

                            return (
                                <div key={booking.id} className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 border-l-4 ${
                                    isSb ? 'border-l-violet-500' : statusBorder
                                } shadow-sm overflow-hidden`}>
                                    <div className="px-3 pt-3 pb-2">
                                        {/* Time + status */}
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-white">
                                                <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                                {booking.slot}
                                                {booking.duration && <span className="text-[11px] font-normal text-gray-400 ml-0.5">{booking.duration}m</span>}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                {isSb && (
                                                    <span className="text-[10px] font-bold bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                                        <ExternalLink className="w-2.5 h-2.5" /> SB
                                                    </span>
                                                )}
                                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${statusBadge}`}>
                                                    {booking.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                        </div>
                                        {/* Patient */}
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <User className="w-3 h-3 text-gray-400 shrink-0" />
                                            <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{booking.patientName}</span>
                                        </div>
                                        {/* Phone */}
                                        {booking.whatsappNumber && (
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <Phone className="w-3 h-3 text-emerald-500 shrink-0" />
                                                <a href={`tel:${booking.whatsappNumber}`} className="text-xs text-emerald-600 hover:underline font-medium">{booking.whatsappNumber}</a>
                                            </div>
                                        )}
                                        {/* Service */}
                                        <div className="flex items-center gap-1.5 mb-1.5">
                                            <Sparkles className="w-3 h-3 text-purple-500 shrink-0" />
                                            <span className="text-xs text-purple-700 dark:text-purple-300 font-medium truncate">{getServiceName(booking)}</span>
                                        </div>
                                        {/* Branch + Doctor */}
                                        <div className="grid grid-cols-2 gap-1 pt-1.5 border-t border-gray-50 dark:border-gray-700 mb-1.5">
                                            <div className="flex items-center gap-1 text-[11px] text-gray-500 min-w-0">
                                                <MapPin className="w-3 h-3 shrink-0" /><span className="truncate">{getClinicName(booking)}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-[11px] text-gray-500 min-w-0">
                                                <Stethoscope className="w-3 h-3 shrink-0" /><span className="truncate">{getDoctorName(booking)}</span>
                                            </div>
                                        </div>
                                        {/* ── Payment Info Block ── */}
                                        <div className="mt-1.5 pt-1.5 border-t border-gray-50 dark:border-gray-700/60 space-y-1">
                                            {(() => {
                                                const sbId     = (booking as any).sbId as string | undefined;
                                                // Merge stored fields with any on-demand fetched data
                                                const fetched  = sbId ? invoiceFetchMap[sbId] : undefined;
                                                const sbProc   = ((booking as any).sbPaymentProcessor  || fetched?.paymentProcessor)  as string | undefined;
                                                const sbAmt    = ((booking as any).sbInvoiceAmount     ?? fetched?.invoiceAmount)      as number | undefined;
                                                const sbCur    = (((booking as any).sbInvoiceCurrency  || fetched?.invoiceCurrency) as string | undefined) || 'AED';
                                                const sbInvNo  = ((booking as any).sbInvoiceNumber     || fetched?.invoiceNumber)      as string | undefined;
                                                const sbStatus = ((booking as any).sbPaymentStatus     || fetched?.paymentStatus)      as string | undefined;
                                                const isStripe = sbProc?.toLowerCase().includes('stripe');
                                                const isFetchingThis = sbId ? !!fetchingInvoices[sbId] : false;
                                                const fetchError = fetched?.error;

                                                /* ── Free Follow-Up ── */
                                                if (booking.isFollowUp) return (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ Free Follow-Up</span>
                                                );

                                                /* ── Package ── */
                                                if (booking.paymentMethod === 'package') return (
                                                    <div className="flex items-center gap-2">
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full"><Package className="w-3 h-3" /> Package</span>
                                                        {booking.packageName && <span className="text-[11px] text-gray-500 truncate">{booking.packageName}</span>}
                                                    </div>
                                                );

                                                /* ── Wallet ── */
                                                if (booking.restrictedDeducted && booking.restrictedDeducted > 0) return (
                                                    <div className="flex items-center gap-2">
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full"><CreditCard className="w-3 h-3" /> Wallet</span>
                                                        <span className="text-sm font-bold text-cyan-700">AED {booking.restrictedDeducted.toFixed(2)}</span>
                                                    </div>
                                                );

                                                /* ── SB Stripe / online paid ── */
                                                if (isSb && sbStatus === 'paid') {
                                                    const appInv = appInvoiceMap[booking.id] || appInvoiceMap[(booking as any).sbId || ''];
                                                    const sbPortalUrl = sbInvNo
                                                        ? `https://firstmedicalcenter.secure.simplybook.it/v2/r#/reports/invoices?filter%5Bnumber%5D=${sbInvNo}`
                                                        : `https://firstmedicalcenter.secure.simplybook.it/v2/r#/reports/invoices`;
                                                    return (
                                                        <div className="space-y-1">
                                                            {/* Amount + processor row */}
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                {isStripe ? (
                                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                                                                        <CreditCard className="w-3 h-3" /> Stripe
                                                                    </span>
                                                                ) : sbProc ? (
                                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                                                                        <CreditCard className="w-3 h-3" /> {sbProc}
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">✓ SB Paid</span>
                                                                )}
                                                                {sbAmt != null && (
                                                                    <span className="text-sm font-bold text-gray-900 dark:text-white">AED {Number(sbAmt).toFixed(2)}</span>
                                                                )}
                                                            </div>
                                                            {/* Invoice number row */}
                                                            {sbInvNo && (
                                                                <div className="flex items-center gap-1.5">
                                                                    <FileText className="w-3 h-3 text-gray-400 shrink-0" />
                                                                    {appInv ? (
                                                                        <a href={`/admin/billing?id=${appInv.id}`}
                                                                            className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-700 px-1.5 py-0.5 rounded hover:bg-emerald-100 transition-colors"
                                                                            title="View in billing module">
                                                                            {appInv.invoiceNumber}
                                                                        </a>
                                                                    ) : (
                                                                        <a href={sbPortalUrl} target="_blank" rel="noopener noreferrer"
                                                                            className="text-[11px] font-mono font-bold text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 border border-violet-300 dark:border-violet-700 px-1.5 py-0.5 rounded hover:bg-violet-100 transition-colors flex items-center gap-1"
                                                                            title="Open invoice in SimplyBook">
                                                                            {sbInvNo} <ExternalLink className="w-2.5 h-2.5" />
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                }

                                                /* ── App online / card payment ── */
                                                if (booking.paymentMethod === 'online' || booking.paymentMethod === 'card') return (
                                                    <div className="flex items-center gap-2">
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full"><CreditCard className="w-3 h-3" /> Online Payment</span>
                                                        {booking.amount != null && (
                                                            <span className="text-sm font-bold text-emerald-700">AED {Number(booking.amount).toFixed(2)}</span>
                                                        )}
                                                    </div>
                                                );

                                                /* ── Pay at clinic (default) ── */
                                                /* For SB bookings with no payment data yet, show Get Invoice # button */
                                                if (isSb && sbId && !booking.isFollowUp && booking.paymentMethod !== 'package') {
                                                    if (isFetchingThis) return (
                                                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-violet-600 animate-pulse">
                                                            <span className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin inline-block" />
                                                            Fetching invoice...
                                                        </span>
                                                    );
                                                    if (fetchError) return (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[11px] text-red-500">{fetchError}</span>
                                                            <button onClick={() => fetchInvoiceForBooking(sbId, booking.date)}
                                                                className="text-[10px] text-violet-600 underline">Retry</button>
                                                        </div>
                                                    );
                                                    return (
                                                        <div className="flex items-center gap-2">
                                                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Pay at Clinic</span>
                                                            <button
                                                                onClick={() => fetchInvoiceForBooking(sbId, booking.date)}
                                                                className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-700 bg-violet-50 border border-violet-300 px-2 py-0.5 rounded-full hover:bg-violet-100 transition-colors"
                                                            >
                                                                🔍 Get Invoice #
                                                            </button>
                                                        </div>
                                                    );
                                                }
                                                return (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Pay at Clinic</span>
                                                );
                                            })()}

                                            {/* Medicine pills */}
                                            {booking.selectedMedicineIds && booking.selectedMedicineIds.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-0.5">
                                                {booking.selectedMedicineIds.map(id => {
                                                const med = medicineCatalog.find(m => m.id === id);
                                                return med ? (
                                                    <span key={id} className="inline-flex items-center gap-0.5 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 text-[10px] px-1.5 py-0.5 rounded-full">
                                                        <Pill className="w-2.5 h-2.5" />{med.name}
                                                    </span>
                                                 ) : null;
                                                 })}
                                                </div>
                                             )}
                                        </div>
                                    </div>
                                    {/* Footer actions */}
                                    <div className="flex border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
                                        <button
                                            onClick={() => handleEditClick(booking)}
                                            disabled={booking.billingStatus === 'billed'}
                                            className={`flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-semibold transition-colors ${
                                                booking.billingStatus === 'billed'
                                                    ? 'text-gray-400 cursor-not-allowed'
                                                    : 'text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                                            }`}
                                        >
                                            {booking.billingStatus === 'billed' ? '🔒 Locked' : '✏️ Edit'}
                                        </button>
                                        {isSb && (booking as any).sbId && (
                                            <>
                                                <div className="w-px bg-gray-100 dark:bg-gray-700" />
                                                <button
                                                    onClick={() => setEditClientModal({ sbId: (booking as any).sbId, name: booking.patientName || '', phone: booking.whatsappNumber || '', email: booking.email || '' })}
                                                    className="flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-semibold text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                                                    title="Edit patient name, phone, email"
                                                >
                                                    <Pencil className="w-3 h-3" /> Edit Info
                                                </button>
                                            </>
                                        )}
                                        {(booking.status === 'completed' || booking.paymentMethod === 'online' || booking.paymentMethod === 'card' || booking.paymentMethod === 'package' || (isSb && (booking as any).sbPaymentStatus === 'paid')) && (() => {
                                            const sbInvNum = (booking as any).sbInvoiceNumber || invoiceFetchMap[(booking as any).sbId || '']?.invoiceNumber;
                                            return (<>
                                                <div className="w-px bg-gray-100 dark:bg-gray-700" />
                                                <button
                                                    onClick={() => { if (booking.billingStatus !== 'billed') handleGenerateReceipt(booking.id, sbInvNum, (booking as any).sbId); }}
                                                    disabled={booking.billingStatus === 'billed'}
                                                    className={`flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-semibold transition-colors ${
                                                        booking.billingStatus === 'billed'
                                                            ? 'text-gray-400 cursor-not-allowed'
                                                            : isSb && (booking as any).sbPaymentStatus === 'paid'
                                                                ? 'text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20'
                                                                : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                                                    }`}
                                                >
                                                    <FileText className="w-3 h-3" />
                                                    {booking.billingStatus === 'billed' ? 'Billed' : 'Receipt'}
                                                    {sbInvNum && booking.billingStatus !== 'billed' && <span className="text-[9px] font-mono opacity-60 ml-0.5">{sbInvNum}</span>}
                                                </button>
                                            </>);
                                        })()}
                                        <div className="w-px bg-gray-100 dark:bg-gray-700" />
                                        <button
                                            onClick={() => { setHistoryBooking(booking); setIsHistoryOpen(true); }}
                                            className="flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                                        >
                                            <History className="w-3 h-3" /> History
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {/* SB-only bookings */}
                        {selectedDaySbBookings.map((sb) => {
                            const fetched = invoiceFetchMap[sb.sbId];
                            const invNum = sb.invoiceNumber || fetched?.invoiceNumber;
                            const proc = sb.paymentProcessor || fetched?.paymentProcessor;
                            const amt = sb.invoiceAmount || fetched?.invoiceAmount;
                            const cur = sb.invoiceCurrency || fetched?.invoiceCurrency || 'AED';
                            const isFetching = fetchingInvoices[sb.sbId];
                            return (
                                <div key={`sb-${sb.sbId}`} className="bg-white dark:bg-gray-800 rounded-xl border border-violet-100 dark:border-violet-800 border-l-4 border-l-violet-500 shadow-sm overflow-hidden">
                                    <div className="px-3 pt-3 pb-2">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-white">
                                                <Clock className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                                                {sb.time || sb.startDateTime.split(' ')[1]?.substring(0,5) || '—'}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-bold bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                                    <ExternalLink className="w-2.5 h-2.5" /> SimplyBook
                                                </span>
                                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                                    sb.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                                    sb.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                                                    sb.status === 'pending'   ? 'bg-amber-100 text-amber-700' :
                                                    'bg-gray-100 text-gray-600'
                                                }`}>{sb.status}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <User className="w-3 h-3 text-gray-400 shrink-0" />
                                            <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{sb.clientName}</span>
                                        </div>
                                        {sb.clientPhone && (
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <Phone className="w-3 h-3 text-emerald-500 shrink-0" />
                                                <span className="text-xs text-gray-500">{sb.clientPhone}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-1.5 mb-1.5">
                                            <Sparkles className="w-3 h-3 text-violet-500 shrink-0" />
                                            <span className="text-xs text-violet-700 dark:text-violet-300 font-medium truncate">{sb.serviceName}</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-[11px] text-gray-500 pt-1.5 border-t border-violet-50 dark:border-violet-800/40">
                                            <Stethoscope className="w-3 h-3 shrink-0" />
                                            <span className="truncate flex-1">{sb.providerName}</span>
                                            <span className="text-[10px] font-mono text-violet-400 shrink-0">SB#{sb.sbId}</span>
                                        </div>
                                        {sb.paymentStatus === 'paid' && (
                                            <div className="mt-2 flex flex-wrap items-center gap-1">
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 px-1.5 py-0.5 rounded-full">
                                                    ✓ SB Paid{proc ? ` via ${proc}` : ''}{amt ? ` · ${amt} ${cur}` : ''}
                                                </span>
                                                {invNum ? (
                                                    <a href={`/admin/billing?bookId=${sb.syncedToBookingsId || ''}&sbRef=${encodeURIComponent(invNum)}&sbId=${sb.sbId}`}
                                                        className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-700 px-1.5 py-0.5 rounded hover:bg-emerald-100 transition-colors"
                                                        title="Click to generate receipt with this invoice number"
                                                    >
                                                        <FileText className="w-2.5 h-2.5" />{invNum}
                                                    </a>
                                                ) : (
                                                    <button
                                                        onClick={() => fetchInvoiceForBooking(sb.sbId, sb.date)}
                                                        disabled={isFetching}
                                                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 border border-violet-300 dark:border-violet-700 px-1.5 py-0.5 rounded hover:bg-violet-100 disabled:opacity-50"
                                                    >
                                                        {isFetching ? '⏳ Fetching...' : '🔍 Get Invoice #'}
                                                    </button>
                                                )}
                                                {fetched?.error && <span className="text-[10px] text-red-500">{fetched.error}</span>}
                                            </div>
                                        )}
                                    </div>
                                    <div className="border-t border-violet-100 dark:border-violet-800/40 bg-violet-50/30 dark:bg-violet-900/10 flex">
                                        <button
                                            onClick={() => setEditClientModal({ sbId: sb.sbId, name: sb.clientName || '', phone: sb.clientPhone || '', email: sb.clientEmail || '' })}
                                            className="flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-semibold text-violet-600 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors border-r border-violet-100 dark:border-violet-800/40"
                                            title="Edit patient name, phone, email"
                                        >
                                            <Pencil className="w-3 h-3" /> Edit Patient Info
                                        </button>
                                        <Link href="/admin/simplybook"
                                            className="flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-semibold text-violet-600 hover:text-violet-800 dark:text-violet-400 transition-colors">
                                            <ExternalLink className="w-3 h-3" /> View in SB
                                        </Link>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Empty state */}
                        {selectedDayBookings.length === 0 && selectedDaySbBookings.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700/50 flex items-center justify-center mb-4">
                                    <Calendar className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                                </div>
                                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">No appointments</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 mb-4">{format(selectedDate, 'MMMM d, yyyy')}</p>
                                <Link href="/admin/appointments/book"
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                                    <Plus className="w-3.5 h-3.5" /> Book Appointment
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── EDIT MODAL ── */}
            {isEditModalOpen && editingBooking && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Edit Appointment</h2>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Patient</label>
                                <div className="p-2.5 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-800 dark:text-gray-200">
                                    {editingBooking.patientName}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Status</label>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2.5 py-1 rounded-lg text-sm font-bold capitalize ${
                                        editForm.status === 'completed' ? 'bg-green-100 text-green-800' :
                                        editForm.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                        'bg-gray-100 text-gray-800'
                                    }`}>
                                        {editForm.status.replace('_', ' ')}
                                    </span>
                                    {getNextStatusOptions(editForm.status).length > 0 && (
                                        <select
                                            className="p-1.5 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600"
                                            onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                                            value=""
                                        >
                                            <option value="" disabled>Change to…</option>
                                            {getNextStatusOptions(editForm.status).map(s => (
                                                <option key={s} value={s}>{s.replace('_', ' ')}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                                {editForm.status === 'completed' && (
                                    <button
                                        onClick={() => editingBooking.billingStatus !== 'billed' && handleGenerateReceipt(editingBooking.id)}
                                        className={`mt-2 text-xs flex items-center gap-1 ${
                                            editingBooking.billingStatus === 'billed' ? 'text-gray-400 cursor-not-allowed' : 'text-indigo-600 hover:underline'
                                        }`}
                                        disabled={editingBooking.billingStatus === 'billed'}
                                    >
                                        <FileText className="w-3 h-3" />
                                        {editingBooking.billingStatus === 'billed' ? 'Invoice Generated' : 'Generate Receipt'}
                                    </button>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Doctor</label>
                                <select
                                    className="w-full p-2.5 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50"
                                    value={editForm.doctorId}
                                    onChange={(e) => setEditForm({ ...editForm, doctorId: e.target.value })}
                                    disabled={editingBooking?.doctorId !== 'sb-unmatched' && editingBooking?.clinicId !== 'simplybook-import' && !canReassignDoctor}
                                >
                                    {(editingBooking?.doctorId === 'sb-unmatched' || editingBooking?.clinicId === 'simplybook-import') && (
                                        <option value="sb-unmatched">— Select a doctor to assign —</option>
                                    )}
                                    {availableDocsForEdit.map(doc => (
                                        <option key={doc.id} value={doc.id}>{doc.name}</option>
                                    ))}
                                </select>
                                {(editingBooking?.doctorId === 'sb-unmatched' || editingBooking?.clinicId === 'simplybook-import') ? (
                                    <p className="text-xs text-violet-600 dark:text-violet-400 mt-1 flex items-center gap-1">
                                        ⚠ SimplyBook provider unmatched — please assign a doctor from the list above.
                                    </p>
                                ) : !canReassignDoctor ? (
                                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">You do not have permission to change the assigned doctor.</p>
                                ) : null}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Duration (mins)</label>
                                <input
                                    type="number" min="15" step="15"
                                    className="w-full p-2.5 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600"
                                    value={editForm.duration}
                                    onChange={(e) => setEditForm({ ...editForm, duration: Number(e.target.value) })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Date</label>
                                    <input type="date"
                                        className="w-full p-2.5 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600"
                                        value={editForm.date}
                                        onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Time Slot</label>
                                    <select
                                        className="w-full p-2.5 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600"
                                        value={editForm.slot}
                                        onChange={(e) => setEditForm({ ...editForm, slot: e.target.value })}
                                        disabled={isLoadingRescheduleSlots}
                                    >
                                        <option value={editingBooking.slot}>{editingBooking.slot} (Current)</option>
                                        {availableToRescheduleSlots
                                            .filter(s => s !== editingBooking.slot)
                                            .map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                            <button
                                onClick={() => { setHistoryBooking(editingBooking); setIsHistoryOpen(true); }}
                                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            >
                                <History className="w-4 h-4" /> View History
                            </button>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveChanges}
                                    className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold transition-colors"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── QUICK CLIENT REGISTRATION MODAL ── */}
            {isQuickRegOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
                        <div className="flex justify-between items-center mb-5">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <UserPlus className="w-5 h-5 text-emerald-600" /> Quick Client Registration
                            </h2>
                            <button onClick={() => setIsQuickRegOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="w-5 h-5" /></button>
                        </div>
                        <p className="text-xs text-gray-500 mb-5 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">Collect essential info now. Remaining details can be filled at the clinic.</p>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">First Name *</label>
                                    <input type="text" placeholder="e.g. Ahmed" required
                                        className="w-full p-2.5 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600"
                                        value={quickForm.firstName} onChange={e => setQuickForm({ ...quickForm, firstName: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Last Name *</label>
                                    <input type="text" placeholder="e.g. Al Rashid" required
                                        className="w-full p-2.5 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600"
                                        value={quickForm.lastName} onChange={e => setQuickForm({ ...quickForm, lastName: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Email ID</label>
                                <input type="email" placeholder="email@example.com"
                                    className="w-full p-2.5 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600"
                                    value={quickForm.email} onChange={e => setQuickForm({ ...quickForm, email: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Phone Number</label>
                                <input type="tel" placeholder="+971 5X XXX XXXX"
                                    className="w-full p-2.5 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600"
                                    value={quickForm.phone} onChange={e => setQuickForm({ ...quickForm, phone: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Gender</label>
                                    <select className="w-full p-2.5 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600"
                                        value={quickForm.gender} onChange={e => setQuickForm({ ...quickForm, gender: e.target.value })}>
                                        <option value="">Select</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Date of Birth</label>
                                    <input type="date" className="w-full p-2.5 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600"
                                        value={quickForm.dateOfBirth} onChange={e => setQuickForm({ ...quickForm, dateOfBirth: e.target.value })} />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                            <button onClick={() => setIsQuickRegOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">Cancel</button>
                            <button onClick={saveQuickClient} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold transition-colors">Register Client</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── HISTORY TIMELINE MODAL ── */}
            {isHistoryOpen && historyBooking && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center mb-5">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <History className="w-5 h-5 text-indigo-600" /> Booking Journey
                            </h2>
                            <button onClick={() => setIsHistoryOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 mb-4">
                            <div className="font-bold text-gray-900 dark:text-white text-sm">{historyBooking.patientName}</div>
                            <div className="text-gray-500 text-xs mt-1">{historyBooking.date} · {historyBooking.slot}</div>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-1">
                            {(historyBooking.statusHistory && historyBooking.statusHistory.length > 0) ? (
                                <div className="relative">
                                    <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-600" />
                                    <div className="space-y-0">
                                        {historyBooking.statusHistory.map((entry, idx) => {
                                            const isFirst = idx === 0;
                                            const isLast = idx === historyBooking.statusHistory!.length - 1;
                                            const dotColor = ({
                                                'booked': 'bg-blue-500',
                                                'confirmed': 'bg-green-500',
                                                'arrived': 'bg-teal-500',
                                                'in_service': 'bg-purple-500',
                                                'completed': 'bg-emerald-600',
                                                'cancelled': 'bg-red-500',
                                                'no_show': 'bg-red-700',
                                                'rescheduled': 'bg-amber-500',
                                            } as Record<string,string>)[entry.newStatus] || 'bg-gray-500';

                                            const badgeColor = ({
                                                'booked': 'bg-blue-100 text-blue-700',
                                                'confirmed': 'bg-green-100 text-green-700',
                                                'arrived': 'bg-teal-100 text-teal-700',
                                                'in_service': 'bg-purple-100 text-purple-700',
                                                'completed': 'bg-emerald-100 text-emerald-700',
                                                'cancelled': 'bg-red-100 text-red-700',
                                                'no_show': 'bg-red-200 text-red-800',
                                                'rescheduled': 'bg-amber-100 text-amber-700',
                                            } as Record<string,string>)[entry.newStatus] || 'bg-gray-100 text-gray-700';

                                            return (
                                                <div key={idx} className="relative flex items-start gap-4 pb-6">
                                                    <div className={`relative z-10 w-[32px] h-[32px] flex items-center justify-center shrink-0 rounded-full border-4 border-white dark:border-gray-800 ${dotColor}`}>
                                                        {isFirst ? <Plus className="w-3.5 h-3.5 text-white" /> : isLast ? <CheckCircle className="w-3.5 h-3.5 text-white" /> : <Clock className="w-3 h-3 text-white" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0 pt-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {isFirst ? (
                                                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${badgeColor}`}>Booking Created</span>
                                                            ) : (
                                                                <>
                                                                    <span className="text-xs text-gray-400 line-through capitalize">{entry.oldStatus.replace('_', ' ')}</span>
                                                                    <span className="text-gray-400">→</span>
                                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold capitalize ${badgeColor}`}>{entry.newStatus.replace('_', ' ')}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                        <div className="text-[11px] text-gray-500 mt-1">
                                                            🕐 {new Date(entry.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                        <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                                                            <User className="w-3 h-3" />
                                                            <span className="font-medium text-gray-700 dark:text-gray-300">{entry.changedBy}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    <History className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                    <p className="text-sm">No status history recorded yet.</p>
                                    <p className="text-xs mt-1">History tracking starts from the next status change.</p>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                            <button
                                onClick={() => setIsHistoryOpen(false)}
                                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 font-medium transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Edit Patient Info Modal (SB records) ── */}
            {editClientModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={() => setEditClientModal(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <Pencil className="w-4 h-4" />
                                <h3 className="font-bold text-base">Edit Patient Info</h3>
                            </div>
                            <button onClick={() => setEditClientModal(false)} className="p-1 hover:bg-white/20 rounded-lg transition-colors text-white"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                SB#{editClientModal.sbId} — changes save locally and do not modify SimplyBook.
                            </p>
                            <div>
                                <label className="flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1"><User className="w-3.5 h-3.5" /> Patient Name</label>
                                <input type="text"
                                    className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                    value={editClientModal.name}
                                    onChange={e => setEditClientModal(prev => prev ? { ...prev, name: e.target.value } : prev)}
                                    placeholder="Full name" />
                            </div>
                            <div>
                                <label className="flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1"><Phone className="w-3.5 h-3.5" /> Phone / WhatsApp</label>
                                <input type="tel"
                                    className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                    value={editClientModal.phone}
                                    onChange={e => setEditClientModal(prev => prev ? { ...prev, phone: e.target.value } : prev)}
                                    placeholder="+971 50 000 0000" />
                            </div>
                            <div>
                                <label className="flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1"><Mail className="w-3.5 h-3.5" /> Email</label>
                                <input type="email"
                                    className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                    value={editClientModal.email}
                                    onChange={e => setEditClientModal(prev => prev ? { ...prev, email: e.target.value } : prev)}
                                    placeholder="patient@email.com" />
                            </div>
                        </div>
                        <div className="px-5 pb-5 flex justify-end gap-3">
                            <button onClick={() => setEditClientModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">Cancel</button>
                            <button
                                onClick={handleSaveClientEdit}
                                disabled={editClientSaving || !editClientModal.name.trim()}
                                className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-2 transition-colors"
                            >
                                {editClientSaving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> : <CheckCircle className="w-4 h-4" />}
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


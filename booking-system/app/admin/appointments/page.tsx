'use client';

import React, { useState, useEffect } from 'react';
import { Clinic, Booking, timeSlots, Medicine } from '@/lib/data';
import { Calendar, Filter, User, MapPin, Stethoscope, Clock, FileText, Plus, Pill, UserPlus, X, History, Sparkles, ExternalLink, Phone, CreditCard, Package, CheckCircle, Pencil, Mail } from 'lucide-react';
import Link from 'next/link';
import type { SimplybookRecord } from '@/lib/simplybook-store';
import {
    format, startOfMonth, endOfMonth, eachDayOfInterval,
    isSameMonth, isSameDay, isToday,
    startOfWeek, endOfWeek, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays
} from 'date-fns';

// --- Helpers for Timeline View ---
const DEPT_COLORS = [
    'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
    'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
    'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
    'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
    'bg-pink-50 text-pink-800 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800',
    'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800',
    'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800',
];

const parseTimeMins = (slotStr: string) => {
    const timePart = slotStr.split(' - ')[0];
    const match12 = timePart.match(/(\d+):(\d+)\s+(AM|PM)/i);
    if (match12) {
        let h = parseInt(match12[1], 10);
        const m = parseInt(match12[2], 10);
        const ampm = match12[3].toUpperCase();
        if (ampm === 'PM' && h !== 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        return h * 60 + m;
    }
    const match24 = timePart.match(/(\d+):(\d+)/);
    if (match24) {
        return parseInt(match24[1], 10) * 60 + parseInt(match24[2], 10);
    }
    return 0;
};

const calculateOverlaps = (bookings: any[]) => {
    const sorted = [...bookings].sort((a, b) => {
        const startA = parseTimeMins(a.slot || a.time || '');
        const startB = parseTimeMins(b.slot || b.time || '');
        return startA - startB;
    });

    const groups: any[][] = [];
    let currentGroup: any[] = [];
    let maxEndTime = 0;

    for (const b of sorted) {
        const start = parseTimeMins(b.slot || b.time || '');
        const duration = b.duration || 30;
        const end = start + duration;

        if (currentGroup.length > 0 && start >= maxEndTime) {
            groups.push(currentGroup);
            currentGroup = [];
            maxEndTime = 0;
        }
        currentGroup.push(b);
        maxEndTime = Math.max(maxEndTime, end);
    }
    if (currentGroup.length > 0) groups.push(currentGroup);

    const positioned = [];
    for (const group of groups) {
        const cols: number[] = [];
        for (const b of group) {
            const start = parseTimeMins(b.slot || b.time || '');
            const duration = b.duration || 30;
            let colIndex = cols.findIndex(colEnd => colEnd <= start);
            if (colIndex === -1) {
                colIndex = cols.length;
                cols.push(start + duration);
            } else {
                cols[colIndex] = start + duration;
            }
            b._colIndex = colIndex;
            positioned.push(b);
        }
        for (const b of group) {
            b._groupCols = cols.length;
        }
    }
    return positioned;
};

export default function AdminAppointmentsPage() {
    const [bookings, setBookings] = useState<Booking[]>([]);

    const [shifts, setShifts] = useState<any[]>([]);
    const [clinicianSchedules, setClinicianSchedules] = useState<any[]>([]);
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

    // HR Shifts


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

    const [calendarWidthPct, setCalendarWidthPct] = useState(66);

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

    // Fetch HR shifts for resource calendar
    useEffect(() => {
        const fetchShifts = async () => {
            if (!selectedClinicId) {
                setShifts([]);
                return;
            }
            try {
                const dateStr = format(selectedDate, 'yyyy-MM-dd');
                const res = await fetch(`/api/admin/hr/shifts?date=${dateStr}&branchId=${selectedClinicId}`);
                if (res.ok) {
                    const data = await res.json();
                    setShifts(Array.isArray(data) ? data : []);
                }
            } catch (err) {
                console.error('Failed to fetch shifts', err);
            }
        };
        fetchShifts();
    }, [selectedClinicId, selectedDate]);

    // Fetch Clinician Schedules
    useEffect(() => {
        const fetchClinicianSchedules = async () => {
            try {
                const dateStr = format(selectedDate, 'yyyy-MM-dd');
                const url = `/api/admin/clinician-schedules?date=${dateStr}` + (selectedClinicId ? `&clinicId=${selectedClinicId}` : '');
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    setClinicianSchedules(Array.isArray(data) ? data : []);
                }
            } catch (err) {
                console.error('Failed to fetch clinician schedules', err);
            }
        };
        fetchClinicianSchedules();
    }, [selectedClinicId, selectedDate]);

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
            const to   = new Date(); to.setDate(to.getDate() + 30); // 30 days ahead
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
                const to   = new Date(); to.setDate(to.getDate() + 30);
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
        return bookings.filter(b => b.date === dateStr && b.status !== 'cancelled');
    };

    const getSbBookingsForDate = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return sbBookings.filter(b => {
            if (b.date !== dateStr || b.status === 'cancelled') return false;
            if (selectedDoctorId && b.matchedDoctorId !== selectedDoctorId) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const matchName = b.clientName?.toLowerCase().includes(q);
                const matchPhone = b.clientPhone?.includes(q);
                const matchEmail = b.clientEmail?.toLowerCase().includes(q);
                if (!matchName && !matchPhone && !matchEmail) return false;
            }
            return true;
        });
    };

    const selectedDayBookings = getBookingsForDate(selectedDate);
    // Exclude SB bookings that have been migrated (already shown in selectedDayBookings)
    const migratedSbIds = new Set(bookings.filter(b => !!b.sbId).map(b => b.sbId as string).filter(Boolean));
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
    const [showJourney, setShowJourney] = useState(false);
    const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
    const [editForm, setEditForm] = useState<{
        status: Booking['status'];
        date: string;
        slot: string;
        clinicId: string;
        serviceId: string;
        doctorId: string;
        duration: number;
        patientName: string;
        whatsappNumber: string;
        email: string;
    }>({ status: 'booked', date: '', slot: '', clinicId: '', serviceId: '', doctorId: '', duration: 30, patientName: '', whatsappNumber: '', email: '' });
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

    const isPastAppointment = () => {
        try {
            if (!editForm.date || !editForm.slot) return false;
            const timeMatch = editForm.slot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
            if (!timeMatch) return false;
            let h = parseInt(timeMatch[1], 10);
            const m = parseInt(timeMatch[2], 10);
            const period = timeMatch[3].toUpperCase();
            if (period === 'PM' && h !== 12) h += 12;
            if (period === 'AM' && h === 12) h = 0;
            
            const aptDate = new Date(`${editForm.date}T${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`);
            return new Date() > aptDate;
        } catch {
            return false;
        }
    };

    const getNextStatusOptions = (currentStatus: Booking['status']) => {
        const pastApt = isPastAppointment();

        const forward: Record<string, Booking['status'][]> = {
            'booked': ['confirmed', 'arrived', 'in_service', 'completed'],
            'confirmed': ['arrived', 'in_service', 'completed'],
            'arrived': ['in_service', 'completed'],
            'in_service': ['completed'],
            'rescheduled': ['confirmed', 'arrived', 'in_service', 'completed'],
            'completed': [],
            'cancelled': [],
            'no_show': []
        };

        let allowed = forward[currentStatus] || [];

        if (['booked', 'confirmed', 'arrived', 'in_service', 'rescheduled'].includes(currentStatus)) {
            if (!pastApt || isSuperAdmin) {
                allowed.push('cancelled', 'rescheduled');
            }
            if (pastApt || isSuperAdmin) {
                allowed.push('no_show');
            }
        }

        return Array.from(new Set(allowed)).filter(s => s !== currentStatus);
    };

    const handleGenerateReceipt = (bookingId: string, sbRef?: string, sbId?: string) => {
        const params = new URLSearchParams({ bookId: bookingId });
        if (sbRef) params.set('sbRef', sbRef);
        if (sbId)  params.set('sbId',  sbId);
        window.location.href = `/admin/billing?${params.toString()}`;
    };

    const handleEditClick = (booking: Booking) => {
        if (booking.billingStatus === 'billed') {
            const confirmed = window.confirm("This appointment has already been billed. Are you sure you want to edit it?");
            if (!confirmed) return;
        }
        setShowJourney(false);
        setEditingBooking(booking);
        setEditForm({
            status: booking.status,
            date: booking.date,
            slot: booking.slot,
            clinicId: booking.clinicId || '',
            serviceId: booking.serviceId || '',
            doctorId: booking.doctorId,
            duration: booking.duration || 30,
            patientName: booking.patientName || '',
            whatsappNumber: booking.whatsappNumber || '',
            email: booking.email || ''
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

    const handleSaveChanges = async (navigateToBilling = false) => {
        if (!editingBooking) return;

        try {
            const res = await fetch(`/api/bookings/${editingBooking.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: editForm.status,
                    date: editForm.date,
                    slot: editForm.slot,
                    clinicId: editForm.clinicId,
                    serviceId: editForm.serviceId,
                    doctorId: editForm.doctorId,
                    duration: editForm.duration,
                    patientName: editForm.patientName,
                    whatsappNumber: editForm.whatsappNumber,
                    email: editForm.email,
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
                
                // Also check if this was a SimplyBook booking and update the SB cache
                const updatedBooking = await res.json();
                if (updatedBooking.sbId && (updatedBooking.patientName || updatedBooking.whatsappNumber || updatedBooking.email)) {
                    await fetch(`/api/admin/simplybook/${updatedBooking.sbId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            clientName: updatedBooking.patientName,
                            clientPhone: updatedBooking.whatsappNumber,
                            clientEmail: updatedBooking.email
                        })
                    }).catch(err => console.warn('Failed to sync to SB:', err));
                }

                setIsEditModalOpen(false);
                fetchBookings(); // Refresh list
                
                if (navigateToBilling === true || (editForm.status === 'completed' && editingBooking.status !== 'completed')) {
                    const sbInvNum = (editingBooking as any).sbInvoiceNumber || invoiceFetchMap[(editingBooking as any).sbId || '']?.invoiceNumber;
                    handleGenerateReceipt(editingBooking.id, sbInvNum, (editingBooking as any).sbId);
                }
            } else {
                alert('Failed to update booking');
            }
        } catch (error) {
            console.error('Update failed', error);
            alert('Error updating booking');
        }
    };

    // ── Drag and Drop Logic ──
    const [draggedBookingId, setDraggedBookingId] = useState<string | null>(null);

    const getDoctorDepartment = (docId: string) => {
        for (const clinic of clinics) {
            for (const dept of clinic.departments) {
                if (dept.doctors.some(d => d.id === docId)) {
                    return dept;
                }
            }
        }
        return null;
    };

    const handleDragStart = (e: React.DragEvent, bookingId: string) => {
        setDraggedBookingId(bookingId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', bookingId);
    };

    const handleDrop = async (e: React.DragEvent, targetDoctorId: string) => {
        e.preventDefault();
        const bookingId = draggedBookingId;
        setDraggedBookingId(null);
        if (!bookingId) return;

        if (bookingId.startsWith('sb-')) {
            alert("Cannot reschedule an unsynced SimplyBook import. Please edit it in SimplyBook or map it first.");
            return;
        }

        const booking = bookings.find(b => b.id === bookingId);
        if (!booking) return;

        // Scope check
        const targetDept = getDoctorDepartment(targetDoctorId);
        if (!targetDept) {
            alert("Error: Doctor's department not found.");
            return;
        }
        
        const offersService = targetDept.services.some(s => s.id === booking.serviceId);
        if (!offersService) {
            alert(`Error: Dr. ${allDoctors.find(d => d.id === targetDoctorId)?.name} (${targetDept.name}) does not perform the scheduled service.`);
            return;
        }

        // Calculate slot based on drop position
        const bounds = e.currentTarget.getBoundingClientRect();
        const offsetY = Math.max(0, e.clientY - bounds.top);
        const ROW_HEIGHT = 44;
        const MIN_PER_ROW = 15;
        const CALENDAR_START_MINUTES = 10 * 60; // 10:00 AM
        
        const droppedMinutes = CALENDAR_START_MINUTES + Math.floor(offsetY / ROW_HEIGHT) * MIN_PER_ROW;
        const hh = Math.floor(droppedMinutes / 60).toString().padStart(2, '0');
        const mm = (droppedMinutes % 60).toString().padStart(2, '0');
        const newSlot = `${hh}:${mm}`;

        if (confirm(`Reschedule appointment to Dr. ${allDoctors.find(d => d.id === targetDoctorId)?.name} at ${newSlot}?`)) {
            try {
                const res = await fetch(`/api/bookings/${bookingId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        doctorId: targetDoctorId,
                        slot: newSlot,
                        staffName: getStaffName(),
                    })
                });
                if (res.ok) {
                    fetchBookings();
                } else {
                    alert('Failed to reschedule');
                }
            } catch {
                alert('Error rescheduling');
            }
        }
    };

    const availableDocsForEdit = (() => {
        if (!editingBooking) return [];

        const clinicIdToUse = editForm.clinicId || editingBooking.clinicId;
        const serviceIdToUse = editForm.serviceId || editingBooking.serviceId;

        const isUnmatched = (editForm.doctorId === 'sb-unmatched' || clinicIdToUse === 'simplybook-import');
        if (isUnmatched) {
            const docsMap = new Map<string, { id: string; name: string }>();
            clinics.forEach(c =>
                c.departments.forEach(d =>
                    (d.doctors || []).forEach(doc => docsMap.set(doc.id, doc))
                )
            );
            return Array.from(docsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        }

        const clinic = clinics.find(c => c.id === clinicIdToUse);
        if (!clinic) return [];

        let docs: any[] = [];
        if (serviceIdToUse) {
            const deptsWithService = clinic.departments.filter(d => 
                d.services && d.services.some(s => s.id === serviceIdToUse)
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
        return docs.sort((a, b) => a.name.localeCompare(b.name));
    })();

    const availableServicesForEdit = (() => {
        if (!editingBooking) return [];
        const clinicIdToUse = editForm.clinicId || editingBooking.clinicId;
        const clinic = clinics.find(c => c.id === clinicIdToUse);
        if (!clinic) return [];
        const servicesMap = new Map();
        clinic.departments.forEach(d => {
            (d.services || []).forEach(s => servicesMap.set(s.id, s));
        });
        return Array.from(servicesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    })();

    const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
    const isCompletedLock = (editingBooking?.status === 'completed' || editForm?.status === 'completed') && !isSuperAdmin;
    const canChangeDetails = (canReassignDoctor || editingBooking?.doctorId === 'sb-unmatched' || editingBooking?.clinicId === 'simplybook-import') && !isCompletedLock;

    // Quick Client Registration
    const [isQuickRegOpen, setIsQuickRegOpen] = useState(false);
    const [quickForm, setQuickForm] = useState({ firstName: '', lastName: '', email: '', phone: '', gender: '', dateOfBirth: '' });

    const saveQuickClient = async () => {
        const fullName = `${quickForm.firstName} ${quickForm.lastName}`.trim();
        if (!fullName) { alert('Please enter first and last name'); return; }
        // Generate a unique ID
        const clientId = `client_${Date.now()}`;
        
        try {
            await fetch('/api/admin/clients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: clientId,
                    name: fullName,
                    firstName: quickForm.firstName,
                    lastName: quickForm.lastName,
                    email: quickForm.email || undefined,
                    mobile: quickForm.phone || undefined,
                    phone: quickForm.phone || undefined,
                    gender: (quickForm.gender as 'Male' | 'Female') || undefined,
                    dateOfBirth: quickForm.dateOfBirth || undefined,
                })
            });
            setIsQuickRegOpen(false);
            setQuickForm({ firstName: '', lastName: '', email: '', phone: '', gender: '', dateOfBirth: '' });
            alert(`Client "${fullName}" registered successfully!\nRemaining details can be filled at the clinic.`);
        } catch (error) {
            console.error('Failed to register client:', error);
            alert('Failed to register client. Please try again.');
        }
    };


    return (
        <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">

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
                                {getBookingsForDate(new Date()).filter(b => b.status !== 'cancelled').length + getSbBookingsForDate(new Date()).filter(b => b.status !== 'cancelled').length} Total
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
                        <Link
                            href="/admin/appointments/cancelled"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold rounded-lg transition-all border border-white/20 mr-1"
                        >
                            <History className="w-3.5 h-3.5" />
                            Cancelled
                        </Link>
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
            <div 
                className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden"
                style={{ '--cal-width': `${calendarWidthPct}%` } as React.CSSProperties}
            >

                {/* ── CALENDAR ── */}
                <div className="min-h-0 bg-white dark:bg-gray-800 flex flex-col overflow-hidden border-r border-gray-200 dark:border-gray-700 w-full lg:w-[var(--cal-width)] shrink-0">
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
                                ? 'grid-cols-1 bg-transparent gap-0 overflow-hidden'
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
                                if (!selectedClinicId || !selectedClinic) {
                                    return (
                                        <div key={day.toISOString()} className="flex-1 flex flex-col items-center justify-center text-gray-500 py-20 bg-gray-50/50 dark:bg-gray-800/20">
                                            <Calendar className="w-12 h-12 mb-4 opacity-30 text-indigo-500" />
                                            <p className="font-semibold text-gray-700 dark:text-gray-300">Please select a branch</p>
                                            <p className="text-sm mt-1">Resource calendar is only available when a specific branch is selected.</p>
                                        </div>
                                    );
                                }
                                
                                const CALENDAR_START_MINUTES = 10 * 60; // 10:00 AM
                                const ROW_HEIGHT = 66; // px
                                const MIN_PER_ROW = 15;

                                const combinedBookings = [
                                    ...dayBookings.map(b => ({
                                        ...b,
                                        isSbOnly: false,
                                        _duration: b.duration || 30,
                                    })),
                                    ...daySbBookings
                                        .filter(sb => !migratedSbIds.has(sb.sbId))
                                        .map(sb => {
                                        let duration = 30;
                                        if (sb.startDateTime && sb.endDateTime) {
                                            const startMs = new Date(sb.startDateTime.replace(' ', 'T')).getTime();
                                            const endMs = new Date(sb.endDateTime.replace(' ', 'T')).getTime();
                                            duration = Math.max(15, (endMs - startMs) / 60000);
                                        }
                                        return {
                                            id: 'sb-' + sb.sbId,
                                            slot: sb.time,
                                            _duration: duration,
                                            patientName: sb.clientName,
                                            deptId: sb.matchedDeptId || '',
                                            doctorId: sb.matchedDoctorId || '',
                                            status: sb.status,
                                            anyDoctor: false,
                                            isSbOnly: true,
                                            _rawSb: sb,
                                        };
                                    })
                                ];

                                // Extract unique doctors from the selected branch
                                const branchDoctors = Array.from(
                                    new Set(selectedClinic.departments.flatMap(d => d.doctors).map(d => d.id))
                                ).map(id => {
                                    const dept = selectedClinic.departments.find(d => d.doctors.some(doc => doc.id === id))!;
                                    return {
                                        ...dept.doctors.find(doc => doc.id === id)!,
                                        departmentName: dept.name
                                    };
                                });

                                return (
                                    <div key={day.toISOString()} className="relative flex min-w-full h-full overflow-x-auto overflow-y-auto">
                                        {/* Time Axis (Sticky Left) */}
                                        <div className="sticky left-0 z-30 h-max bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 w-20 shrink-0 shadow-[4px_0_12px_-6px_rgba(0,0,0,0.1)]">
                                            <div className="sticky top-0 z-40 h-16 border-b-2 border-gray-400 dark:border-gray-600 bg-gray-50 dark:bg-gray-900" /> {/* Header spacer */}
                                            {timeSlots.map(slot => {
                                                const isHour = slot.includes(':00');
                                                const isLastOfHour = slot.includes(':45');
                                                return (
                                                    <div key={slot} className={`h-[66px] text-[11px] font-mono py-2.5 px-3 text-right select-none ${isLastOfHour ? 'border-b-2 border-gray-400 dark:border-gray-600' : 'border-b border-gray-100 dark:border-gray-800'} ${isHour ? 'text-gray-500 font-bold' : 'text-gray-400'}`}>
                                                        {slot}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        
                                        {/* Doctor Columns */}
                                        <div className="flex flex-nowrap min-w-max pb-8 bg-white dark:bg-gray-800">
                                            {branchDoctors.map(doctor => {
                                                const docShifts = shifts.filter(s => s.employeeId === doctor.id);
                                                const hasShift = docShifts.length > 0;
                                                
                                                const doctorBookings = combinedBookings.filter(b => b.doctorId === doctor.id);
                                                const overlapReady = doctorBookings.map(b => ({ ...b, duration: b._duration }));
                                                const positionedBookings = calculateOverlaps(overlapReady);



                                                return (
                                                    <div 
                                                        key={doctor.id} 
                                                        className="w-[165px] h-max shrink-0 border-r border-gray-200 dark:border-gray-700 relative bg-white dark:bg-gray-800"
                                                        onDragOver={(e) => e.preventDefault()}
                                                        onDrop={(e) => handleDrop(e, doctor.id)}
                                                    >
                                                        {/* Doctor Header */}
                                                        <div className="h-16 border-b-2 border-gray-400 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 flex flex-col justify-center items-center sticky top-0 z-20 px-3 text-center shadow-sm">
                                                            <span className="text-sm font-bold text-gray-900 dark:text-white truncate w-full">{doctor.name}</span>
                                                            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide truncate w-full mt-0.5">{doctor.departmentName}</span>
                                                        </div>

                                                        {/* Background Grid & Shading */}
                                                        <div className="relative">
                                                            {timeSlots.map(slot => {
                                                                const mins = parseTimeMins(slot);
                                                                let isAvailable = false;
                                                                const docSchedule = clinicianSchedules.find(s => s.doctorId === doctor.id);
                                                                const hasClinicianSchedule = docSchedule && docSchedule.slots && docSchedule.slots.length > 0;

                                                                if (hasClinicianSchedule) {
                                                                    // Explicit Clinician Schedule overrides HR shifts
                                                                    const slotNormalized = slot.replace(/^0/, '');
                                                                    isAvailable = docSchedule.slots.some((schedSlot: string) => schedSlot.replace(/^0/, '') === slotNormalized);
                                                                } else if (hasShift) {
                                                                    // Fallback to HR Shift logic
                                                                    isAvailable = docShifts.some(s => {
                                                                        const sStart = parseTimeMins(s.startTime);
                                                                        const sEnd = parseTimeMins(s.endTime);
                                                                        return mins >= sStart && mins < sEnd;
                                                                    });
                                                                } else {
                                                                    isAvailable = false; // Off day
                                                                }
                                                                
                                                                const isLastOfHour = slot.includes(':45');

                                                                return (
                                                                    <div 
                                                                        key={slot} 
                                                                        className={`h-[66px] group ${
                                                                            !isAvailable ? 'bg-gray-100 dark:bg-gray-900 bg-stripes pointer-events-none' : 'bg-white dark:bg-gray-800 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 cursor-pointer'
                                                                        } ${isLastOfHour ? 'border-b-2 border-gray-400 dark:border-gray-600' : 'border-b border-gray-100 dark:border-gray-700/50'}`}
                                                                        onClick={() => {
                                                                            if (isAvailable) {
                                                                                const dateStr = format(day, 'yyyy-MM-dd');
                                                                                window.location.href = `/admin/appointments/book?date=${dateStr}&time=${encodeURIComponent(slot)}&doctorId=${doctor.id}&clinicId=${selectedClinicId}`;
                                                                            }
                                                                        }}
                                                                    >
                                                                        <div className="h-full flex items-center opacity-0 group-hover:opacity-100 transition-opacity pl-2">
                                                                            <span className="text-[10px] font-semibold text-indigo-400 flex items-center gap-1">
                                                                                <Plus className="w-3 h-3" /> Book
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}

                                                            {/* Absolute Blocks */}
                                                            <div className="absolute top-0 right-0 bottom-0 left-0 pointer-events-none p-1">
                                                                {positionedBookings.map(b => {
                                                                    const startMins = parseTimeMins(b.slot);
                                                                    const topPx = ((startMins - CALENDAR_START_MINUTES) / MIN_PER_ROW) * ROW_HEIGHT;
                                                                    const heightPx = (b._duration / MIN_PER_ROW) * ROW_HEIGHT;
                                                                    const widthPct = 100 / b._groupCols;
                                                                    const leftPct = (b._colIndex / b._groupCols) * 100;
                                                                    
                                                                    let statusColor = 'bg-gray-100 border-gray-400 text-gray-900 dark:bg-gray-800 dark:text-gray-100'; // Default
                                                                    if (b.status === 'booked') {
                                                                        statusColor = 'bg-yellow-200 border-yellow-500 text-yellow-900 dark:bg-yellow-900/60 dark:border-yellow-600 dark:text-yellow-200';
                                                                    } else if (b.status === 'confirmed') {
                                                                        statusColor = 'bg-blue-200 border-blue-500 text-blue-900 dark:bg-blue-900/60 dark:border-blue-600 dark:text-blue-200';
                                                                    } else if (b.status === 'arrived') {
                                                                        statusColor = 'bg-gray-900 border-black text-white dark:bg-black dark:border-gray-800 dark:text-gray-200';
                                                                    } else if (b.status === 'in_service') {
                                                                        statusColor = 'bg-green-200 border-green-500 text-green-900 dark:bg-green-900/60 dark:border-green-600 dark:text-green-200';
                                                                    } else if (b.status === 'completed') {
                                                                        statusColor = 'bg-[#8B4513] border-[#5C2E0B] text-white dark:bg-[#A0522D] dark:border-[#8B4513]'; // Brown
                                                                    } else if (b.status === 'cancelled') {
                                                                        statusColor = 'bg-red-200 border-red-500 text-red-900 dark:bg-red-900/60 dark:border-red-600 dark:text-red-200';
                                                                    }
                                                                    
                                                                    return (
                                                                        <div
                                                                            key={b.id}
                                                                            className={`absolute p-[1px] pointer-events-auto transition-all z-10`}
                                                                            style={{ top: topPx, height: heightPx, left: `${leftPct}%`, width: `${widthPct}%` }}
                                                                        >
                                                                            <div
                                                                                draggable={!b.isSbOnly}
                                                                                onDragStart={(e) => !b.isSbOnly && handleDragStart(e, b.id)}
                                                                                onClick={() => !b.isSbOnly && handleEditClick(b as any)}
                                                                                className={`h-full w-full rounded-lg border p-1.5 flex flex-col overflow-hidden text-xs cursor-grab active:cursor-grabbing hover:shadow-lg transition-all ${
                                                                                    statusColor
                                                                                } ${b.isSbOnly ? 'border-dashed opacity-80' : ''}`}
                                                                            >
                                                                                <div className="font-bold truncate leading-tight flex justify-between">
                                                                                    <span>{b.patientName}</span>
                                                                                    <span className="opacity-70 text-[10px] ml-1">{b.slot}</span>
                                                                                </div>
                                                                                <div className="text-[10px] opacity-80 truncate mt-0.5 leading-tight">
                                                                                    {b.isSbOnly ? b._rawSb.serviceName : getServiceName(b as any)}
                                                                                </div>
                                                                                <div className="mt-auto flex justify-between items-end">
                                                                                    <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">
                                                                                        {b.status.replace('_', ' ')}
                                                                                    </span>
                                                                                    {b.isSbOnly && (
                                                                                        <span className="text-[9px] font-bold uppercase tracking-wider opacity-60">
                                                                                            SB
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
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

                {/* ── RESIZER ── */}
                <div 
                    className="w-1.5 cursor-col-resize bg-gray-200 dark:bg-gray-700 hover:bg-indigo-400 active:bg-indigo-600 transition-colors hidden lg:block shrink-0 z-30"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        const startX = e.clientX;
                        const startWidth = calendarWidthPct;
                        const onMouseMove = (moveEvent: MouseEvent) => {
                            const deltaX = moveEvent.clientX - startX;
                            const containerWidth = document.body.clientWidth;
                            const deltaPct = (deltaX / containerWidth) * 100;
                            let newWidth = startWidth + deltaPct;
                            if (newWidth < 30) newWidth = 30;
                            if (newWidth > 80) newWidth = 80;
                            setCalendarWidthPct(newWidth);
                        };
                        const onMouseUp = () => {
                            document.removeEventListener('mousemove', onMouseMove);
                            document.removeEventListener('mouseup', onMouseUp);
                        };
                        document.addEventListener('mousemove', onMouseMove);
                        document.addEventListener('mouseup', onMouseUp);
                    }}
                />

                {/* ── DAY DETAIL PANEL ── */}
                <div className="min-h-0 bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden flex-1 shrink-0 min-w-0">
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
                                            className={`flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-semibold transition-colors ${
                                                booking.status === 'completed' && currentUser?.role !== 'SUPER_ADMIN'
                                                    ? 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                                                    : booking.billingStatus === 'billed'
                                                        ? 'text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                                                        : 'text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                                            }`}
                                        >
                                            {booking.status === 'completed' && currentUser?.role !== 'SUPER_ADMIN' ? '🔒 Locked (Completed)' : booking.billingStatus === 'billed' ? '✏️ Edit (Billed)' : '✏️ Edit'}
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
                                        {(booking.status === 'completed' || booking.status === 'arrived' || booking.status === 'in_service' || booking.paymentMethod === 'online' || booking.paymentMethod === 'card' || booking.paymentMethod === 'package' || (isSb && (booking as any).sbPaymentStatus === 'paid')) && (() => {
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
                            <div className="grid grid-cols-1 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Patient Name</label>
                                    <input type="text"
                                        className="w-full p-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-gray-50 dark:disabled:bg-gray-800"
                                        value={editForm.patientName}
                                        onChange={(e) => setEditForm({ ...editForm, patientName: e.target.value })}
                                        required
                                        disabled={isCompletedLock}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Phone (WhatsApp)</label>
                                        <input type="text"
                                            className="w-full p-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-gray-50 dark:disabled:bg-gray-800"
                                            value={editForm.whatsappNumber}
                                            onChange={(e) => setEditForm({ ...editForm, whatsappNumber: e.target.value })}
                                            placeholder="+971501234567"
                                            disabled={isCompletedLock}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Email</label>
                                        <input type="email"
                                            className="w-full p-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-gray-50 dark:disabled:bg-gray-800"
                                            value={editForm.email}
                                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                            placeholder="patient@email.com"
                                            disabled={isCompletedLock}
                                        />
                                    </div>
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
                                        onClick={() => editingBooking.billingStatus !== 'billed' && handleSaveChanges(true)}
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

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Branch</label>
                                    <select
                                        className="w-full p-2.5 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50"
                                        value={editForm.clinicId}
                                        onChange={(e) => setEditForm({ ...editForm, clinicId: e.target.value, doctorId: '', serviceId: '' })}
                                        disabled={!canChangeDetails}
                                    >
                                        <option value="" disabled>Select Branch</option>
                                        <option value="simplybook-import" disabled className="hidden">SimplyBook Import</option>
                                        {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Procedure</label>
                                    <select
                                        className="w-full p-2.5 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50"
                                        value={editForm.serviceId}
                                        onChange={(e) => setEditForm({ ...editForm, serviceId: e.target.value, doctorId: '' })}
                                        disabled={!canChangeDetails || !editForm.clinicId || editForm.clinicId === 'simplybook-import'}
                                    >
                                        <option value="" disabled>Select Procedure</option>
                                        {editForm.serviceId && !availableServicesForEdit.some(s => s.id === editForm.serviceId) && (editingBooking?.sbServiceName || editingBooking?.serviceName) && (
                                            <option value={editForm.serviceId}>{editingBooking.sbServiceName || editingBooking.serviceName}</option>
                                        )}
                                        {availableServicesForEdit.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Doctor</label>
                                    <select
                                        className="w-full p-2.5 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50"
                                        value={editForm.doctorId}
                                        onChange={(e) => setEditForm({ ...editForm, doctorId: e.target.value })}
                                        disabled={!canChangeDetails}
                                    >
                                        {(editingBooking?.doctorId === 'sb-unmatched' || editingBooking?.clinicId === 'simplybook-import') && (
                                            <option value="sb-unmatched">— Select a doctor to assign —</option>
                                        )}
                                        <option value="" disabled>Select Doctor</option>
                                        <option value="any-doctor">
                                            {editingBooking?.sbProviderName && editingBooking.sbProviderName.toLowerCase() !== 'any available doctor' 
                                                ? `Any Doctor (Booked: ${editingBooking.sbProviderName})` 
                                                : 'Any Available Doctor'}
                                        </option>
                                        {editForm.doctorId && editForm.doctorId !== 'any-doctor' && !availableDocsForEdit.some(d => d.id === editForm.doctorId) && editingBooking?.sbProviderName && (
                                            <option value={editForm.doctorId}>{editingBooking.sbProviderName}</option>
                                        )}
                                        {availableDocsForEdit.map(doc => (
                                            <option key={doc.id} value={doc.id}>{doc.name}</option>
                                        ))}
                                    </select>
                                    {(editingBooking?.doctorId === 'sb-unmatched' || editingBooking?.clinicId === 'simplybook-import') ? (
                                        <p className="text-xs text-violet-600 dark:text-violet-400 mt-1 flex items-center gap-1">
                                            ⚠ SimplyBook provider unmatched — please assign a doctor.
                                        </p>
                                    ) : !canReassignDoctor ? (
                                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">You do not have permission to change these details.</p>
                                    ) : null}
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Duration (mins)</label>
                                    <input
                                        type="number" min="15" step="15"
                                        className="w-full p-2.5 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50"
                                        value={editForm.duration}
                                        onChange={(e) => setEditForm({ ...editForm, duration: Number(e.target.value) })}
                                        disabled={!canChangeDetails}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Date</label>
                                    <input type="date"
                                        className="w-full p-2.5 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50 disabled:bg-gray-50 dark:disabled:bg-gray-800"
                                        value={editForm.date}
                                        onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                                        disabled={isCompletedLock}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Time Slot</label>
                                    <select
                                        className="w-full p-2.5 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50 disabled:bg-gray-50 dark:disabled:bg-gray-800"
                                        value={editForm.slot}
                                        onChange={(e) => setEditForm({ ...editForm, slot: e.target.value })}
                                        disabled={isLoadingRescheduleSlots || isCompletedLock}
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
                                    {isCompletedLock ? 'Close' : 'Cancel'}
                                </button>
                                {!isCompletedLock && (
                                    <button
                                        onClick={() => handleSaveChanges(false)}
                                        className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold transition-colors"
                                    >
                                        Save Changes
                                    </button>
                                )}
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
                                            const isEdited = entry.action === 'Appointment Edited';
                                            const dotColor = isEdited ? 'bg-indigo-500' : ({
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
                                                        {isFirst ? <Plus className="w-3.5 h-3.5 text-white" /> : isEdited ? <Pencil className="w-3 h-3 text-white" /> : isLast ? <CheckCircle className="w-3.5 h-3.5 text-white" /> : <Clock className="w-3 h-3 text-white" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0 pt-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {isEdited ? (
                                                                <div className="flex flex-col gap-1 w-full">
                                                                    <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-700 w-fit">
                                                                        Details Edited
                                                                    </span>
                                                                    <span className="text-xs text-gray-600 dark:text-gray-300 font-medium bg-gray-50 dark:bg-gray-700/50 p-2 rounded border border-gray-100 dark:border-gray-700">{entry.details}</span>
                                                                </div>
                                                            ) : isFirst && !entry.action ? (
                                                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${badgeColor}`}>Booking Created</span>
                                                            ) : (
                                                                <>
                                                                    <span className="text-xs text-gray-400 line-through capitalize">{entry.oldStatus.replace('_', ' ')}</span>
                                                                    <span className="text-gray-400">→</span>
                                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold capitalize ${badgeColor}`}>{entry.newStatus.replace('_', ' ')}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                        <div className="text-[11px] text-gray-500 mt-2">
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


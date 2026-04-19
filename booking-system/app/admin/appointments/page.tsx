'use client';

import React, { useState, useEffect } from 'react';
import { Clinic, Booking, timeSlots, Medicine } from '@/lib/data';
import { Calendar, Filter, User, MapPin, Stethoscope, Clock, FileText, Plus, Pill, UserPlus, X, History, Sparkles, ExternalLink } from 'lucide-react';
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

    // Fetch SimplyBook bookings for current month ± 1 week
    useEffect(() => {
        const fetchSbBookings = async () => {
            try {
                const from = new Date();
                from.setMonth(from.getMonth() - 1);
                const to = new Date();
                to.setMonth(to.getMonth() + 2);
                const fmt = (d: Date) => d.toISOString().split('T')[0];
                const res = await fetch(`/api/admin/simplybook?from=${fmt(from)}&to=${fmt(to)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) setSbBookings(data);
                }
            } catch { /* ignore */ }
        };
        fetchSbBookings();
    }, []);

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
    const selectedDaySbBookings = getSbBookingsForDate(selectedDate);

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
        const c = clinics.find(c => c.id === booking.clinicId);
        return c ? c.name : booking.clinicId;
    };

    const getDoctorName = (booking: Booking) => {
        if (booking.anyDoctor) return 'Any Available Doctor';
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

    const handleGenerateReceipt = (bookingId: string) => {
        window.location.href = `/admin/billing?bookId=${bookingId}`;
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
        <div className="p-6 h-full flex flex-col relative">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Calendar className="h-6 w-6 text-indigo-600" />
                    Appointments
                </h1>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsQuickRegOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                        <UserPlus className="w-4 h-4" />
                        New Client
                    </button>
                    <Link
                        href="/admin/appointments/book"
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Book Now
                    </Link>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 flex flex-wrap gap-4 items-end">
                <div className="flex items-center gap-2 text-gray-500 mb-2 w-full sm:w-auto">
                    <Filter className="h-4 w-4" />
                    <span className="text-sm font-medium">Filters</span>
                </div>

                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Clinic Branch</label>
                    <select
                        className="w-full p-2 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600"
                        value={selectedClinicId}
                        onChange={(e) => {
                            setSelectedClinicId(e.target.value);
                            setSelectedDeptId('');
                            setSelectedDoctorId('');
                        }}
                    >
                        <option value="">All Branches</option>
                        {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                    <select
                        className="w-full p-2 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600"
                        value={selectedDeptId}
                        onChange={(e) => {
                            setSelectedDeptId(e.target.value);
                            setSelectedDoctorId('');
                        }}
                    >
                        <option value="">All Categories</option>
                        {deptOptions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                </div>

                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Doctor</label>
                    <select
                        className="w-full p-2 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600"
                        value={selectedDoctorId}
                        onChange={(e) => setSelectedDoctorId(e.target.value)}
                    >
                        <option value="">All Doctors</option>
                        {allDoctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                </div>

                <div className="w-full sm:w-auto">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Search Patient</label>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Name, Phone or Email"
                            className="w-full sm:w-64 p-2 pl-8 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <User className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                {/* View Selector */}
                <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                    {['month', 'week', 'day'].map((mode) => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode as any)}
                            className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-all ${viewMode === mode
                                ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            {mode}
                        </button>
                    ))}
                </div>

                {/* Navigation */}
                <div className="flex items-center gap-4 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                    <button onClick={handlePrevious} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                        &lt;
                    </button>
                    <span className="font-bold min-w-[150px] text-center">
                        {viewMode === 'day' ? format(currentDate, 'MMMM d, yyyy') : format(currentDate, 'MMMM yyyy')}
                        {viewMode === 'week' && ` (Week of ${format(startOfWeek(currentDate), 'd')})`}
                    </span>
                    <button onClick={handleNext} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                        &gt;
                    </button>
                    <button onClick={handleToday} className="text-xs font-medium text-indigo-600 hover:underline ml-2">
                        Today
                    </button>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
                {/* Calendar Grid */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col overflow-auto">

                    {/* Weekday Headers for Month/Week */}
                    {viewMode !== 'day' && (
                        <div className="grid grid-cols-7 gap-2 mb-2 text-center text-sm font-medium text-gray-500">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
                        </div>
                    )}

                    <div className={`grid gap-2 flex-1 ${viewMode === 'day' ? 'grid-cols-1' : 'grid-cols-7'}`}>

                        {calendarDays.map((day) => {
                            const dayBookings = getBookingsForDate(day);
                            const isSelected = isSameDay(day, selectedDate);
                            const isTodayDate = isToday(day);
                            const isCurrentMonth = isSameMonth(day, currentDate);

                            // Day View Layout
                            if (viewMode === 'day') {
                                return (
                                    <div key={day.toISOString()} className="flex flex-col gap-4">
                                        {/* Time Slots for Day View */}
                                        {timeSlots.map(slot => {
                                            const slotBookings = dayBookings.filter(b => b.slot === slot);
                                            const isAvailable = slotBookings.length === 0;

                                            return (
                                                <div key={slot} className="flex gap-4 border-b border-gray-50 dark:border-gray-700 pb-2">
                                                    <div className="w-24 text-sm text-gray-500 font-medium pt-2 shrink-0">{slot}</div>
                                                    <div className={`flex-1 min-h-[50px] rounded-lg p-2 border border-dashed transition-all ${isAvailable
                                                        ? 'bg-gray-50/50 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 cursor-pointer group'
                                                        : 'bg-indigo-50/10 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-800'
                                                        }`}>
                                                        {isAvailable ? (
                                                            <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                                                                    <Plus className="w-3 h-3" /> Book Slot
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            slotBookings.map(b => (
                                                                <div key={b.id} className={`bg-white dark:bg-gray-800 p-2 rounded shadow-sm text-sm border-l-4 mb-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${b.anyDoctor ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-900/10' : 'border-indigo-500'}`} onClick={() => handleEditClick(b)}>
                                                                    <div className="text-[9px] text-gray-400 font-mono mb-1 pb-1 border-b border-gray-100 dark:border-gray-700/50 flex justify-between">
                                                                        <span>#{b.id.slice(0, 8).toUpperCase()}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-start mb-1">
                                                                        <span className="font-bold block text-gray-900 dark:text-white">{b.patientName}</span>
                                                                        <div className="flex flex-col items-end gap-0.5">
                                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize ${b.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                                                                }`}>{b.status}</span>
                                                                            {b.statusHistory && b.statusHistory.length > 0 && (
                                                                                <span className="text-[8px] text-gray-400">
                                                                                    {format(new Date(b.statusHistory[b.statusHistory.length - 1].timestamp), 'h:mm a')}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-1 mt-1 mb-1 text-xs text-purple-700 dark:text-purple-300 font-medium">
                                                                        <Sparkles className="w-3 h-3" />
                                                                        {getServiceName(b)}
                                                                    </div>
                                                                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                                                        <span className="flex items-center gap-1"><Stethoscope className="w-3 h-3" /> {getDoctorName(b)}</span>
                                                                        {b.duration && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {b.duration}m</span>}
                                                                    </div>
                                                                    {b.selectedMedicineIds && b.selectedMedicineIds.length > 0 && (
                                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                                            {b.selectedMedicineIds.map(id => {
                                                                                const med = medicineCatalog.find(m => m.id === id);
                                                                                return med ? (
                                                                                    <span key={id} className="inline-flex items-center gap-0.5 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 text-[10px] px-1.5 py-0.5 rounded-full">
                                                                                        <Pill className="w-2.5 h-2.5" />
                                                                                        {med.name}
                                                                                    </span>
                                                                                ) : null;
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                    {b.status === 'completed' && (
                                                                        <div className="mt-2 text-left">
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); if (b.billingStatus !== 'billed') handleGenerateReceipt(b.id); }}
                                                                                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded border ${b.billingStatus === 'billed' ? 'text-gray-500 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 cursor-not-allowed' : 'text-emerald-600 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800'}`}
                                                                                disabled={b.billingStatus === 'billed'}
                                                                            >
                                                                                <FileText className="w-3 h-3" />
                                                                                {b.billingStatus === 'billed' ? 'Billed' : 'Receipt'}
                                                                            </button>
                                                                        </div>
                                                                    )}
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

                            // Month/Week View Layout
                            return (
                                <button
                                    key={day.toISOString()}
                                    onClick={() => {
                                        setSelectedDate(day);
                                        if (viewMode === 'month') {
                                            // Optional: switch to day view? Or just select.
                                            // Let's just select for now to show details on side.
                                        }
                                    }}
                                    className={`
                                        p-2 rounded-lg border transition-all flex flex-col items-center justify-start min-h-[80px]
                                        ${!isCurrentMonth && viewMode === 'month' ? 'opacity-40 bg-gray-50 dark:bg-gray-900/50' : ''}
                                        ${isSelected ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-500' : 'border-gray-100 dark:border-gray-700 hover:border-gray-300'}
                                        ${isTodayDate ? 'bg-gray-50 dark:bg-gray-700/50' : ''}
                                    `}
                                >
                                    <span className={`text-sm font-medium mb-1 ${isTodayDate ? 'text-indigo-600' : ''}`}>
                                        {format(day, 'd')}
                                    </span>

                                    {(dayBookings.length > 0 || getSbBookingsForDate(day).length > 0) && (
                                        <div className="flex flex-col gap-1 w-full">
                                            <div className="flex items-center gap-1 justify-center flex-wrap">
                                                {dayBookings.length > 0 && (
                                                    <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">
                                                        {dayBookings.length}
                                                    </span>
                                                )}
                                                {getSbBookingsForDate(day).length > 0 && (
                                                    <span className="text-xs font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">
                                                        +{getSbBookingsForDate(day).length}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex gap-0.5 justify-center flex-wrap px-1">
                                                {dayBookings.slice(0, 3).map((b, i) => (
                                                    <div key={i} className={`w-1 h-1 rounded-full ${b.anyDoctor ? 'bg-orange-500' : 'bg-indigo-500'}`} />
                                                ))}
                                                {getSbBookingsForDate(day).slice(0, 3).map((_, i) => (
                                                    <div key={`sb-${i}`} className="w-1 h-1 rounded-full bg-violet-500" />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Day Details (Side Panel) */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col h-full overflow-hidden">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 border-b pb-2 dark:border-gray-700">
                        {format(selectedDate, 'EEEE, MMM d')}
                    </h2>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                        {/* ── Regular bookings ── */}
                        {selectedDayBookings.map((booking) => (
                            <div key={booking.id} className={`p-3 rounded-lg border transition-colors ${booking.anyDoctor ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800 hover:border-orange-400' : 'bg-gray-50 dark:bg-gray-700/30 border-gray-100 dark:border-gray-700 hover:border-indigo-300'}`}>
                                <div className="text-[10px] text-gray-400 font-mono mb-1.5 pb-1.5 border-b border-gray-100 dark:border-gray-700/50 flex justify-between">
                                    <span>#{booking.id.slice(0, 8).toUpperCase()}</span>
                                </div>
                                <div className="flex justify-between items-start mb-2">
                                    <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-indigo-500" />
                                        {booking.slot}
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className={`text-xs px-2 py-1 rounded-full ${booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                            booking.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                                booking.status === 'no_show' ? 'bg-red-200 text-red-800 font-bold' : 'bg-gray-100 text-gray-700'
                                            }`}>
                                            {booking.status}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200 mb-1 font-medium">
                                    <User className="w-3.5 h-3.5 text-gray-400" />
                                    {booking.patientName}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-purple-700 dark:text-purple-300 font-medium mb-1">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    {getServiceName(booking)}
                                </div>
                                <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 flex flex-col gap-1">
                                    <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Branch: {getClinicName(booking)}</div>
                                    <div className="flex items-center gap-1"><Stethoscope className="w-3 h-3" /> {getDoctorName(booking)}</div>
                                </div>
                                <div className="flex gap-2 mt-3 border-t border-gray-100 dark:border-gray-700 pt-3">
                                    <button onClick={() => handleEditClick(booking)}
                                        className={`flex-1 text-center text-xs font-medium ${booking.billingStatus === 'billed' ? 'text-gray-400 cursor-not-allowed' : 'text-indigo-600 hover:underline'}`}
                                        disabled={booking.billingStatus === 'billed'}>
                                        {booking.billingStatus === 'billed' ? 'Locked (Billed)' : 'Edit Booking'}
                                    </button>
                                    {booking.status === 'completed' && (
                                        <button onClick={() => booking.billingStatus !== 'billed' && handleGenerateReceipt(booking.id)}
                                            className={`flex-1 flex items-center justify-center gap-1 text-xs font-bold border-l border-gray-200 dark:border-gray-700 pl-2 ${booking.billingStatus === 'billed' ? 'text-gray-400 cursor-not-allowed' : 'text-emerald-600 hover:text-emerald-700'}`}
                                            disabled={booking.billingStatus === 'billed'}>
                                            <FileText className="w-3.5 h-3.5" />
                                            {booking.billingStatus === 'billed' ? 'Billed' : 'Receipt'}
                                        </button>
                                    )}
                                    <button onClick={() => { setHistoryBooking(booking); setIsHistoryOpen(true); }}
                                        className="flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-indigo-600 font-medium border-l border-gray-200 dark:border-gray-700 pl-2">
                                        <History className="w-3.5 h-3.5" /> History
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* ── SimplyBook bookings ── */}
                        {selectedDaySbBookings.map((sb) => (
                            <div key={`sb-${sb.sbId}`} className="p-3 rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/60 dark:bg-violet-900/10 hover:border-violet-400 transition-colors">
                                <div className="flex justify-between items-center mb-1.5 pb-1.5 border-b border-violet-100 dark:border-violet-800/50">
                                    <span className="text-[10px] font-mono text-violet-400">SB#{sb.sbId}</span>
                                    <span className="text-[10px] font-bold bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                        <ExternalLink className="w-2.5 h-2.5" /> SimplyBook
                                    </span>
                                </div>
                                <div className="flex justify-between items-start mb-2">
                                    <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-violet-500" />
                                        {sb.time || sb.startDateTime.split(' ')[1]?.substring(0,5) || '—'}
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                        sb.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                        sb.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                        sb.status === 'pending'   ? 'bg-amber-100 text-amber-700' :
                                        'bg-gray-100 text-gray-700'}`}>
                                        {sb.status}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200 mb-1 font-medium">
                                    <User className="w-3.5 h-3.5 text-gray-400" />
                                    {sb.clientName}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-violet-700 dark:text-violet-300 font-medium mb-1">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    {sb.serviceName}
                                </div>
                                <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-violet-100 dark:border-violet-800/50 flex flex-col gap-1">
                                    <div className="flex items-center gap-1"><Stethoscope className="w-3 h-3" /> {sb.providerName}</div>
                                    {sb.clientPhone && <div className="flex items-center gap-1"><User className="w-3 h-3" /> {sb.clientPhone}</div>}
                                </div>
                                <div className="mt-2 pt-2 border-t border-violet-100 dark:border-violet-800/50">
                                    <Link href="/admin/simplybook"
                                        className="flex items-center justify-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-medium">
                                        <ExternalLink className="w-3 h-3" /> View in SimplyBook
                                    </Link>
                                </div>
                            </div>
                        ))}

                        {selectedDayBookings.length === 0 && selectedDaySbBookings.length === 0 && (
                            <div className="text-center py-12 text-gray-500">
                                <p>No appointments for this day.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && editingBooking && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-200">
                        <h2 className="text-xl font-bold mb-4">Edit Appointment</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Patient</label>
                                <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 text-sm">
                                    {editingBooking.patientName}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Status</label>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-1 rounded-md text-sm font-bold capitalize ${editForm.status === 'completed' ? 'bg-green-100 text-green-800' :
                                        editForm.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                        {editForm.status.replace('_', ' ')}
                                    </span>

                                    {getNextStatusOptions(editForm.status).length > 0 && (
                                        <select
                                            className="p-1 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600"
                                            onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                                            value=""
                                        >
                                            <option value="" disabled>Change to...</option>
                                            {getNextStatusOptions(editForm.status).map(s => (
                                                <option key={s} value={s}>{s.replace('_', ' ')}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                                {editForm.status === 'completed' && (
                                    <button
                                        onClick={() => editingBooking.billingStatus !== 'billed' && handleGenerateReceipt(editingBooking.id)}
                                        className={`mt-2 text-xs flex items-center gap-1 ${editingBooking.billingStatus === 'billed' ? 'text-gray-400 cursor-not-allowed' : 'text-indigo-600 hover:underline'}`}
                                        disabled={editingBooking.billingStatus === 'billed'}
                                    >
                                        <FileText className="w-3 h-3" />
                                        {editingBooking.billingStatus === 'billed' ? 'Invoice Generated' : 'Generate Receipt'}
                                    </button>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Doctor</label>
                                <select
                                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                                    value={editForm.doctorId}
                                    onChange={(e) => setEditForm({ ...editForm, doctorId: e.target.value })}
                                    disabled={!canReassignDoctor}
                                >
                                    {availableDocsForEdit.map(doc => (
                                        <option key={doc.id} value={doc.id}>{doc.name}</option>
                                    ))}
                                </select>
                                {!canReassignDoctor && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">You do not have permission to change the assigned doctor.</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Duration (mins)</label>
                                <input
                                    type="number"
                                    min="15"
                                    step="15"
                                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                    value={editForm.duration}
                                    onChange={(e) => setEditForm({ ...editForm, duration: Number(e.target.value) })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Date</label>
                                    <input
                                        type="date"
                                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={editForm.date}
                                        onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Time Slot</label>
                                    <select
                                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={editForm.slot}
                                        onChange={(e) => setEditForm({ ...editForm, slot: e.target.value })}
                                        disabled={isLoadingRescheduleSlots}
                                    >
                                        <option value={editingBooking.slot}>{editingBooking.slot} (Current)</option>
                                        {availableToRescheduleSlots
                                            .filter(s => s !== editingBooking.slot) // Don't duplicate current if available
                                            .map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center">
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveChanges}
                                    className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                                >
                                    Save Changes
                                </button>
                            </div>
                            <button
                                onClick={() => { setHistoryBooking(editingBooking); setIsHistoryOpen(true); }}
                                className="mt-6 flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                            >
                                <History className="w-4 h-4" />
                                View History
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Client Registration Modal */}
            {isQuickRegOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
                        <div className="flex justify-between items-center mb-5">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <UserPlus className="w-5 h-5 text-emerald-600" /> Quick Client Registration
                            </h2>
                            <button onClick={() => setIsQuickRegOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                        </div>

                        <p className="text-xs text-gray-500 mb-4 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg">Collect essential info now. Remaining details can be filled at the clinic.</p>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">First Name *</label>
                                    <input type="text" placeholder="e.g. Ahmed" required
                                        className="w-full p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600"
                                        value={quickForm.firstName} onChange={e => setQuickForm({ ...quickForm, firstName: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Last Name *</label>
                                    <input type="text" placeholder="e.g. Al Rashid" required
                                        className="w-full p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600"
                                        value={quickForm.lastName} onChange={e => setQuickForm({ ...quickForm, lastName: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Email ID</label>
                                <input type="email" placeholder="email@example.com"
                                    className="w-full p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600"
                                    value={quickForm.email} onChange={e => setQuickForm({ ...quickForm, email: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Phone Number</label>
                                <input type="tel" placeholder="+971 5X XXX XXXX"
                                    className="w-full p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600"
                                    value={quickForm.phone} onChange={e => setQuickForm({ ...quickForm, phone: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Gender</label>
                                    <select className="w-full p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600"
                                        value={quickForm.gender} onChange={e => setQuickForm({ ...quickForm, gender: e.target.value })}>
                                        <option value="">Select</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date of Birth</label>
                                    <input type="date" className="w-full p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600"
                                        value={quickForm.dateOfBirth} onChange={e => setQuickForm({ ...quickForm, dateOfBirth: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setIsQuickRegOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md">Cancel</button>
                            <button onClick={saveQuickClient} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700">Register Client</button>
                        </div>
                    </div>
                </div>
            )}
            {/* History Timeline Modal */}
            {isHistoryOpen && historyBooking && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center mb-5">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <History className="w-5 h-5 text-indigo-600" />
                                Booking Journey
                            </h2>
                            <button onClick={() => setIsHistoryOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-4 text-sm">
                            <div className="font-bold text-gray-900 dark:text-white">{historyBooking.patientName}</div>
                            <div className="text-gray-500 text-xs mt-1">{historyBooking.date} • {historyBooking.slot}</div>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-1">
                            {(historyBooking.statusHistory && historyBooking.statusHistory.length > 0) ? (
                                <div className="relative">
                                    {/* Timeline line */}
                                    <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-600"></div>

                                    <div className="space-y-0">
                                        {historyBooking.statusHistory.map((entry, idx) => {
                                            const isFirst = idx === 0;
                                            const isLast = idx === historyBooking.statusHistory!.length - 1;
                                            const statusColor = {
                                                'booked': 'bg-blue-500',
                                                'confirmed': 'bg-green-500',
                                                'arrived': 'bg-teal-500',
                                                'in_service': 'bg-purple-500',
                                                'completed': 'bg-emerald-600',
                                                'cancelled': 'bg-red-500',
                                                'no_show': 'bg-red-700',
                                                'rescheduled': 'bg-amber-500',
                                            }[entry.newStatus] || 'bg-gray-500';

                                            const statusBadgeClass = {
                                                'booked': 'bg-blue-100 text-blue-700',
                                                'confirmed': 'bg-green-100 text-green-700',
                                                'arrived': 'bg-teal-100 text-teal-700',
                                                'in_service': 'bg-purple-100 text-purple-700',
                                                'completed': 'bg-emerald-100 text-emerald-700',
                                                'cancelled': 'bg-red-100 text-red-700',
                                                'no_show': 'bg-red-200 text-red-800',
                                                'rescheduled': 'bg-amber-100 text-amber-700',
                                            }[entry.newStatus] || 'bg-gray-100 text-gray-700';

                                            return (
                                                <div key={idx} className="relative flex items-start gap-4 pb-6">
                                                    {/* Dot */}
                                                    <div className={`relative z-10 w-[32px] h-[32px] flex items-center justify-center shrink-0 rounded-full border-4 border-white dark:border-gray-800 ${statusColor}`}>
                                                        {isFirst ? (
                                                            <Plus className="w-3.5 h-3.5 text-white" />
                                                        ) : isLast ? (
                                                            <CheckCircle className="w-3.5 h-3.5 text-white" />
                                                        ) : (
                                                            <Clock className="w-3 h-3 text-white" />
                                                        )}
                                                    </div>

                                                    {/* Content */}
                                                    <div className="flex-1 min-w-0 pt-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {isFirst ? (
                                                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${statusBadgeClass}`}>
                                                                    Booking Created
                                                                </span>
                                                            ) : (
                                                                <>
                                                                    <span className="text-xs text-gray-400 line-through capitalize">
                                                                        {entry.oldStatus.replace('_', ' ')}
                                                                    </span>
                                                                    <span className="text-gray-400">→</span>
                                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold capitalize ${statusBadgeClass}`}>
                                                                        {entry.newStatus.replace('_', ' ')}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                        <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-2">
                                                            <span>🕐 {new Date(entry.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
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
                                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

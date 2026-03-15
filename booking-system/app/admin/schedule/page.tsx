'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { timeSlots, Clinic } from '@/lib/data';
import { Calendar, Save, User, Clock, CalendarOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isToday as isTodayFn } from 'date-fns';

const WEEKDAYS = [
    { value: 0, label: 'Sun', full: 'Sunday' },
    { value: 1, label: 'Mon', full: 'Monday' },
    { value: 2, label: 'Tue', full: 'Tuesday' },
    { value: 3, label: 'Wed', full: 'Wednesday' },
    { value: 4, label: 'Thu', full: 'Thursday' },
    { value: 5, label: 'Fri', full: 'Friday' },
    { value: 6, label: 'Sat', full: 'Saturday' },
];

interface LeaveEntry {
    id: string;
    employeeId: string;
    employeeName: string;
    employeeCode: string;
    designation: string;
    workplaceName: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    reason: string;
    status: string;
}

export default function SchedulePage() {
    const [clinics, setClinics] = useState<Clinic[]>([]);
    const [clinicsLoading, setClinicsLoading] = useState(true);
    const [selectedClinicId, setSelectedClinicId] = useState('');
    const [selectedDoctorId, setSelectedDoctorId] = useState('');
    const [selectedDates, setSelectedDates] = useState<string[]>([new Date().toISOString().split('T')[0]]);
    const [calendarMonth, setCalendarMonth] = useState(new Date());
    // Derived: first/last selected for API calls
    const startDate = selectedDates.length > 0 ? selectedDates.sort()[0] : '';
    const endDate = selectedDates.length > 0 ? selectedDates.sort()[selectedDates.length - 1] : '';
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');

    // Shift time range state
    const [shiftStartTime, setShiftStartTime] = useState('');
    const [shiftEndTime, setShiftEndTime] = useState('');

    // Days Off state
    const [daysOff, setDaysOff] = useState<number[]>([]);
    const [daysOffMessage, setDaysOffMessage] = useState('');

    // Staff on Leave state
    const [staffLeaves, setStaffLeaves] = useState<LeaveEntry[]>([]);
    const [leavesLoading, setLeavesLoading] = useState(false);

    // Cross-branch conflict state
    const [otherBranchSlots, setOtherBranchSlots] = useState<{ clinicId: string; slots: string[] }[]>([]);

    // Fetch live clinic data from API (same source as Doctors page)
    useEffect(() => {
        const fetchClinics = async () => {
            try {
                const res = await fetch('/api/admin/services');
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    setClinics(data);
                    setSelectedClinicId(data[0].id);
                }
            } catch (error) {
                console.error('Failed to fetch clinics', error);
            } finally {
                setClinicsLoading(false);
            }
        };
        fetchClinics();
    }, []);

    // Derived state
    const currentClinic = clinics.find(c => c.id === selectedClinicId);
    const clinicDoctors = currentClinic?.departments.flatMap(d => d.doctors) || [];
    const selectedDoctor = clinicDoctors.find(d => d.id === selectedDoctorId);

    useEffect(() => {
        if (clinicDoctors.length > 0 && !selectedDoctorId) {
            setSelectedDoctorId(clinicDoctors[0].id);
        }
    }, [clinicDoctors, selectedDoctorId]);

    // Load days off when doctor changes
    useEffect(() => {
        if (selectedDoctor) {
            setDaysOff(selectedDoctor.daysOff || []);
        }
    }, [selectedDoctorId, selectedDoctor]);

    // Fetch schedule when doctor, clinic, or START date changes
    useEffect(() => {
        if (!selectedDoctorId || !startDate || !selectedClinicId) return;

        const fetchSchedule = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/admin/schedule?doctorId=${selectedDoctorId}&date=${startDate}&clinicId=${selectedClinicId}&otherBranches=true`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.slots && data.slots.length > 0) {
                        setAvailableSlots(data.slots);
                    } else {
                        setAvailableSlots(timeSlots);
                    }
                    // Store other-branch conflict data
                    setOtherBranchSlots(data.otherBranchSlots || []);
                }
            } catch (error) {
                console.error('Failed to fetch schedule');
            } finally {
                setIsLoading(false);
            }
        };

        fetchSchedule();
    }, [selectedDoctorId, startDate, selectedClinicId]);

    // Fetch staff leaves when date range changes
    useEffect(() => {
        if (!startDate || !endDate) return;

        const fetchLeaves = async () => {
            setLeavesLoading(true);
            try {
                const res = await fetch(`/api/admin/schedule-leave?startDate=${startDate}&endDate=${endDate}`);
                if (res.ok) {
                    const data = await res.json();
                    setStaffLeaves(data.leaves || []);
                }
            } catch {
                console.error('Failed to fetch staff leaves');
            } finally {
                setLeavesLoading(false);
            }
        };

        fetchLeaves();
    }, [startDate, endDate]);

    // Check if selected start date falls on a day off
    const startDayOfWeek = startDate ? new Date(startDate).getDay() : -1;
    const isStartDateDayOff = daysOff.includes(startDayOfWeek);

    const toggleSlot = (slot: string) => {
        setAvailableSlots(prev =>
            prev.includes(slot)
                ? prev.filter(s => s !== slot)
                : [...prev, slot].sort((a, b) => timeSlots.indexOf(a) - timeSlots.indexOf(b))
        );
    };

    // Apply time range — selects all slots between start and end time
    const applyTimeRange = () => {
        if (!shiftStartTime || !shiftEndTime) return;
        const startIdx = timeSlots.indexOf(shiftStartTime);
        const endIdx = timeSlots.indexOf(shiftEndTime);
        if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) return;
        setAvailableSlots(timeSlots.slice(startIdx, endIdx + 1));
    };

    const toggleDayOff = (day: number) => {
        setDaysOff(prev =>
            prev.includes(day)
                ? prev.filter(d => d !== day)
                : [...prev, day].sort()
        );
    };

    const handleSaveDaysOff = async () => {
        setDaysOffMessage('');
        try {
            const res = await fetch('/api/admin/schedule/days-off', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    doctorId: selectedDoctorId,
                    daysOff: daysOff,
                }),
            });

            if (res.ok) {
                setDaysOffMessage('Days off saved!');
            } else {
                if (selectedDoctor) {
                    selectedDoctor.daysOff = daysOff;
                }
                setDaysOffMessage('Days off saved locally!');
            }
            setTimeout(() => setDaysOffMessage(''), 3000);
        } catch {
            if (selectedDoctor) {
                selectedDoctor.daysOff = daysOff;
            }
            setDaysOffMessage('Days off saved locally!');
            setTimeout(() => setDaysOffMessage(''), 3000);
        }
    };

    // Toggle a date in the multi-select calendar
    const toggleDate = (dateStr: string) => {
        setSelectedDates(prev =>
            prev.includes(dateStr)
                ? prev.filter(d => d !== dateStr)
                : [...prev, dateStr].sort()
        );
    };

    // Calendar grid for the current month
    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(calendarMonth);
        const monthEnd = endOfMonth(calendarMonth);
        const gridStart = startOfWeek(monthStart);
        const gridEnd = endOfWeek(monthEnd);
        const days: Date[] = [];
        let day = gridStart;
        while (day <= gridEnd) {
            days.push(day);
            day = addDays(day, 1);
        }
        return days;
    }, [calendarMonth]);

    const handleSave = async () => {
        if (selectedDates.length === 0) {
            setMessage('Please select at least one date.');
            setTimeout(() => setMessage(''), 3000);
            return;
        }
        setIsLoading(true);
        setMessage('');
        try {
            let allSuccess = true;
            let skippedDaysOff = 0;

            for (const dateStr of selectedDates) {
                const dayOfWeek = new Date(dateStr).getDay();

                if (daysOff.includes(dayOfWeek)) {
                    skippedDaysOff++;
                    continue;
                }

                const res = await fetch('/api/admin/schedule', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        doctorId: selectedDoctorId,
                        date: dateStr,
                        slots: availableSlots,
                        clinicId: selectedClinicId
                    })
                });

                if (!res.ok) {
                    allSuccess = false;
                }
            }

            if (allSuccess) {
                const skippedNote = skippedDaysOff > 0 ? ` (${skippedDaysOff} day-off${skippedDaysOff > 1 ? 's' : ''} skipped)` : '';
                setMessage(`Schedule saved for ${selectedDates.length - skippedDaysOff} date(s)!${skippedNote}`);
                setTimeout(() => setMessage(''), 4000);
            } else {
                setMessage('Failed to save for some dates.');
            }
        } catch (error) {
            setMessage('Error saving schedule.');
        } finally {
            setIsLoading(false);
        }
    };

    if (clinicsLoading) return <div className="p-8">Loading schedule data...</div>;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-5xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Clinicians Schedule</h1>
                    <p className="text-gray-600 dark:text-gray-400">Manage clinician availability, shifts, and weekly days off.</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                    {/* Controls Sidebar */}
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Clinic Branch</label>
                                <select
                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent"
                                    value={selectedClinicId}
                                    onChange={(e) => setSelectedClinicId(e.target.value)}
                                >
                                    {clinics.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Doctor</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                    <select
                                        className="w-full pl-10 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent"
                                        value={selectedDoctorId}
                                        onChange={(e) => setSelectedDoctorId(e.target.value)}
                                    >
                                        {clinicDoctors.map(d => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* ── Multi-Select Calendar ── */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Dates</label>
                                <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
                                    {/* Month navigation */}
                                    <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50">
                                        <button onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
                                            <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                                        </button>
                                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                            {format(calendarMonth, 'MMMM yyyy')}
                                        </span>
                                        <button onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
                                            <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                                        </button>
                                    </div>
                                    {/* Weekday headers */}
                                    <div className="grid grid-cols-7 text-center">
                                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                                            <div key={d} className="text-[10px] font-bold text-gray-400 py-1">{d}</div>
                                        ))}
                                    </div>
                                    {/* Day cells */}
                                    <div className="grid grid-cols-7">
                                        {calendarDays.map((day, idx) => {
                                            const dateStr = format(day, 'yyyy-MM-dd');
                                            const inMonth = isSameMonth(day, calendarMonth);
                                            const isSelected = selectedDates.includes(dateStr);
                                            const isDayOff = daysOff.includes(day.getDay());
                                            const isToday = isTodayFn(day);

                                            let cellClass = 'text-gray-300 dark:text-gray-600'; // out-of-month
                                            if (inMonth) {
                                                if (isSelected) {
                                                    cellClass = 'bg-indigo-600 text-white font-bold';
                                                } else if (isDayOff) {
                                                    cellClass = 'bg-red-50 dark:bg-red-900/20 text-red-400 line-through';
                                                } else {
                                                    cellClass = 'text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20';
                                                }
                                            }

                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => inMonth && toggleDate(dateStr)}
                                                    disabled={!inMonth}
                                                    className={`relative w-full aspect-square flex items-center justify-center text-xs transition-all rounded-md m-px ${cellClass}`}
                                                >
                                                    {day.getDate()}
                                                    {isToday && (
                                                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-500 rounded-full" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                {selectedDates.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                        <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                                            {selectedDates.length} date{selectedDates.length > 1 ? 's' : ''} selected
                                        </p>
                                        <div className="flex flex-wrap gap-1">
                                            {selectedDates.map(d => (
                                                <span key={d} className="inline-flex items-center gap-1 text-[10px] bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded">
                                                    {format(new Date(d), 'MMM d')}
                                                    <button onClick={() => toggleDate(d)} className="hover:text-red-500">×</button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Shift Start/End Time */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Shift Time Range</label>
                                <div className="space-y-3">
                                    <div>
                                        <span className="text-xs text-gray-500 mb-1 block">Start Time</span>
                                        <div className="relative">
                                            <Clock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                            <select
                                                className="w-full pl-10 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent text-sm"
                                                value={shiftStartTime}
                                                onChange={(e) => setShiftStartTime(e.target.value)}
                                            >
                                                <option value="">Select start time</option>
                                                {timeSlots.map(slot => (
                                                    <option key={slot} value={slot}>{slot}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-500 mb-1 block">End Time</span>
                                        <div className="relative">
                                            <Clock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                            <select
                                                className="w-full pl-10 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent text-sm"
                                                value={shiftEndTime}
                                                onChange={(e) => setShiftEndTime(e.target.value)}
                                            >
                                                <option value="">Select end time</option>
                                                {timeSlots.filter(slot => !shiftStartTime || timeSlots.indexOf(slot) >= timeSlots.indexOf(shiftStartTime)).map(slot => (
                                                    <option key={slot} value={slot}>{slot}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={applyTimeRange}
                                    disabled={!shiftStartTime || !shiftEndTime}
                                    className="mt-3 w-full flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Clock className="w-3 h-3" />
                                    Apply Time Range
                                </button>
                                {shiftStartTime && shiftEndTime && (
                                    <p className="mt-2 text-xs text-indigo-600 dark:text-indigo-400">
                                        Will select all slots from {shiftStartTime} to {shiftEndTime}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* ── Weekday Day Off ── */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                <CalendarOff className="w-4 h-4 text-red-500" />
                                Weekly Day Off
                            </h3>
                            <p className="text-xs text-gray-500 mb-4">Select recurring days off. Schedule will skip these days automatically.</p>

                            <div className="grid grid-cols-4 gap-2">
                                {WEEKDAYS.map(day => {
                                    const isOff = daysOff.includes(day.value);
                                    return (
                                        <button
                                            key={day.value}
                                            onClick={() => toggleDayOff(day.value)}
                                            title={day.full}
                                            className={`py-2 px-1 rounded-lg text-xs font-bold transition-all border-2 ${isOff
                                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-400 dark:border-red-600'
                                                : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-transparent hover:bg-gray-100 dark:hover:bg-gray-600'
                                                }`}
                                        >
                                            {day.label}
                                        </button>
                                    );
                                })}
                            </div>

                            {daysOff.length > 0 && (
                                <p className="mt-3 text-xs text-red-600 dark:text-red-400">
                                    Off: {daysOff.map(d => WEEKDAYS.find(w => w.value === d)?.full).join(', ')}
                                </p>
                            )}

                            <button
                                onClick={handleSaveDaysOff}
                                className="mt-4 w-full flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                            >
                                <Save className="w-3 h-3" />
                                Save Days Off
                            </button>

                            {daysOffMessage && (
                                <div className="mt-3 p-2 rounded-md text-center text-xs font-medium bg-green-100 text-green-800">
                                    {daysOffMessage}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Time Slots Grid + Staff on Leave */}
                    <div className="md:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-indigo-600" />
                                    Available Slots
                                </h2>
                                <div className="text-sm text-gray-500">
                                    {selectedDates.length > 0 ? `${selectedDates.length} date${selectedDates.length > 1 ? 's' : ''} selected` : 'Select dates from calendar'}
                                </div>
                            </div>

                            {/* Day Off Warning */}
                            {selectedDates.some(d => daysOff.includes(new Date(d).getDay())) && (
                                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg flex items-center gap-2">
                                    <CalendarOff className="w-4 h-4 text-amber-600 shrink-0" />
                                    <p className="text-sm text-amber-700 dark:text-amber-300">
                                        Some selected dates fall on days off and will be <strong>skipped</strong> when saving.
                                    </p>
                                </div>
                            )}

                            {isLoading ? (
                                <div className="flex justify-center py-12">Loading...</div>
                            ) : (
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                    {timeSlots.map(slot => {
                                        const isAvailable = availableSlots.includes(slot);
                                        // Check if this slot is scheduled in another branch
                                        const otherBranch = otherBranchSlots.find(ob => ob.slots.includes(slot));
                                        const otherBranchName = otherBranch ? clinics.find(c => c.id === otherBranch.clinicId)?.name?.replace(' Branch', '') || otherBranch.clinicId : '';
                                        const isOtherBranch = !!otherBranch;

                                        let slotClass = 'bg-gray-100 text-gray-400 border-2 border-transparent hover:bg-gray-200';
                                        if (isAvailable && isOtherBranch) {
                                            // Both current branch AND other branch
                                            slotClass = 'bg-indigo-100 text-indigo-700 border-2 border-indigo-500 ring-2 ring-amber-400';
                                        } else if (isAvailable) {
                                            slotClass = 'bg-indigo-100 text-indigo-700 border-2 border-indigo-500';
                                        } else if (isOtherBranch) {
                                            slotClass = 'bg-amber-100 text-amber-700 border-2 border-amber-400 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-600';
                                        }

                                        return (
                                            <button
                                                key={slot}
                                                onClick={() => toggleSlot(slot)}
                                                title={isOtherBranch ? `Scheduled at ${otherBranchName}` : undefined}
                                                className={`py-2 px-3 rounded-md text-sm font-medium transition-all relative ${slotClass}`}
                                            >
                                                {slot}
                                                {isOtherBranch && (
                                                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border border-white" title={`${otherBranchName}`} />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Color Legend */}
                            {otherBranchSlots.length > 0 && (
                                <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-3 h-3 rounded bg-indigo-100 border-2 border-indigo-500 inline-block" />
                                        This branch
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-3 h-3 rounded bg-amber-100 border-2 border-amber-400 inline-block relative">
                                            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-500 rounded-full" />
                                        </span>
                                        Other branch
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-3 h-3 rounded bg-gray-100 border-2 border-transparent inline-block" />
                                        Not scheduled
                                    </div>
                                </div>
                            )}

                            <div className="mt-8 flex items-center justify-between border-t pt-6 border-gray-100 dark:border-gray-700">
                                <div className="text-sm">
                                    <span className="font-bold text-indigo-600">{availableSlots.length}</span> slots selected
                                </div>
                                <button
                                    onClick={handleSave}
                                    disabled={isLoading}
                                    className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                >
                                    <Save className="w-4 h-4" />
                                    Save Schedule
                                </button>
                            </div>
                            {message && (
                                <div className={`mt-4 p-3 rounded-md text-center text-sm font-medium ${message.includes('success') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {message}
                                </div>
                            )}
                        </div>

                        {/* ── Staff on Leave Panel ── */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                            <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
                                <CalendarOff className="w-5 h-5 text-orange-500" />
                                Staff on Leave
                                <span className="text-xs font-normal text-gray-400 ml-1">(Clinical Department)</span>
                            </h2>
                            <p className="text-xs text-gray-500 mb-4">
                                Employees with approved or pending leave overlapping the selected date range.
                            </p>

                            {leavesLoading ? (
                                <div className="flex justify-center py-8 text-sm text-gray-400">Loading leave data...</div>
                            ) : staffLeaves.length === 0 ? (
                                <div className="text-center py-8">
                                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-50 dark:bg-green-900/20 mb-3">
                                        <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">No staff on leave for this period</p>
                                    <p className="text-xs text-gray-400 mt-1">All clinical staff are available</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {staffLeaves.map((leave) => (
                                        <div
                                            key={leave.id}
                                            className={`p-4 rounded-lg border-l-4 ${leave.status === 'APPROVED'
                                                ? 'border-l-green-500 bg-green-50 dark:bg-green-900/10'
                                                : leave.status === 'PENDING'
                                                    ? 'border-l-amber-500 bg-amber-50 dark:bg-amber-900/10'
                                                    : 'border-l-gray-400 bg-gray-50 dark:bg-gray-700/30'
                                                }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-semibold text-gray-900 dark:text-white text-sm">
                                                            {leave.employeeName}
                                                        </span>
                                                        <span className="text-xs text-gray-400">({leave.employeeCode})</span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">{leave.designation} · {leave.workplaceName}</p>
                                                </div>
                                                <span
                                                    className={`px-2 py-0.5 rounded-full text-xs font-bold ${leave.status === 'APPROVED'
                                                        ? 'bg-green-100 text-green-800 dark:bg-green-800/30 dark:text-green-300'
                                                        : leave.status === 'PENDING'
                                                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-800/30 dark:text-amber-300'
                                                            : 'bg-gray-100 text-gray-600'
                                                        }`}
                                                >
                                                    {leave.status}
                                                </span>
                                            </div>
                                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                                                    {leave.leaveType}
                                                </span>
                                                <span className="text-gray-500 dark:text-gray-400">
                                                    {leave.startDate} → {leave.endDate} ({leave.totalDays} day{leave.totalDays !== 1 ? 's' : ''})
                                                </span>
                                            </div>
                                            {leave.reason && (
                                                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400 italic">
                                                    &ldquo;{leave.reason}&rdquo;
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

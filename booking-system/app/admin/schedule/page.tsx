'use client';

import React, { useState, useEffect } from 'react';
import { clinics, timeSlots } from '@/lib/data';
import { Calendar, Save, User, Clock, CalendarOff } from 'lucide-react';
import { format } from 'date-fns';

const WEEKDAYS = [
    { value: 0, label: 'Sun', full: 'Sunday' },
    { value: 1, label: 'Mon', full: 'Monday' },
    { value: 2, label: 'Tue', full: 'Tuesday' },
    { value: 3, label: 'Wed', full: 'Wednesday' },
    { value: 4, label: 'Thu', full: 'Thursday' },
    { value: 5, label: 'Fri', full: 'Friday' },
    { value: 6, label: 'Sat', full: 'Saturday' },
];

export default function SchedulePage() {
    const [selectedClinicId, setSelectedClinicId] = useState(clinics[0].id);
    const [selectedDoctorId, setSelectedDoctorId] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');

    // Days Off state
    const [daysOff, setDaysOff] = useState<number[]>([]);
    const [daysOffMessage, setDaysOffMessage] = useState('');

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

    // Fetch schedule when doctor or START date changes
    useEffect(() => {
        if (!selectedDoctorId || !startDate) return;

        const fetchSchedule = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/admin/schedule?doctorId=${selectedDoctorId}&date=${startDate}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.slots && data.slots.length > 0) {
                        setAvailableSlots(data.slots);
                    } else {
                        setAvailableSlots(timeSlots);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch schedule');
            } finally {
                setIsLoading(false);
            }
        };

        fetchSchedule();
    }, [selectedDoctorId, startDate]);

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
            // Save days off to the API
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
                // Fallback: update locally on the doctor object
                if (selectedDoctor) {
                    selectedDoctor.daysOff = daysOff;
                }
                setDaysOffMessage('Days off saved locally!');
            }
            setTimeout(() => setDaysOffMessage(''), 3000);
        } catch {
            // Fallback: save locally
            if (selectedDoctor) {
                selectedDoctor.daysOff = daysOff;
            }
            setDaysOffMessage('Days off saved locally!');
            setTimeout(() => setDaysOffMessage(''), 3000);
        }
    };

    const handleSave = async () => {
        setIsLoading(true);
        setMessage('');
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);

            let allSuccess = true;
            let skippedDaysOff = 0;

            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dayOfWeek = d.getDay();

                // Skip days that are marked as days off
                if (daysOff.includes(dayOfWeek)) {
                    skippedDaysOff++;
                    continue;
                }

                const dateStr = d.toISOString().split('T')[0];
                const res = await fetch('/api/admin/schedule', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        doctorId: selectedDoctorId,
                        date: dateStr,
                        slots: availableSlots
                    })
                });

                if (!res.ok) {
                    allSuccess = false;
                }
            }

            if (allSuccess) {
                const skippedNote = skippedDaysOff > 0 ? ` (${skippedDaysOff} day-off${skippedDaysOff > 1 ? 's' : ''} skipped)` : '';
                setMessage(`Schedule saved successfully!${skippedNote}`);
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

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-5xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Staff Scheduling</h1>
                    <p className="text-gray-600 dark:text-gray-400">Manage doctor availability, shifts, and weekly days off.</p>
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

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date Range</label>
                                <div className="space-y-3">
                                    <div>
                                        <span className="text-xs text-gray-500 mb-1 block">Start Date</span>
                                        <div className="relative">
                                            <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                            <input
                                                type="date"
                                                className="w-full pl-10 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent text-sm"
                                                value={startDate}
                                                onChange={(e) => setStartDate(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-500 mb-1 block">End Date</span>
                                        <div className="relative">
                                            <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                            <input
                                                type="date"
                                                className="w-full pl-10 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent text-sm"
                                                value={endDate}
                                                onChange={(e) => setEndDate(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
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

                    {/* Time Slots Grid */}
                    <div className="md:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Clock className="w-5 h-5 text-indigo-600" />
                                Available Slots
                            </h2>
                            <div className="text-sm text-gray-500">
                                {startDate ? format(new Date(startDate), 'MMMM d, yyyy') : 'Select start date'}
                            </div>
                        </div>

                        {/* Day Off Warning */}
                        {isStartDateDayOff && (
                            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg flex items-center gap-2">
                                <CalendarOff className="w-4 h-4 text-amber-600 shrink-0" />
                                <p className="text-sm text-amber-700 dark:text-amber-300">
                                    <strong>{WEEKDAYS[startDayOfWeek]?.full}</strong> is marked as a day off for this doctor.
                                    The schedule will be skipped for this day when saving.
                                </p>
                            </div>
                        )}

                        {isLoading ? (
                            <div className="flex justify-center py-12">Loading...</div>
                        ) : (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                {timeSlots.map(slot => {
                                    const isAvailable = availableSlots.includes(slot);
                                    return (
                                        <button
                                            key={slot}
                                            onClick={() => toggleSlot(slot)}
                                            className={`py-2 px-3 rounded-md text-sm font-medium transition-all ${isAvailable
                                                ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-500'
                                                : 'bg-gray-100 text-gray-400 border-2 border-transparent hover:bg-gray-200'
                                                }`}
                                        >
                                            {slot}
                                        </button>
                                    );
                                })}
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

                </div>
            </div>
        </div>
    );
}

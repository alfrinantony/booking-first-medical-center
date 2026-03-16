'use client';

import React, { useState, useEffect } from 'react';
import { clinics, timeSlots, Booking, Service } from '@/lib/data';
import { Calendar, User, Phone, MapPin, Stethoscope, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminBookingForm() {
    const router = useRouter();
    const [step, setStep] = useState<'details' | 'confirm'>('details');
    const [loading, setLoading] = useState(false);

    // Form State
    const [customer, setCustomer] = useState({ name: '', phone: '' });
    const [booking, setBooking] = useState({
        clinicId: '',
        deptId: '',
        doctorId: '',
        serviceId: '',
        date: '',
        slot: '',
        duration: 30
    });

    // Dynamic slots state
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [isLoadingSlots, setIsLoadingSlots] = useState(false);
    const [slotError, setSlotError] = useState<string | null>(null);

    // Derived State
    const selectedClinic = clinics.find(c => c.id === booking.clinicId);
    const departments = selectedClinic?.departments || [];
    const selectedDept = departments.find(d => d.id === booking.deptId);
    const doctors = selectedDept?.doctors || [];
    const services = selectedDept?.services || [];
    const selectedService = services.find(s => s.id === booking.serviceId);

    const isValid = customer.name && customer.phone && booking.clinicId && booking.deptId && booking.doctorId && booking.serviceId && booking.date && booking.slot;

    // Fetch available slots from schedule API when doctor + date + service are all set
    useEffect(() => {
        if (!booking.doctorId || !booking.date || !booking.serviceId || !booking.clinicId) {
            setAvailableSlots([]);
            return;
        }

        const fetchSlots = async () => {
            setIsLoadingSlots(true);
            setSlotError(null);
            setBooking(prev => ({ ...prev, slot: '' })); // Reset slot

            try {
                const params = new URLSearchParams({
                    doctorId: booking.doctorId,
                    date: booking.date,
                    serviceId: booking.serviceId,
                    clinicId: booking.clinicId,
                });
                const res = await fetch(`/api/admin/schedule?${params.toString()}`);
                if (res.ok) {
                    const data = await res.json();
                    setAvailableSlots(data.slots || []);
                    if (data.slots?.length === 0) {
                        setSlotError('No available slots for this date. The doctor may be fully booked or on leave.');
                    }
                } else {
                    setAvailableSlots(timeSlots); // Fallback
                    setSlotError('Could not fetch smart slots. Showing all slots.');
                }
            } catch {
                setAvailableSlots(timeSlots); // Fallback
                setSlotError('Could not fetch smart slots. Showing all slots.');
            } finally {
                setIsLoadingSlots(false);
            }
        };

        fetchSlots();
    }, [booking.doctorId, booking.date, booking.serviceId, booking.clinicId]);

    // Compute end time for display
    const computeEndTime = (slot: string, duration: number): string => {
        const [time, period] = slot.split(' ');
        let [h, m] = time.split(':').map(Number);
        if (period === 'PM' && h !== 12) h += 12;
        if (period === 'AM' && h === 12) h = 0;
        const endTotalMins = h * 60 + m + duration;
        let endH = Math.floor(endTotalMins / 60);
        const endM = endTotalMins % 60;
        const endPeriod = endH >= 12 ? 'PM' : 'AM';
        if (endH > 12) endH -= 12;
        if (endH === 0) endH = 12;
        return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')} ${endPeriod}`;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/admin/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clinicId: booking.clinicId,
                    deptId: booking.deptId,
                    doctorId: booking.doctorId,
                    serviceId: booking.serviceId,
                    date: booking.date,
                    slot: booking.slot,
                    duration: booking.duration,
                    patientName: customer.name,
                    whatsappNumber: customer.phone,
                }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                if (res.status === 409) {
                    alert(err.error || 'This time slot overlaps with an existing booking.');
                    return;
                }
                throw new Error(err.error || 'Booking failed');
            }

            alert('Appointment Booked Successfully!');
            router.push('/admin/appointments');
        } catch (error: any) {
            console.error(error);
            alert(error.message || 'Failed to book appointment');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-indigo-600" />
                    New Appointment
                </h2>
                <p className="text-sm text-gray-500 mt-1">Book an appointment for a walk-in or phone customer.</p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-8">
                {/* Section 1: Customer Details */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <User className="w-5 h-5 text-gray-400" />
                        Customer Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. John Doe"
                                    className="w-full pl-10 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent"
                                    value={customer.name}
                                    onChange={e => setCustomer({ ...customer, name: e.target.value })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <input
                                    type="tel"
                                    required
                                    placeholder="e.g. +971 50 123 4567"
                                    className="w-full pl-10 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent"
                                    value={customer.phone}
                                    onChange={e => setCustomer({ ...customer, phone: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <hr className="border-gray-100 dark:border-gray-700" />

                {/* Section 2: Appointment Details */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-gray-400" />
                        Appointment Details
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Clinic Branch</label>
                            <select
                                required
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent"
                                value={booking.clinicId}
                                onChange={e => setBooking({ ...booking, clinicId: e.target.value, deptId: '', doctorId: '', serviceId: '', slot: '' })}
                            >
                                <option value="">Select Clinic</option>
                                {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Department</label>
                            <select
                                required
                                disabled={!booking.clinicId}
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent disabled:opacity-50"
                                value={booking.deptId}
                                onChange={e => setBooking({ ...booking, deptId: e.target.value, doctorId: '', serviceId: '', slot: '' })}
                            >
                                <option value="">Select Department</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Service</label>
                            <select
                                required
                                disabled={!booking.deptId}
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent disabled:opacity-50"
                                value={booking.serviceId}
                                onChange={e => {
                                    const svc = services.find(s => s.id === e.target.value);
                                    setBooking({
                                        ...booking,
                                        serviceId: e.target.value,
                                        duration: svc ? svc.duration : 30,
                                        slot: ''
                                    });
                                }}
                            >
                                <option value="">Select Service</option>
                                {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration} min)</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Doctor</label>
                            <select
                                required
                                disabled={!booking.deptId}
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent disabled:opacity-50"
                                value={booking.doctorId}
                                onChange={e => setBooking({ ...booking, doctorId: e.target.value, slot: '' })}
                            >
                                <option value="">Select Doctor</option>
                                {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Duration (mins)
                                {selectedService && <span className="text-xs text-indigo-500 ml-1">(auto-set from service)</span>}
                            </label>
                            <input
                                type="number"
                                required
                                min="15"
                                step="15"
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent"
                                value={booking.duration}
                                onChange={e => setBooking({ ...booking, duration: Number(e.target.value) })}
                            />
                        </div>
                    </div>
                </div>

                <hr className="border-gray-100 dark:border-gray-700" />

                {/* Section 3: Date & Time */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-gray-400" />
                        Date & Time
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                            <input
                                type="date"
                                required
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent"
                                value={booking.date}
                                min={new Date().toISOString().split('T')[0]}
                                onChange={e => setBooking({ ...booking, date: e.target.value, slot: '' })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Time Slot
                                {booking.slot && <span className="text-xs text-indigo-500 ml-1">(ends at {computeEndTime(booking.slot, booking.duration)})</span>}
                            </label>
                            {isLoadingSlots ? (
                                <div className="flex items-center gap-2 p-2 text-sm text-gray-500">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                                    Loading available slots...
                                </div>
                            ) : (
                                <>
                                    <select
                                        required
                                        disabled={availableSlots.length === 0}
                                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent disabled:opacity-50"
                                        value={booking.slot}
                                        onChange={e => setBooking({ ...booking, slot: e.target.value })}
                                    >
                                        <option value="">Select Time Slot</option>
                                        {availableSlots.map(slot => (
                                            <option key={slot} value={slot}>{slot} → {computeEndTime(slot, booking.duration)}</option>
                                        ))}
                                    </select>
                                    {slotError && (
                                        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {slotError}
                                        </div>
                                    )}
                                    {!booking.doctorId || !booking.date || !booking.serviceId ? (
                                        <p className="text-xs text-gray-400 mt-1">Select service, doctor, and date first to see smart slots.</p>
                                    ) : null}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer / Actions */}
                <div className="pt-6 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!isValid || loading}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md shadow-indigo-200 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading ? 'Booking...' : (
                            <>
                                <CheckCircle className="w-4 h-4" />
                                Confirm Booking
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}

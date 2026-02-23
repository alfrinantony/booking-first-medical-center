'use client';

import React, { useState } from 'react';
import { clinics, timeSlots, Booking } from '@/lib/data';
import { Calendar, User, Phone, MapPin, Stethoscope, Clock, CheckCircle } from 'lucide-react';
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
        serviceId: 'consultation', // Default or specific service ID
        date: '',
        slot: '',
        duration: 30 // Default duration in mins
    });

    // Derived State
    const selectedClinic = clinics.find(c => c.id === booking.clinicId);
    const departments = selectedClinic?.departments || [];
    const selectedDept = departments.find(d => d.id === booking.deptId);
    const doctors = selectedDept?.doctors || [];
    const services = selectedDept?.services || [];
    const selectedService = services.find(s => s.id === booking.serviceId);

    const isValid = customer.name && customer.phone && booking.clinicId && booking.deptId && booking.doctorId && booking.date && booking.slot;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Mock API Call
            await new Promise(resolve => setTimeout(resolve, 1000));

            // In a real app, you'd POST to /api/bookings
            // const res = await fetch('/api/bookings', { ... });

            alert('Appointment Booked Successfully!');
            router.push('/admin/appointments');
        } catch (error) {
            console.error(error);
            alert('Failed to book appointment');
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
                                onChange={e => setBooking({ ...booking, clinicId: e.target.value, deptId: '', doctorId: '', serviceId: '' })}
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
                                onChange={e => setBooking({ ...booking, deptId: e.target.value, doctorId: '', serviceId: '' })}
                            >
                                <option value="">Select Department</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Doctor</label>
                            <select
                                required
                                disabled={!booking.deptId}
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent disabled:opacity-50"
                                value={booking.doctorId}
                                onChange={e => setBooking({ ...booking, doctorId: e.target.value })}
                            >
                                <option value="">Select Doctor</option>
                                {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
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
                                        duration: svc ? svc.duration : 30
                                    });
                                }}
                            >
                                <option value="">Select Service</option>
                                {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration} min)</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration (mins)</label>
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
                                onChange={e => setBooking({ ...booking, date: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Time Slot</label>
                            <select
                                required
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent"
                                value={booking.slot}
                                onChange={e => setBooking({ ...booking, slot: e.target.value })}
                            >
                                <option value="">Select Time Slot</option>
                                {timeSlots.map(slot => (
                                    <option key={slot} value={slot}>{slot}</option>
                                ))}
                            </select>
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

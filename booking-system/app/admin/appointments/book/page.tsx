'use client';

import AdminBookingForm from '@/components/admin/AdminBookingForm';

export default function AdminNewBookingPage() {
    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Book New Appointment</h1>
            <AdminBookingForm />
        </div>
    );
}

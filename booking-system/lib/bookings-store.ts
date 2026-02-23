import { Booking } from './data';
import { LogsStore } from './logs-store';
import { MedicineStore, ServicesStore } from './services-store';

let bookings: Booking[] = [
    {
        id: 'book-1',
        clinicId: 'clinic-1',
        deptId: 'c1-Dermatology',
        doctorId: 'Dermatology-doc-0',
        serviceId: 'Dermatology-svc-0',
        date: new Date().toISOString().split('T')[0], // Today
        slot: '10:00 AM',
        patientName: 'John Doe',
        whatsappNumber: '+1234567890',
        status: 'booked',
        confirmationStatus: 'pending',
        createdAt: new Date().toISOString()
    },
    {
        id: 'whatsapp-test',
        clinicId: 'clinic-1',
        deptId: 'c1-Dermatology',
        doctorId: 'Dermatology-doc-1',
        serviceId: 'Dermatology-svc-1',
        date: new Date().toISOString().split('T')[0],
        slot: '02:00 PM',
        patientName: 'Jane Smith',
        whatsappNumber: '+9876543210',
        status: 'confirmed',
        confirmationStatus: 'confirmed',
        createdAt: new Date().toISOString()
    }
];

export const BookingsStore = {
    getAll: () => bookings,

    getByFilters: (filters: { clinicId?: string; deptId?: string; doctorId?: string; date?: string; search?: string }) => {
        return bookings.filter(b => {
            if (filters.clinicId && b.clinicId !== filters.clinicId) return false;
            if (filters.deptId && b.deptId !== filters.deptId) return false;
            if (filters.doctorId && b.doctorId !== filters.doctorId) return false;
            if (filters.date && b.date !== filters.date) return false;

            if (filters.search) {
                const query = filters.search.toLowerCase();
                const matchName = b.patientName.toLowerCase().includes(query);
                const matchPhone = b.whatsappNumber?.includes(query);
                const matchEmail = b.email?.toLowerCase().includes(query);
                if (!matchName && !matchPhone && !matchEmail) return false;
            }

            return true;
        });
    },

    add: (booking: Omit<Booking, 'id' | 'createdAt'>) => {
        const newBooking: Booking = {
            ...booking,
            id: Math.random().toString(36).substr(2, 9),
            createdAt: new Date().toISOString()
        };
        bookings.push(newBooking);

        // Deduct medicine stock from the branch where the booking occurs
        if (newBooking.selectedMedicineIds && newBooking.selectedMedicineIds.length > 0) {
            for (const medId of newBooking.selectedMedicineIds) {
                MedicineStore.deductStock(medId, 1, newBooking.clinicId);
            }
        }

        // Deduct consumable stock from the branch (looked up from the service)
        const allClinics = ServicesStore.getClinics();
        const clinic = allClinics.find((c: { id: string }) => c.id === newBooking.clinicId);
        if (clinic) {
            for (const dept of clinic.departments) {
                const svc = dept.services.find((s: { id: string }) => s.id === newBooking.serviceId);
                if (svc && svc.consumableIds && svc.consumableIds.length > 0) {
                    for (const consumableId of svc.consumableIds) {
                        MedicineStore.deductStock(consumableId, 1, newBooking.clinicId);
                    }
                    break;
                }
            }
        }

        const user = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('adminUser') || '{}') : {};
        LogsStore.add({
            userId: user.id || 'system',
            userName: user.name || 'System',
            action: 'CREATE_BOOKING',
            details: `Created booking for ${newBooking.patientName} on ${newBooking.date}`,
            entityId: newBooking.id,
            entityType: 'Booking'
        });

        return newBooking;
    },

    getById: (id: string) => {
        return bookings.find(b => b.id === id);
    },

    update: (id: string, updates: Partial<Booking>) => {
        const index = bookings.findIndex(b => b.id === id);
        if (index !== -1) {
            bookings[index] = { ...bookings[index], ...updates };

            const user = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('adminUser') || '{}') : {};
            LogsStore.add({
                userId: user.id || 'admin',
                userName: user.name || 'Admin',
                action: 'UPDATE_BOOKING',
                details: `Updated booking ${id}. Changes: ${Object.keys(updates).join(', ')}`,
                entityId: id,
                entityType: 'Booking'
            });

            return bookings[index];
        }
        return null;
    },

    updateStatus: (id: string, status: Booking['status']) => {
        const booking = bookings.find(b => b.id === id);
        if (booking) {
            booking.status = status;

            const user = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('adminUser') || '{}') : {};
            LogsStore.add({
                userId: user.id || 'admin',
                userName: user.name || 'Admin',
                action: 'UPDATE_BOOKING_STATUS',
                details: `Updated booking ${id} status to ${status}`,
                entityId: id,
                entityType: 'Booking'
            });
        }
        return booking;
    }
};

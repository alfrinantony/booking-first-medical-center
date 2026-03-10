import { Booking } from './data';
import { loadFromBlob, saveToBlob } from './blob-persistence';
import { LogsStore } from './logs-store';
import { MedicineStore, ServicesStore } from './services-store';

const INITIAL_BOOKINGS: Booking[] = [];

let bookings: Booking[] = [...INITIAL_BOOKINGS];
let loaded = false;

async function ensureLoaded() {
    if (!loaded) {
        bookings = await loadFromBlob<Booking[]>('bookings', INITIAL_BOOKINGS);
        loaded = true;
    }
}

export const BookingsStore = {
    getAll: async () => {
        await ensureLoaded();
        return bookings;
    },

    getByFilters: async (filters: { clinicId?: string; deptId?: string; doctorId?: string; date?: string; search?: string }) => {
        await ensureLoaded();
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

    add: async (booking: Omit<Booking, 'id' | 'createdAt'>) => {
        await ensureLoaded();
        const newBooking: Booking = {
            ...booking,
            id: Math.random().toString(36).substr(2, 9),
            createdAt: new Date().toISOString()
        };
        bookings.push(newBooking);
        await saveToBlob('bookings', bookings);

        // Deduct medicine stock from the branch where the booking occurs
        if (newBooking.selectedMedicineIds && newBooking.selectedMedicineIds.length > 0) {
            for (const medId of newBooking.selectedMedicineIds) {
                await MedicineStore.deductStock(medId, 1, newBooking.clinicId);
            }
        }

        // Deduct consumable stock from the branch (looked up from the service)
        const allClinics = await ServicesStore.getClinics();
        const clinic = allClinics.find((c: { id: string }) => c.id === newBooking.clinicId);
        if (clinic) {
            for (const dept of clinic.departments) {
                const svc = dept.services.find((s: { id: string }) => s.id === newBooking.serviceId);
                if (svc && svc.consumableIds && svc.consumableIds.length > 0) {
                    for (const consumableId of svc.consumableIds) {
                        await MedicineStore.deductStock(consumableId, 1, newBooking.clinicId);
                    }
                    break;
                }
            }
        }

        const user = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('adminUser') || '{}') : {};
        await LogsStore.add({
            userId: user.id || 'system',
            userName: user.name || 'System',
            action: 'CREATE_BOOKING',
            details: `Created booking for ${newBooking.patientName} on ${newBooking.date}`,
            entityId: newBooking.id,
            entityType: 'Booking'
        });

        return newBooking;
    },

    getById: async (id: string) => {
        await ensureLoaded();
        return bookings.find(b => b.id === id);
    },

    update: async (id: string, updates: Partial<Booking>) => {
        await ensureLoaded();
        const index = bookings.findIndex(b => b.id === id);
        if (index !== -1) {
            bookings[index] = { ...bookings[index], ...updates };
            await saveToBlob('bookings', bookings);

            const user = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('adminUser') || '{}') : {};
            await LogsStore.add({
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

    updateStatus: async (id: string, status: Booking['status']) => {
        await ensureLoaded();
        const booking = bookings.find(b => b.id === id);
        if (booking) {
            booking.status = status;
            await saveToBlob('bookings', bookings);

            const user = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('adminUser') || '{}') : {};
            await LogsStore.add({
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

import { Booking } from './data';
import { BookingsStore } from './bookings-store';
import { LogsStore } from './logs-store';

export interface Client {
    id: string;
    name: string;
    // Personal Info
    firstName?: string;
    middleName?: string;
    lastName?: string;
    mobile?: string;
    whatsapp?: string;
    email?: string;
    gender?: 'Male' | 'Female';
    dateOfBirth?: string; // ISO YYYY-MM-DD
    clientClass?: string;
    civilStatus?: string;
    nationality?: string;
    passportNo?: string;
    emiratesIdNumber?: string;
    emiratesIdIssueDate?: string; // ISO YYYY-MM-DD
    emiratesIdExpiryDate?: string; // ISO YYYY-MM-DD
    // ID Upload
    idFrontBase64?: string;
    idFrontName?: string;
    idBackBase64?: string;
    idBackName?: string;
    // Downloads from UAE ID Card
    firstNameArabic?: string;
    lastNameArabic?: string;
    religion?: string;
    profession?: string;
    country?: string;
    citizenship?: string;
    emirates?: string;
    race?: string;
    residentType?: string;
    poBox?: string;
    city?: string;
    ethnicGroup?: string;
    language?: string;
    address?: string;
    remark?: string;
    // Emergency Contact
    emergencyContactPerson?: string;
    emergencyRelationship?: string;
    emergencyTelephone?: string;
    emergencyWorkMobile?: string;
    // System
    phone?: string; // legacy compat
    bookingIds: string[];
    totalBookings: number;
    lastBookingDate?: string;
}

export const ClientsStore = {
    getAll: (): Client[] => {
        const bookings = BookingsStore.getAll();
        const clientsMap = new Map<string, Client>();

        bookings.forEach(booking => {
            // Identifier priority: Phone -> Email -> Name
            const id = booking.whatsappNumber || booking.email || booking.patientName;

            if (!clientsMap.has(id)) {
                clientsMap.set(id, {
                    id,
                    name: booking.patientName,
                    phone: booking.whatsappNumber,
                    email: booking.email,
                    bookingIds: [],
                    totalBookings: 0,
                    lastBookingDate: ''
                });
            }

            const client = clientsMap.get(id)!;
            client.bookingIds.push(booking.id);
            client.totalBookings++;

            // Update last booking date
            if (!client.lastBookingDate || booking.date > client.lastBookingDate) {
                client.lastBookingDate = booking.date;
            }

            // Enrich missing data if available in newer booking
            if (!client.email && booking.email) client.email = booking.email;
            if (!client.phone && booking.whatsappNumber) client.phone = booking.whatsappNumber;
        });

        return Array.from(clientsMap.values());
    },

    merge: (targetClientId: string, sourceClientId: string) => {
        const bookings = BookingsStore.getAll();
        const sourceBookings = bookings.filter(b => {
            const id = b.whatsappNumber || b.email || b.patientName;
            return id === sourceClientId;
        });

        // Get target details
        const targetClient = ClientsStore.getAll().find(c => c.id === targetClientId);
        if (!targetClient) return false;

        sourceBookings.forEach(booking => {
            // Update booking with target client details
            BookingsStore.update(booking.id, {
                patientName: targetClient.name,
                whatsappNumber: targetClient.phone,
                email: targetClient.email
            });
        });

        const user = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('adminUser') || '{}') : {};
        LogsStore.add({
            userId: user.id || 'admin',
            userName: user.name || 'Admin',
            action: 'MERGE_CLIENTS',
            details: `Merged client ${sourceClientId} into ${targetClientId}`,
            entityId: targetClientId,
            entityType: 'Client'
        });

        return true;
    },

    update: (clientId: string, updates: Partial<Client>) => {
        const bookings = BookingsStore.getAll();
        const clientBookings = bookings.filter(b => {
            const id = b.whatsappNumber || b.email || b.patientName;
            return id === clientId;
        });

        if (clientBookings.length === 0) return false;

        clientBookings.forEach(booking => {
            BookingsStore.update(booking.id, {
                patientName: updates.name || booking.patientName,
                whatsappNumber: updates.phone || booking.whatsappNumber,
                email: updates.email || booking.email
            });
        });

        const user = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('adminUser') || '{}') : {};
        LogsStore.add({
            userId: user.id || 'admin',
            userName: user.name || 'Admin',
            action: 'UPDATE_CLIENT',
            details: `Updated client ${clientId}. Changes: ${Object.keys(updates).join(', ')}`,
            entityId: clientId,
            entityType: 'Client'
        });

        return true;
    }
};

import { Booking } from './data';
import { BookingsStore } from './bookings-store';
import { LogsStore } from './logs-store';
import { loadFromBlob, saveToBlob } from './blob-persistence';

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
    // Client Grouping
    connectedPatients?: { patientPhone: string; relationship: string }[];
    // System
    phone?: string; // legacy compat
    bookingIds: string[];
    totalBookings: number;
    lastBookingDate?: string;
    // Restrictions
    noShowExempt?: boolean;        // Exempt from no-show peak restrictions
    voiceAgentBlocked?: boolean;   // Blocked from voice agent booking
    noShowDates?: string[];        // ISO dates of no-show occurrences
}

// Persistent client metadata (fields not derived from bookings)
let clientMetadata: Record<string, Partial<Client>> = {};
async function ensureMetadataLoaded() {
    
        clientMetadata = await loadFromBlob<Record<string, Partial<Client>>>('client-metadata', {});
        
}

export const ClientsStore = {
    getAll: async (): Promise<Client[]> => {
        const bookings = await BookingsStore.getAll();
        await ensureMetadataLoaded();
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

        // Merge persistent metadata onto booking-derived clients
        const clients = Array.from(clientsMap.values());
        for (const client of clients) {
            const meta = clientMetadata[client.id];
            if (meta) {
                Object.assign(client, meta);
            }
        }

        return clients;
    },

    merge: async (targetClientId: string, sourceClientId: string) => {
        const bookings = await BookingsStore.getAll();
        const sourceBookings = bookings.filter(b => {
            const id = b.whatsappNumber || b.email || b.patientName;
            return id === sourceClientId;
        });

        // Get target details
        const allClients = await ClientsStore.getAll();
        const targetClient = allClients.find(c => c.id === targetClientId);
        if (!targetClient) return false;

        for (const booking of sourceBookings) {
            // Update booking with target client details
            await BookingsStore.update(booking.id, {
                patientName: targetClient.name,
                whatsappNumber: targetClient.phone,
                email: targetClient.email
            });
        }

        const user = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('adminUser') || '{}') : {};
        await LogsStore.add({
            userId: user.id || 'admin',
            userName: user.name || 'Admin',
            action: 'MERGE_CLIENTS',
            details: `Merged client ${sourceClientId} into ${targetClientId}`,
            entityId: targetClientId,
            entityType: 'Client'
        });

        return true;
    },

    update: async (clientId: string, updates: Partial<Client>) => {
        const bookings = await BookingsStore.getAll();
        const clientBookings = bookings.filter(b => {
            const id = b.whatsappNumber || b.email || b.patientName;
            return id === clientId;
        });

        if (clientBookings.length === 0) return false;

        for (const booking of clientBookings) {
            await BookingsStore.update(booking.id, {
                patientName: updates.name || booking.patientName,
                whatsappNumber: updates.phone || booking.whatsappNumber,
                email: updates.email || booking.email
            });
        }

        // Persist extra metadata (fields beyond name/phone/email)
        await ensureMetadataLoaded();
        clientMetadata[clientId] = { ...clientMetadata[clientId], ...updates };
        await saveToBlob('client-metadata', clientMetadata);

        const user = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('adminUser') || '{}') : {};
        await LogsStore.add({
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

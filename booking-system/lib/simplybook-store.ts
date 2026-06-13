/**
 * SimplyBook Bookings Store
 * Persists webhook-received SimplyBook bookings in Azure Blob Storage.
 * Pattern mirrors bookings-store.ts
 */
import { loadFromBlob, saveToBlob } from './blob-persistence';

export interface SimplybookRecord {
    // SimplyBook identifiers
    sbId: string;           // booking_id from webhook
    sbHash: string;         // booking_hash from webhook
    company: string;

    // Booking details (fetched from API)
    startDateTime: string;  // "2026-04-18 10:00:00"
    endDateTime: string;
    date: string;           // "2026-04-18"
    time: string;           // "10:00"

    // Service & provider
    eventId: string;
    unitId: string;
    serviceName: string;
    providerName: string;

    // Client info
    clientId: string;
    clientName: string;
    clientEmail: string;
    clientPhone: string;

    // Status tracking
    status: 'confirmed' | 'cancelled' | 'pending' | 'noshow' | 'unknown';
    notificationType: string; // raw: create | change | cancel | notify

    // Doctor matching — set during sync
    matchStatus: 'matched' | 'unmatched' | 'pending';
    matchedDoctorId?: string;   // Doctor.id in app
    matchedClinicId?: string;   // Clinic.id in app
    matchedDeptId?: string;     // Department.id in app
    syncedToBookingsId?: string; // Booking.id written to BookingsStore

    // Meta
    receivedAt: string;      // ISO timestamp when we received the webhook
    updatedAt: string;

    // ── Payment / Invoice fields (from SimplyBook getInvoiceList) ──
    invoiceId?: string;             // SimplyBook invoice numeric ID
    invoiceNumber?: string;         // Formatted invoice number e.g. "SI-2026000362"
    invoiceAmount?: number;         // Total invoice amount
    paidAmount?: number;            // Amount actually paid
    invoiceCurrency?: string;       // e.g. "AED"
    paymentStatus?: 'paid' | 'unpaid' | 'partial' | 'pending' | 'new'; // Payment state
    paymentType?: 'online' | 'offline';  // How it was paid
    paymentProcessor?: string;      // e.g. "Stripe", "PayPal", "manual"
    paymentDate?: string;           // ISO datetime of payment


    // Raw snapshot from SimplyBook
    raw?: Record<string, unknown>;
}

const BLOB_KEY = 'simplybook-bookings';
const INITIAL: SimplybookRecord[] = [];

let records: SimplybookRecord[] = [];
let loaded = false;

async function ensureLoaded() {
    if (!loaded) {
        records = await loadFromBlob<SimplybookRecord[]>(BLOB_KEY, INITIAL);
        loaded = true;
    }
}

function invalidateCache() {
    loaded = false;
}

export const SimplybookStore = {
    getAll: async (): Promise<SimplybookRecord[]> => {
        await ensureLoaded();
        return [...records].sort((a, b) =>
            new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime()
        );
    },

    getByDateRange: async (from: string, to: string): Promise<SimplybookRecord[]> => {
        await ensureLoaded();
        return records
            .filter(r => r.date >= from && r.date <= to)
            .sort((a, b) => new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime());
    },

    getByDate: async (date: string): Promise<SimplybookRecord[]> => {
        await ensureLoaded();
        return records
            .filter(r => r.date === date)
            .sort((a, b) => a.time.localeCompare(b.time));
    },

    getById: async (sbId: string): Promise<SimplybookRecord | undefined> => {
        await ensureLoaded();
        return records.find(r => r.sbId === sbId);
    },

    /**
     * Upsert a booking record (insert or update based on sbId).
     */
    upsert: async (record: SimplybookRecord): Promise<SimplybookRecord> => {
        await ensureLoaded();
        const idx = records.findIndex(r => r.sbId === record.sbId);
        if (idx >= 0) {
            records[idx] = { ...records[idx], ...record, updatedAt: new Date().toISOString() };
        } else {
            records.push({ ...record, receivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        }
        await saveToBlob(BLOB_KEY, records);
        return idx >= 0 ? records[idx] : records[records.length - 1];
    },

    /**
     * Batch upsert many records and save once — much faster than calling upsert() N times.
     * Each call to upsert() saves the whole blob; this does it in ONE write.
     */
    upsertMany: async (incoming: SimplybookRecord[]): Promise<void> => {
        await ensureLoaded();
        const now = new Date().toISOString();
        for (const record of incoming) {
            const idx = records.findIndex(r => r.sbId === record.sbId);
            if (idx >= 0) {
                records[idx] = { ...records[idx], ...record, updatedAt: now };
            } else {
                records.push({ ...record, receivedAt: now, updatedAt: now });
            }
        }
        await saveToBlob(BLOB_KEY, records);  // ONE save for all records
    },

    /**
     * Mark a booking as cancelled.
     */
    cancel: async (sbId: string): Promise<void> => {
        await ensureLoaded();
        const idx = records.findIndex(r => r.sbId === sbId);
        if (idx >= 0) {
            records[idx].status = 'cancelled';
            records[idx].updatedAt = new Date().toISOString();
            await saveToBlob(BLOB_KEY, records);
        }
    },

    /**
     * Get summary stats for a given date.
     */
    getStats: async (date?: string): Promise<{
        total: number; confirmed: number; cancelled: number; pending: number;
    }> => {
        await ensureLoaded();
        const subset = date ? records.filter(r => r.date === date) : records;
        return {
            total: subset.filter(r => r.status !== 'cancelled').length,
            confirmed: subset.filter(r => r.status === 'confirmed').length,
            cancelled: subset.filter(r => r.status === 'cancelled').length,
            pending: subset.filter(r => r.status === 'pending').length,
        };
    },
};

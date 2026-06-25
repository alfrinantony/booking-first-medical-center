import { Booking } from './data';
import { BookingsStore } from './bookings-store';
import { LogsStore } from './logs-store';
import { loadFromBlob, saveToBlob } from './blob-persistence';
import { PrismaClient } from '@prisma/client';

let dbUrl = process.env.DATABASE_URL || '';
if (dbUrl.includes(':6543')) {
    dbUrl = dbUrl.replace(':6543', ':5432').replace('?pgbouncer=true', '').replace('&pgbouncer=true', '');
}
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: dbUrl
        }
    }
});

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
    // Migration tracking
    source?: 'app' | 'simplybook'; // origin of client record
    sbClientId?: string;           // SimplyBook client ID
    visitDates?: string[];        // ISO dates of all known visits from SimplyBook
}

export const ClientsStore = {
    getAll: async (): Promise<Client[]> => {
        const clientsMap = new Map<string, Client>();

        // 1. Get standalone clients directly from Postgres
        const standalone = await prisma.client.findMany();
        for (const c of standalone) {
            clientsMap.set(c.id, {
                ...c,
                bookingIds: [],
                totalBookings: c.totalBookings || 0,
                lastBookingDate: c.lastBookingDate || '',
                visitDates: (c.visitDates as string[]) || [],
            } as any);
        }

        // 2. Fetch derived clients via GroupBy to avoid pulling 200MB!
        const groupedBookings = await prisma.booking.groupBy({
            by: ['patientName', 'whatsappNumber', 'email'],
            _count: { id: true },
            _max: { date: true }
        });

        for (const g of groupedBookings) {
            const id = g.whatsappNumber || g.email || g.patientName;
            if (!id) continue;
            
            if (!clientsMap.has(id)) {
                clientsMap.set(id, {
                    id,
                    name: g.patientName,
                    phone: g.whatsappNumber || undefined,
                    email: g.email || undefined,
                    bookingIds: [],
                    totalBookings: g._count.id,
                    lastBookingDate: g._max.date || ''
                } as any);
            } else {
                const existing = clientsMap.get(id)!;
                // Merge counts
                if (!existing.source) { // if not explicitly a standalone client logic
                    existing.totalBookings = Math.max(existing.totalBookings, g._count.id);
                    if (g._max.date && (!existing.lastBookingDate || g._max.date > existing.lastBookingDate)) {
                        existing.lastBookingDate = g._max.date;
                    }
                }
            }
        }

        return Array.from(clientsMap.values());
    },

    getPage: async (page: number = 1, limit: number = 50, search: string = ''): Promise<{ clients: Client[], total: number }> => {
        let allClients = await ClientsStore.getAll();
        
        if (search) {
            const s = search.toLowerCase();
            allClients = allClients.filter(c => 
                c.name.toLowerCase().includes(s) ||
                c.phone?.includes(s) ||
                c.mobile?.includes(s) ||
                c.email?.toLowerCase().includes(s) ||
                c.emiratesIdNumber?.includes(s) ||
                c.passportNo?.toLowerCase().includes(s)
            );
        }

        // Sort by lastBookingDate descending, or creation date
        allClients.sort((a, b) => {
            const getIsoDateStr = (val: any) => {
                if (!val) return '';
                if (val instanceof Date) return val.toISOString();
                return String(val);
            };
            const dateA = getIsoDateStr(a.lastBookingDate || (a as any).createdAt);
            const dateB = getIsoDateStr(b.lastBookingDate || (b as any).createdAt);
            return dateB.localeCompare(dateA);
        });

        const total = allClients.length;
        const startIndex = (page - 1) * limit;
        const paginated = allClients.slice(startIndex, startIndex + limit);

        return { clients: paginated, total };
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
        const existing = await prisma.client.findUnique({ where: { id: clientId } });
        if (existing) {
            await prisma.client.update({
                where: { id: clientId },
                data: updates as any
            });
        } else {
            await prisma.client.create({
                data: {
                    id: clientId,
                    name: updates.name || clientId,
                    ...updates
                } as any
            });
        }

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
    },

    importStandalone: async (client: Partial<Client> & { id: string; name: string }): Promise<'imported' | 'skipped'> => {
        const existing = await prisma.client.findFirst({
            where: { OR: [{ id: client.id }, { phone: client.phone }, { email: client.email }] }
        });
        if (existing) return 'skipped';

        await prisma.client.create({ data: client as any });
        return 'imported';
    },

    importStandaloneBatch: async (clients: Array<Partial<Client> & { id: string; name: string }>): Promise<{ added: number; skipped: number }> => {
        let added = 0;
        let skipped = 0;

        for (const client of clients) {
            const existing = await prisma.client.findFirst({
                where: { OR: [{ id: client.id }, { phone: client.phone }, { email: client.email }] }
            });
            if (existing) {
                skipped++;
                continue;
            }

            await prisma.client.create({ data: client as any });
            added++;
        }

        return { added, skipped };
    },

    /**
     * Import or update a SimplyBook client (upsert by SB client ID).
     * If the client already exists as standalone, bookmark data (totalBookings,
     * lastBookingDate, visitDates) is refreshed.
     * Returns 'imported', 'updated', or 'skipped'.
     */
    upsertStandalone: async (
        client: Partial<Client> & { id: string; name: string }
    ): Promise<'imported' | 'updated' | 'skipped'> => {
        const existing = await prisma.client.findFirst({
            where: { OR: [{ id: client.id }, { phone: client.phone }, { email: client.email }] }
        });

        if (existing) {
            if (existing.id === client.id) {
                await prisma.client.update({
                    where: { id: client.id },
                    data: client as any
                });
                return 'updated';
            }
            return 'skipped';
        }

        await prisma.client.create({ data: client as any });
        return 'imported';
    },
};

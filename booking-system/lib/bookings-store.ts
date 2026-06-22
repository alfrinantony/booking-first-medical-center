import { Booking } from './data';
import { loadFromBlob, saveToBlob } from './blob-persistence';
import { LogsStore } from './logs-store';
import { MedicineStore, ServicesStore } from './services-store';
import { PrismaClient } from '@prisma/client';
import { isBookingLocallyModified, parseStatusHistory } from './booking-status-rules';

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

const BOOKING_DB_FIELDS = new Set([
    'id', 'clinicId', 'deptId', 'doctorId', 'serviceId', 'serviceName', 'date', 'slot',
    'duration', 'patientName', 'whatsappNumber', 'email', 'status', 'amount', 'notes',
    'selectedMedicineIds', 'statusHistory', 'linkedPackageId', 'billingStatus', 'sbId',
    'sbInvoiceNumber', 'sbInvoiceAmount', 'sbInvoiceCurrency', 'sbPaymentProcessor',
    'sbPaymentStatus', 'sbProviderName', 'sbServiceName', 'createdAt', 'anyDoctor',
    'isModifiedAfterMigration'
]);

const LOCAL_EDIT_FIELDS = [
    'status', 'date', 'slot', 'clinicId', 'deptId', 'doctorId', 'serviceId', 'duration',
    'patientName', 'whatsappNumber', 'email', 'billingStatus'
];

function pickBookingDbFields(source: Record<string, any>) {
    const picked: Record<string, any> = {};
    for (const key of Object.keys(source)) {
        if (BOOKING_DB_FIELDS.has(key) && source[key] !== undefined) {
            picked[key] = source[key];
        }
    }
    return picked;
}

function didLocalEditableFieldChange(oldBooking: Record<string, any>, updates: Record<string, any>) {
    return LOCAL_EDIT_FIELDS.some(field =>
        Object.prototype.hasOwnProperty.call(updates, field) &&
        updates[field] !== undefined &&
        updates[field] !== oldBooking[field]
    );
}

function getSimplyBookIdFromBooking(booking: Record<string, any> | null | undefined) {
    if (!booking) return undefined;
    if (booking.sbId) return String(booking.sbId);
    const id = String(booking.id || '');
    return id.startsWith('sb-') ? id.slice(3) : undefined;
}

export const BookingsStore = {
    getAll: async () => {
        const bookings = await prisma.booking.findMany({
            orderBy: { date: 'desc' }
        });
        return bookings as any as Booking[];
    },

    getByFilters: async (filters: { clinicId?: string; deptId?: string; doctorId?: string; date?: string; search?: string; startDate?: string; endDate?: string; patientName?: string; serviceId?: string }) => {
        const where: any = {};
        if (filters.clinicId) where.clinicId = filters.clinicId;
        if (filters.deptId) where.deptId = filters.deptId;
        if (filters.doctorId) where.doctorId = filters.doctorId;
        if (filters.patientName) where.patientName = filters.patientName;
        if (filters.serviceId) where.serviceId = filters.serviceId;
        
        if (filters.date) {
            where.date = filters.date;
        } else if (filters.startDate || filters.endDate) {
            where.date = {};
            if (filters.startDate) where.date.gte = filters.startDate;
            if (filters.endDate) where.date.lte = filters.endDate;
        }

        if (filters.search) {
            const search = filters.search.toLowerCase();
            where.OR = [
                { patientName: { contains: search, mode: 'insensitive' } },
                { whatsappNumber: { contains: search } },
                { email: { contains: search, mode: 'insensitive' } }
            ];
        }

        const bookings = await prisma.booking.findMany({ 
            where, 
            orderBy: { date: 'desc' },
            take: 2000 // Safety limit to prevent memory crashes
        });
        return bookings as any as Booking[];
    },

    getPaginated: async (filters: { clinicId?: string; deptId?: string; doctorId?: string; date?: string; search?: string; startDate?: string; endDate?: string; page?: number; limit?: number; patientName?: string; serviceId?: string }) => {
        const where: any = {};
        if (filters.clinicId) where.clinicId = filters.clinicId;
        if (filters.deptId) where.deptId = filters.deptId;
        if (filters.doctorId) where.doctorId = filters.doctorId;
        if (filters.patientName) where.patientName = filters.patientName;
        if (filters.serviceId) where.serviceId = filters.serviceId;
        
        if (filters.date) {
            where.date = filters.date;
        } else if (filters.startDate || filters.endDate) {
            where.date = {};
            if (filters.startDate) where.date.gte = filters.startDate;
            if (filters.endDate) where.date.lte = filters.endDate;
        }

        if (filters.search) {
            const search = filters.search.toLowerCase();
            where.OR = [
                { patientName: { contains: search, mode: 'insensitive' } },
                { whatsappNumber: { contains: search } },
                { email: { contains: search, mode: 'insensitive' } }
            ];
        }

        const page = filters.page || 1;
        const limit = filters.limit || 50;
        const skip = (page - 1) * limit;

        const [bookings, total] = await Promise.all([
            prisma.booking.findMany({ 
                where, 
                orderBy: { date: 'desc' },
                skip,
                take: limit
            }),
            prisma.booking.count({ where })
        ]);

        return { bookings: bookings as any as Booking[], total };
    },


    add: async (booking: Omit<Booking, 'id' | 'createdAt'>) => {
        const id = (booking as any).id || Math.random().toString(36).substr(2, 9);
        
        const fullBooking: any = {
            ...booking,
            duration: booking.duration || 30,
            amount: booking.amount || 0,
            id,
            createdAt: new Date().toISOString(),
            statusHistory: [{
                timestamp: new Date().toISOString(),
                oldStatus: '',
                newStatus: booking.status || 'booked',
                changedBy: (booking as any).staffName || 'System',
                isLocalModified: true
            }]
        };

        const filteredBooking = pickBookingDbFields(fullBooking);

        const newBooking = await prisma.booking.create({
            data: filteredBooking as any
        });

        const medicineIds = newBooking.selectedMedicineIds as any as string[];
        if (medicineIds && medicineIds.length > 0) {
            for (const medId of medicineIds) {
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

        return newBooking as any as Booking;
    },

    getById: async (id: string) => {
        const b = await prisma.booking.findUnique({ where: { id } });
        return b as any as Booking | undefined;
    },

    /**
     * Lightweight insert for a single SimplyBook-sourced booking.
     * Skips medicine/consumable stock deduction.
     */
    addSimplyBook: async (booking: Omit<Booking, 'id' | 'createdAt'> & { source?: string; sbId?: string }) => {
        const { source: _s, sbId, ...rest } = booking as any;
        if (sbId) {
            const existing = await prisma.booking.findFirst({ where: { sbId } });
            if (existing) return existing as any as Booking;
        }

        const fullBooking: any = {
            ...rest,
            id: `sb-${sbId || Math.random().toString(36).substr(2, 9)}`,
            createdAt: new Date().toISOString(),
            sbId,
            statusHistory: [{
                timestamp: new Date().toISOString(),
                oldStatus: '',
                newStatus: booking.status || 'confirmed',
                changedBy: 'SimplyBook Sync',
            }]
        };

        const filteredBooking = pickBookingDbFields(fullBooking);

        const newBooking = await prisma.booking.create({
            data: filteredBooking as any
        });
        return newBooking as any as Booking;
    },

    addSimplyBookBatch: async (
        incoming: Array<Omit<Booking, 'id' | 'createdAt'> & { sbId?: string }>
    ): Promise<{ added: number; skipped: number; updated: number }> => {
        const incomingSbIds = incoming.map(b => b.sbId).filter(Boolean) as string[];
        const existing = await prisma.booking.findMany({
            where: {
                OR: [
                    { sbId: { in: incomingSbIds } },
                    { id: { in: incomingSbIds.map(id => `sb-${id}`) } },
                ]
            }
        });
        const existingMap = new Map<string, any>();
        for (const record of existing) {
            const recordSbId = getSimplyBookIdFromBooking(record as any);
            if (recordSbId) existingMap.set(recordSbId, record);
        }
        
        const toCreate = incoming.filter(b => !b.sbId || !existingMap.has(String(b.sbId)));
        const toUpdate = incoming.filter(b => b.sbId && existingMap.has(String(b.sbId)));
        
        let skipped = 0;
        let added = 0;
        let updated = 0;

        for (const updateInfo of toUpdate) {
            const ext = existingMap.get(String(updateInfo.sbId));

            if (!ext || isBookingLocallyModified(ext)) {
                skipped++;
                continue;
            }

            const history = parseStatusHistory(ext.statusHistory);
            const updatePayload = pickBookingDbFields(updateInfo as any);
            delete updatePayload.id;
            delete updatePayload.createdAt;
            delete updatePayload.statusHistory;
            delete updatePayload.isModifiedAfterMigration;

            if (updatePayload.status && updatePayload.status !== ext.status) {
                history.push({
                    timestamp: new Date().toISOString(),
                    oldStatus: ext.status,
                    newStatus: updatePayload.status,
                    changedBy: 'SimplyBook Sync',
                });
                updatePayload.statusHistory = history;
            }

            const changed = Object.keys(updatePayload).some(key => (ext as any)[key] !== updatePayload[key]);
            if (!changed) {
                skipped++;
                continue;
            }

            await prisma.booking.updateMany({
                where: { sbId: updateInfo.sbId },
                data: updatePayload
            });
            updated++;
        }
        
        if (toCreate.length > 0) {
            const now = new Date().toISOString();

            const dataToInsert = toCreate.map(booking => {
                const { sbId, ...rest } = booking as any;
                const fullObject: any = {
                    ...rest,
                    id: `sb-${sbId || Math.random().toString(36).substr(2, 9)}`,
                    createdAt: now,
                    sbId,
                    statusHistory: [{
                        timestamp: now,
                        oldStatus: '',
                        newStatus: booking.status || 'confirmed',
                        changedBy: 'SimplyBook Migration',
                    }]
                };

                return pickBookingDbFields(fullObject);
            });
            
            const result = await prisma.booking.createMany({
                data: dataToInsert as any,
                skipDuplicates: true
            });
            added = result.count;
        }
        
        return { added, skipped, updated };
    },

    /**
     * Update a booking's status by sbId (used by webhook cascade).
     */
    updateBySbId: async (sbId: string, status: Booking['status']): Promise<boolean> => {
        const booking = await prisma.booking.findFirst({ where: { sbId } });
        if (!booking) return false;
        
        const oldStatus = booking.status;
        let history = parseStatusHistory(booking.statusHistory);

        // If the booking has been locally modified, ignore SimplyBook webhooks to prevent overwriting
        if (isBookingLocallyModified(booking)) {
            return false;
        }
        history.push({
            timestamp: new Date().toISOString(),
            oldStatus,
            newStatus: status,
            changedBy: 'SimplyBook Webhook',
        });
        
        await prisma.booking.update({
            where: { id: booking.id },
            data: { status, statusHistory: history as any }
        });
        return true;
    },

    update: async (id: string, updates: Partial<Booking> & { staffName?: string }) => {
        const oldBooking = await prisma.booking.findUnique({ where: { id } });
        if (!oldBooking) return null;

        const staffName = updates.staffName || 'Admin';
        const { staffName: _, ...cleanUpdates } = updates;

        let history = parseStatusHistory(oldBooking.statusHistory);

        let historyChanged = false;
        const statusChanged = !!cleanUpdates.status && cleanUpdates.status !== oldBooking.status;

        if (statusChanged) {
            history.push({
                timestamp: new Date().toISOString(),
                oldStatus: oldBooking.status,
                newStatus: cleanUpdates.status,
                changedBy: staffName,
                action: 'Status Changed',
                isLocalModified: true
            });
            historyChanged = true;
        }

        const details = [];
        if (cleanUpdates.date && cleanUpdates.date !== oldBooking.date) details.push(`Date from ${oldBooking.date} to ${cleanUpdates.date}`);
        if (cleanUpdates.slot && cleanUpdates.slot !== oldBooking.slot) details.push(`Time from ${oldBooking.slot} to ${cleanUpdates.slot}`);
        if (cleanUpdates.doctorId && cleanUpdates.doctorId !== oldBooking.doctorId) details.push(`Doctor changed`);
        if (cleanUpdates.clinicId && cleanUpdates.clinicId !== oldBooking.clinicId) details.push(`Branch changed`);
        if (cleanUpdates.serviceId && cleanUpdates.serviceId !== oldBooking.serviceId) details.push(`Procedure changed`);
        if (cleanUpdates.patientName && cleanUpdates.patientName !== oldBooking.patientName) details.push(`Patient from ${oldBooking.patientName} to ${cleanUpdates.patientName}`);
        if (cleanUpdates.whatsappNumber && cleanUpdates.whatsappNumber !== oldBooking.whatsappNumber) details.push(`Phone changed`);
        if (cleanUpdates.email && cleanUpdates.email !== oldBooking.email) details.push(`Email changed`);

        if (details.length > 0) {
            history.push({
                timestamp: new Date().toISOString(),
                oldStatus: cleanUpdates.status || oldBooking.status,
                newStatus: cleanUpdates.status || oldBooking.status,
                changedBy: staffName,
                action: 'Appointment Edited',
                details: details.join(', '),
                isLocalModified: true
            });
            historyChanged = true;
        }

        const locallyChanged = didLocalEditableFieldChange(oldBooking as any, cleanUpdates as any);
        const migratedSbId = getSimplyBookIdFromBooking(oldBooking as any);
        if (migratedSbId && !(cleanUpdates as any).sbId) {
            (cleanUpdates as any).sbId = migratedSbId;
        }
        if (historyChanged) {
            (cleanUpdates as any).statusHistory = history;
        }
        if (locallyChanged && migratedSbId) {
            (cleanUpdates as any).isModifiedAfterMigration = true;
        }

        const filteredUpdates = pickBookingDbFields(cleanUpdates as any);
        delete filteredUpdates.id;
        delete filteredUpdates.createdAt;

        const updated = await prisma.booking.update({
            where: { id },
            data: filteredUpdates
        });

        const user = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('adminUser') || '{}') : {};
        if (statusChanged) {
            await LogsStore.add({
                userId: user.id || 'admin',
                userName: staffName || user.name || 'Admin',
                action: 'UPDATE_BOOKING_STATUS',
                details: `Changed booking ${id} status from ${oldBooking.status} to ${cleanUpdates.status}`,
                entityId: id,
                entityType: 'Booking'
            });
        }
        await LogsStore.add({
            userId: user.id || 'admin',
            userName: staffName || user.name || 'Admin',
            action: 'UPDATE_BOOKING',
            details: `Updated booking ${id}. Changes: ${Object.keys(filteredUpdates).join(', ')}`,
            entityId: id,
            entityType: 'Booking'
        });

        return updated as any as Booking;
    },

    updateStatus: async (id: string, status: Booking['status'], staffName?: string) => {
        const booking = await prisma.booking.findUnique({ where: { id } });
        if (booking) {
            const oldStatus = booking.status;
            const history = (booking.statusHistory as any[]) || [];
            history.push({
                timestamp: new Date().toISOString(),
                oldStatus,
                newStatus: status,
                changedBy: staffName || 'Admin',
                isLocalModified: true
            });
            
            const dataToUpdate: any = { status, statusHistory: history, isModifiedAfterMigration: true };
            if (status === 'completed' && booking.billingStatus !== 'billed') {
                dataToUpdate.billingStatus = 'pending_bill';
            }

            const updated = await prisma.booking.update({
                where: { id },
                data: dataToUpdate
            });

            const user = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('adminUser') || '{}') : {};
            await LogsStore.add({
                userId: user.id || 'admin',
                userName: user.name || 'Admin',
                action: 'UPDATE_BOOKING_STATUS',
                details: `Updated booking ${id} status to ${status}`,
                entityId: id,
                entityType: 'Booking'
            });
            return updated as any as Booking;
        }
        return undefined;
    },
    
    delete: async (id: string) => {
        try {
            await prisma.booking.delete({ where: { id } });
            return true;
        } catch {
            return false;
        }
    }
};

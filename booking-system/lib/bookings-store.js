"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingsStore = void 0;
const logs_store_1 = require("./logs-store");
const services_store_1 = require("./services-store");
const client_1 = require("@prisma/client");
let dbUrl = process.env.DATABASE_URL || '';
if (dbUrl.includes(':6543')) {
    dbUrl = dbUrl.replace(':6543', ':5432').replace('?pgbouncer=true', '').replace('&pgbouncer=true', '');
}
const prisma = new client_1.PrismaClient({
    datasources: {
        db: {
            url: dbUrl
        }
    }
});
exports.BookingsStore = {
    getAll: async () => {
        const bookings = await prisma.booking.findMany({
            orderBy: { date: 'desc' }
        });
        return bookings;
    },
    getByFilters: async (filters) => {
        const where = {};
        if (filters.clinicId)
            where.clinicId = filters.clinicId;
        if (filters.deptId)
            where.deptId = filters.deptId;
        if (filters.doctorId)
            where.doctorId = filters.doctorId;
        if (filters.date) {
            where.date = filters.date;
        }
        else if (filters.startDate || filters.endDate) {
            where.date = {};
            if (filters.startDate)
                where.date.gte = filters.startDate;
            if (filters.endDate)
                where.date.lte = filters.endDate;
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
        return bookings;
    },
    getPaginated: async (filters) => {
        const where = {};
        if (filters.clinicId)
            where.clinicId = filters.clinicId;
        if (filters.deptId)
            where.deptId = filters.deptId;
        if (filters.doctorId)
            where.doctorId = filters.doctorId;
        if (filters.date) {
            where.date = filters.date;
        }
        else if (filters.startDate || filters.endDate) {
            where.date = {};
            if (filters.startDate)
                where.date.gte = filters.startDate;
            if (filters.endDate)
                where.date.lte = filters.endDate;
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
        return { bookings: bookings, total };
    },
    add: async (booking) => {
        const id = Math.random().toString(36).substr(2, 9);
        const fullBooking = {
            ...booking,
            duration: booking.duration || 30,
            amount: booking.amount || 0,
            id,
            createdAt: new Date().toISOString(),
            statusHistory: [{
                    timestamp: new Date().toISOString(),
                    oldStatus: '',
                    newStatus: booking.status || 'booked',
                    changedBy: booking.staffName || 'System',
                }]
        };
        const allowedFields = new Set([
            'id', 'clinicId', 'deptId', 'doctorId', 'serviceId', 'serviceName', 'date', 'slot',
            'duration', 'patientName', 'whatsappNumber', 'email', 'status', 'amount', 'notes',
            'selectedMedicineIds', 'statusHistory', 'linkedPackageId', 'billingStatus', 'sbId',
            'sbInvoiceNumber', 'sbInvoiceAmount', 'sbInvoiceCurrency', 'sbPaymentProcessor',
            'sbPaymentStatus', 'sbProviderName', 'sbServiceName', 'createdAt', 'anyDoctor'
        ]);
        const filteredBooking = {};
        for (const key of Object.keys(fullBooking)) {
            if (allowedFields.has(key)) {
                filteredBooking[key] = fullBooking[key];
            }
        }
        const newBooking = await prisma.booking.create({
            data: filteredBooking
        });
        const medicineIds = newBooking.selectedMedicineIds;
        if (medicineIds && medicineIds.length > 0) {
            for (const medId of medicineIds) {
                await services_store_1.MedicineStore.deductStock(medId, 1, newBooking.clinicId);
            }
        }
        // Deduct consumable stock from the branch (looked up from the service)
        const allClinics = await services_store_1.ServicesStore.getClinics();
        const clinic = allClinics.find((c) => c.id === newBooking.clinicId);
        if (clinic) {
            for (const dept of clinic.departments) {
                const svc = dept.services.find((s) => s.id === newBooking.serviceId);
                if (svc && svc.consumableIds && svc.consumableIds.length > 0) {
                    for (const consumableId of svc.consumableIds) {
                        await services_store_1.MedicineStore.deductStock(consumableId, 1, newBooking.clinicId);
                    }
                    break;
                }
            }
        }
        const user = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('adminUser') || '{}') : {};
        await logs_store_1.LogsStore.add({
            userId: user.id || 'system',
            userName: user.name || 'System',
            action: 'CREATE_BOOKING',
            details: `Created booking for ${newBooking.patientName} on ${newBooking.date}`,
            entityId: newBooking.id,
            entityType: 'Booking'
        });
        return newBooking;
    },
    getById: async (id) => {
        const b = await prisma.booking.findUnique({ where: { id } });
        return b;
    },
    /**
     * Lightweight insert for a single SimplyBook-sourced booking.
     * Skips medicine/consumable stock deduction.
     */
    addSimplyBook: async (booking) => {
        const { source: _s, sbId, ...rest } = booking;
        if (sbId) {
            const existing = await prisma.booking.findFirst({ where: { sbId } });
            if (existing)
                return existing;
        }
        const fullBooking = {
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
        const allowedFields = new Set([
            'id', 'clinicId', 'deptId', 'doctorId', 'serviceId', 'serviceName', 'date', 'slot',
            'duration', 'patientName', 'whatsappNumber', 'email', 'status', 'amount', 'notes',
            'selectedMedicineIds', 'statusHistory', 'linkedPackageId', 'billingStatus', 'sbId',
            'sbInvoiceNumber', 'sbInvoiceAmount', 'sbInvoiceCurrency', 'sbPaymentProcessor',
            'sbPaymentStatus', 'sbProviderName', 'sbServiceName', 'createdAt', 'anyDoctor'
        ]);
        const filteredBooking = {};
        for (const key of Object.keys(fullBooking)) {
            if (allowedFields.has(key)) {
                filteredBooking[key] = fullBooking[key];
            }
        }
        const newBooking = await prisma.booking.create({
            data: filteredBooking
        });
        return newBooking;
    },
    addSimplyBookBatch: async (incoming) => {
        const incomingSbIds = incoming.map(b => b.sbId).filter(Boolean);
        const existing = await prisma.booking.findMany({
            where: { sbId: { in: incomingSbIds } },
            select: { sbId: true, doctorId: true, clinicId: true, deptId: true }
        });
        const existingMap = new Map(existing.map(e => [e.sbId, e]));
        const toCreate = incoming.filter(b => !b.sbId || !existingMap.has(b.sbId));
        const toUpdate = incoming.filter(b => b.sbId && existingMap.has(b.sbId));
        let skipped = 0;
        let added = 0;
        let updated = 0;
        for (const updateInfo of toUpdate) {
            const ext = existingMap.get(updateInfo.sbId);
            if (ext && (ext.doctorId !== updateInfo.doctorId || ext.clinicId !== updateInfo.clinicId || ext.deptId !== updateInfo.deptId)) {
                await prisma.booking.updateMany({
                    where: { sbId: updateInfo.sbId },
                    data: {
                        doctorId: updateInfo.doctorId,
                        clinicId: updateInfo.clinicId,
                        deptId: updateInfo.deptId,
                    }
                });
                updated++;
            }
            else {
                skipped++;
            }
        }
        if (toCreate.length > 0) {
            const now = new Date().toISOString();
            const allowedFields = new Set([
                'id', 'clinicId', 'deptId', 'doctorId', 'serviceId', 'serviceName', 'date', 'slot',
                'duration', 'patientName', 'whatsappNumber', 'email', 'status', 'amount', 'notes',
                'selectedMedicineIds', 'statusHistory', 'linkedPackageId', 'billingStatus', 'sbId',
                'sbInvoiceNumber', 'sbInvoiceAmount', 'sbInvoiceCurrency', 'sbPaymentProcessor',
                'sbPaymentStatus', 'sbProviderName', 'sbServiceName', 'createdAt', 'anyDoctor'
            ]);
            const dataToInsert = toCreate.map(booking => {
                const { sbId, ...rest } = booking;
                const fullObject = {
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
                const filteredObject = {};
                for (const key of Object.keys(fullObject)) {
                    if (allowedFields.has(key)) {
                        filteredObject[key] = fullObject[key];
                    }
                }
                return filteredObject;
            });
            const result = await prisma.booking.createMany({
                data: dataToInsert,
                skipDuplicates: true
            });
            added = result.count;
        }
        return { added, skipped, updated: 0 };
    },
    /**
     * Update a booking's status by sbId (used by webhook cascade).
     */
    updateBySbId: async (sbId, status) => {
        const booking = await prisma.booking.findFirst({ where: { sbId } });
        if (!booking)
            return false;
        const oldStatus = booking.status;
        let history = booking.statusHistory;
        if (typeof history === 'string') {
            try {
                history = JSON.parse(history);
            }
            catch {
                history = [];
            }
        }
        if (!Array.isArray(history)) {
            history = [];
        }
        history.push({
            timestamp: new Date().toISOString(),
            oldStatus,
            newStatus: status,
            changedBy: 'SimplyBook Webhook',
        });
        await prisma.booking.update({
            where: { id: booking.id },
            data: { status, statusHistory: history }
        });
        return true;
    },
    update: async (id, updates) => {
        const oldBooking = await prisma.booking.findUnique({ where: { id } });
        if (!oldBooking)
            return null;
        const staffName = updates.staffName || 'Admin';
        const { staffName: _, ...cleanUpdates } = updates;
        let history = oldBooking.statusHistory;
        if (typeof history === 'string') {
            try {
                history = JSON.parse(history);
            }
            catch {
                history = [];
            }
        }
        if (!Array.isArray(history)) {
            history = [];
        }
        let historyChanged = false;
        if (cleanUpdates.status && cleanUpdates.status !== oldBooking.status) {
            history.push({
                timestamp: new Date().toISOString(),
                oldStatus: oldBooking.status,
                newStatus: cleanUpdates.status,
                changedBy: staffName,
                action: 'Status Changed',
            });
            historyChanged = true;
        }
        const details = [];
        if (cleanUpdates.date && cleanUpdates.date !== oldBooking.date)
            details.push(`Date from ${oldBooking.date} to ${cleanUpdates.date}`);
        if (cleanUpdates.slot && cleanUpdates.slot !== oldBooking.slot)
            details.push(`Time from ${oldBooking.slot} to ${cleanUpdates.slot}`);
        if (cleanUpdates.doctorId && cleanUpdates.doctorId !== oldBooking.doctorId)
            details.push(`Doctor changed`);
        if (cleanUpdates.clinicId && cleanUpdates.clinicId !== oldBooking.clinicId)
            details.push(`Branch changed`);
        if (cleanUpdates.serviceId && cleanUpdates.serviceId !== oldBooking.serviceId)
            details.push(`Procedure changed`);
        if (details.length > 0) {
            history.push({
                timestamp: new Date().toISOString(),
                oldStatus: cleanUpdates.status || oldBooking.status,
                newStatus: cleanUpdates.status || oldBooking.status,
                changedBy: staffName,
                action: 'Appointment Edited',
                details: details.join(', ')
            });
            historyChanged = true;
        }
        if (historyChanged) {
            cleanUpdates.statusHistory = history;
        }
        const allowedFields = new Set([
            'id', 'clinicId', 'deptId', 'doctorId', 'serviceId', 'serviceName', 'date', 'slot',
            'duration', 'patientName', 'whatsappNumber', 'email', 'status', 'amount', 'notes',
            'selectedMedicineIds', 'statusHistory', 'linkedPackageId', 'billingStatus', 'sbId',
            'sbInvoiceNumber', 'sbInvoiceAmount', 'sbInvoiceCurrency', 'sbPaymentProcessor',
            'sbPaymentStatus', 'sbProviderName', 'sbServiceName', 'createdAt', 'anyDoctor'
        ]);
        const filteredUpdates = {};
        for (const key of Object.keys(cleanUpdates)) {
            if (allowedFields.has(key)) {
                filteredUpdates[key] = cleanUpdates[key];
            }
        }
        const updated = await prisma.booking.update({
            where: { id },
            data: filteredUpdates
        });
        const user = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('adminUser') || '{}') : {};
        await logs_store_1.LogsStore.add({
            userId: user.id || 'admin',
            userName: user.name || 'Admin',
            action: 'UPDATE_BOOKING',
            details: `Updated booking ${id}. Changes: ${Object.keys(cleanUpdates).join(', ')}`,
            entityId: id,
            entityType: 'Booking'
        });
        return updated;
    },
    updateStatus: async (id, status, staffName) => {
        const booking = await prisma.booking.findUnique({ where: { id } });
        if (booking) {
            const oldStatus = booking.status;
            const history = booking.statusHistory || [];
            history.push({
                timestamp: new Date().toISOString(),
                oldStatus,
                newStatus: status,
                changedBy: staffName || 'Admin',
            });
            const dataToUpdate = { status, statusHistory: history };
            if (status === 'completed' && booking.billingStatus !== 'billed') {
                dataToUpdate.billingStatus = 'pending_bill';
            }
            const updated = await prisma.booking.update({
                where: { id },
                data: dataToUpdate
            });
            const user = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('adminUser') || '{}') : {};
            await logs_store_1.LogsStore.add({
                userId: user.id || 'admin',
                userName: user.name || 'Admin',
                action: 'UPDATE_BOOKING_STATUS',
                details: `Updated booking ${id} status to ${status}`,
                entityId: id,
                entityType: 'Booking'
            });
            return updated;
        }
        return undefined;
    },
    delete: async (id) => {
        try {
            await prisma.booking.delete({ where: { id } });
            return true;
        }
        catch {
            return false;
        }
    }
};

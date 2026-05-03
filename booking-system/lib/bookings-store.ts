import { Booking } from './data';
import { loadFromBlob, saveToBlob } from './blob-persistence';
import { LogsStore } from './logs-store';
import { MedicineStore, ServicesStore } from './services-store';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const BookingsStore = {
    getAll: async () => {
        const bookings = await prisma.booking.findMany({
            orderBy: { date: 'desc' }
        });
        return bookings as any as Booking[];
    },

    getByFilters: async (filters: { clinicId?: string; deptId?: string; doctorId?: string; date?: string; search?: string; startDate?: string; endDate?: string }) => {
        const where: any = {};
        if (filters.clinicId) where.clinicId = filters.clinicId;
        if (filters.deptId) where.deptId = filters.deptId;
        if (filters.doctorId) where.doctorId = filters.doctorId;
        
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

    getPaginated: async (filters: { clinicId?: string; deptId?: string; doctorId?: string; date?: string; search?: string; startDate?: string; endDate?: string; page?: number; limit?: number }) => {
        const where: any = {};
        if (filters.clinicId) where.clinicId = filters.clinicId;
        if (filters.deptId) where.deptId = filters.deptId;
        if (filters.doctorId) where.doctorId = filters.doctorId;
        
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
        const id = Math.random().toString(36).substr(2, 9);
        const newBooking = await prisma.booking.create({
            data: {
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
                }] as any
            }
        });

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
        const newBooking = await prisma.booking.create({
            data: {
                ...rest,
                id: `sb-${sbId || Math.random().toString(36).substr(2, 9)}`,
                createdAt: new Date().toISOString(),
                source: 'simplybook',
                sbId,
                statusHistory: [{
                    timestamp: new Date().toISOString(),
                    oldStatus: '',
                    newStatus: booking.status || 'confirmed',
                    changedBy: 'SimplyBook Sync',
                }] as any
            } as any
        });
        return newBooking as any as Booking;
    },

    addSimplyBookBatch: async (
        incoming: Array<Omit<Booking, 'id' | 'createdAt'> & { sbId?: string }>
    ): Promise<{ added: number; skipped: number }> => {
        const incomingSbIds = incoming.map(b => b.sbId).filter(Boolean) as string[];
        const existing = await prisma.booking.findMany({
            where: { sbId: { in: incomingSbIds } },
            select: { sbId: true }
        });
        const existingSet = new Set(existing.map(e => e.sbId));
        
        const toCreate = incoming.filter(b => !b.sbId || !existingSet.has(b.sbId));
        const skipped = incoming.length - toCreate.length;
        let added = 0;
        
        if (toCreate.length > 0) {
            const now = new Date().toISOString();
            const dataToInsert = toCreate.map(booking => {
                const { sbId, ...rest } = booking as any;
                return {
                    ...rest,
                    id: `sb-${sbId || Math.random().toString(36).substr(2, 9)}`,
                    createdAt: now,
                    source: 'simplybook',
                    sbId,
                    statusHistory: [{
                        timestamp: now,
                        oldStatus: '',
                        newStatus: booking.status || 'confirmed',
                        changedBy: 'SimplyBook Migration',
                    }]
                };
            });
            
            const result = await prisma.booking.createMany({
                data: dataToInsert,
                skipDuplicates: true
            });
            added = result.count;
        }
        
        return { added, skipped };
    },

    /**
     * Update a booking's status by sbId (used by webhook cascade).
     */
    updateBySbId: async (sbId: string, status: Booking['status']): Promise<boolean> => {
        const booking = await prisma.booking.findFirst({ where: { sbId } });
        if (!booking) return false;
        
        const oldStatus = booking.status;
        const history = (booking.statusHistory as any[]) || [];
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

    update: async (id: string, updates: Partial<Booking> & { staffName?: string }) => {
        const oldBooking = await prisma.booking.findUnique({ where: { id } });
        if (!oldBooking) return null;

        const staffName = updates.staffName || 'Admin';
        const { staffName: _, ...cleanUpdates } = updates;

        if (cleanUpdates.status && cleanUpdates.status !== oldBooking.status) {
            const history = (oldBooking.statusHistory as any[]) || [];
            history.push({
                timestamp: new Date().toISOString(),
                oldStatus: oldBooking.status,
                newStatus: cleanUpdates.status,
                changedBy: staffName,
            });
            (cleanUpdates as any).statusHistory = history;
        }

        const updated = await prisma.booking.update({
            where: { id },
            data: cleanUpdates as any
        });

        const user = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('adminUser') || '{}') : {};
        await LogsStore.add({
            userId: user.id || 'admin',
            userName: user.name || 'Admin',
            action: 'UPDATE_BOOKING',
            details: `Updated booking ${id}. Changes: ${Object.keys(cleanUpdates).join(', ')}`,
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
            });
            
            const dataToUpdate: any = { status, statusHistory: history };
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

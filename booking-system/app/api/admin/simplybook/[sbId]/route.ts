export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { SimplybookStore } from '@/lib/simplybook-store';
import { ClientsStore } from '@/lib/clients-store';
import { BookingsStore } from '@/lib/bookings-store';
import { canEditCompletedBilledBooking } from '@/lib/booking-status-rules';

/** PATCH /api/admin/simplybook/[sbId]  — update client info on a SimplyBook record */
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ sbId: string }> }
) {
    try {
        const { sbId } = await params;
        const body = await req.json() as {
            clientName?: string;
            clientPhone?: string;
            clientEmail?: string;
            editorRole?: string;
            editPassword?: string;
        };
        const record = await SimplybookStore.getById(sbId);
        if (!record) return NextResponse.json({ error: 'Record not found' }, { status: 404 });

        let syncedBookingId = record.syncedToBookingsId;
        let linkedBooking: any = null;
        try {
            const appBookings = await BookingsStore.getAll();
            linkedBooking = appBookings.find((b: any) => b.sbId === sbId);
            syncedBookingId = syncedBookingId || linkedBooking?.id;
            if (!linkedBooking && syncedBookingId) {
                linkedBooking = await BookingsStore.getById(syncedBookingId);
            }
        } catch (lookupErr) {
            console.warn('[SB PATCH] BookingsStore lookup failed (non-fatal):', lookupErr);
        }

        if (linkedBooking && !canEditCompletedBilledBooking(linkedBooking, body.editorRole, body.editPassword)) {
            return NextResponse.json({
                error: 'Completed and billed appointments are locked. Super Admin password is required to edit.'
            }, { status: 403 });
        }

        // ── 1. Update the SimplyBook record ──
        const newName  = body.clientName  !== undefined ? body.clientName.trim()  : record.clientName;
        const newPhone = body.clientPhone !== undefined ? body.clientPhone.trim() : record.clientPhone;
        const newEmail = body.clientEmail !== undefined ? body.clientEmail.trim() : record.clientEmail;

        const updated = await SimplybookStore.upsert({
            ...record,
            clientName:  newName,
            clientPhone: newPhone,
            clientEmail: newEmail,
        });

        // ── 2. Upsert client into ClientsStore (adds to /admin/clients) ──
        if (newName) {
            try {
                await ClientsStore.upsertStandalone({
                    id:     `sb-client-${record.clientId || sbId}`,
                    name:   newName,
                    phone:  newPhone || undefined,
                    mobile: newPhone || undefined,
                    email:  newEmail || undefined,
                    source:     'simplybook',
                    sbClientId: record.clientId || sbId,
                    bookingIds: [],
                    totalBookings: 0,
                });
            } catch (clientErr) {
                console.warn('[SB PATCH] ClientsStore upsert failed (non-fatal):', clientErr);
            }
        }

        // ── 3. If booking was migrated into BookingsStore, propagate the edits ──
        syncedBookingId = updated.syncedToBookingsId || syncedBookingId;

        if (syncedBookingId) {
            try {
                await BookingsStore.update(syncedBookingId, {
                    patientName:    newName  || undefined,
                    whatsappNumber: newPhone || undefined,
                    email:          newEmail || undefined,
                });
            } catch (bookingErr) {
                console.warn('[SB PATCH] BookingsStore update failed (non-fatal):', bookingErr);
            }
        }

        return NextResponse.json(updated);
    } catch {
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
}

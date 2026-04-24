export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { SimplybookStore } from '@/lib/simplybook-store';
import { ClientsStore } from '@/lib/clients-store';
import { BookingsStore } from '@/lib/bookings-store';

/** PATCH /api/admin/simplybook/[sbId]  — update client info on a SimplyBook record */
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ sbId: string }> }
) {
    try {
        const { sbId } = await params;
        const body = await req.json() as { clientName?: string; clientPhone?: string; clientEmail?: string };
        const record = await SimplybookStore.getById(sbId);
        if (!record) return NextResponse.json({ error: 'Record not found' }, { status: 404 });

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
        if (updated.syncedToBookingsId) {
            try {
                await BookingsStore.update(updated.syncedToBookingsId, {
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

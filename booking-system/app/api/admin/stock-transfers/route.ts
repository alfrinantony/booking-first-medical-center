export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { StockTransferStore } from '@/lib/services-store';
import { TransferStatus } from '@/lib/data';
import { UsersStore } from '@/lib/users-store';

/* ── helpers ── */
function isSuperAdmin(role?: string) { return role === 'SUPER_ADMIN'; }

function userCanAccessLocation(clinicIds: string[], location: string): boolean {
    if (location === 'central') return false; // central is SUPER_ADMIN-only for branch checks
    return clinicIds.includes(location);
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const medicineId = searchParams.get('medicineId') || undefined;
    const status = searchParams.get('status') || undefined;
    let records = await StockTransferStore.getAll();
    if (medicineId) records = records.filter(r => r.medicineId === medicineId);
    if (status) records = records.filter(r => r.status === status);
    return NextResponse.json(records);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { medicineId, fromLocation, toLocation, quantity, requestedBy, requesterId, notes } = body;
        if (!medicineId || !fromLocation || !toLocation || !quantity || !requestedBy) {
            return NextResponse.json({ error: 'medicineId, fromLocation, toLocation, quantity and requestedBy are required' }, { status: 400 });
        }
        if (fromLocation === toLocation) {
            return NextResponse.json({ error: 'Source and destination must be different' }, { status: 400 });
        }

        // ── Branch access control ──────────────────────────────────────
        // The requester must be assigned to the RECEIVING branch (toLocation)
        // SUPER_ADMIN bypasses this restriction
        if (requesterId) {
            const requester = await UsersStore.getUserById(requesterId);
            if (requester && !isSuperAdmin(requester.role)) {
                const clinicIds = requester.clinicIds || [];
                if (!userCanAccessLocation(clinicIds, toLocation)) {
                    return NextResponse.json(
                        { error: 'You are not assigned to the receiving branch and cannot raise this request.' },
                        { status: 403 }
                    );
                }
            }
        }

        const record = await StockTransferStore.create({ medicineId, fromLocation, toLocation, quantity: Number(quantity), requestedBy, notes: notes || undefined });
        return NextResponse.json(record);
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, status, actorName, actorId, cancellationReason } = body;
        if (!id || !status || !actorName) {
            return NextResponse.json({ error: 'id, status and actorName are required' }, { status: 400 });
        }

        // ── Branch access control per transition ──────────────────────
        if (actorId) {
            const actor = await UsersStore.getUserById(actorId);
            if (actor && !isSuperAdmin(actor.role)) {
                const clinicIds = actor.clinicIds || [];

                // Get the current transfer to know fromLocation/toLocation
                const allTransfers = await StockTransferStore.getAll();
                const transfer = allTransfers.find(t => t.id === id);
                if (!transfer) {
                    return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
                }

                // approved / in_transit → actor must be assigned to SENDING branch
                if ((status === 'approved' || status === 'in_transit') && transfer.fromLocation !== 'central') {
                    if (!userCanAccessLocation(clinicIds, transfer.fromLocation)) {
                        return NextResponse.json(
                            { error: 'Only staff assigned to the sending branch can approve or dispatch this transfer.' },
                            { status: 403 }
                        );
                    }
                }
                // received → actor must be assigned to RECEIVING branch
                if (status === 'received') {
                    if (!userCanAccessLocation(clinicIds, transfer.toLocation)) {
                        return NextResponse.json(
                            { error: 'Only staff assigned to the receiving branch can confirm receipt.' },
                            { status: 403 }
                        );
                    }
                }
                // cancelled → SUPER_ADMIN only (non-super_admin reaches here)
                if (status === 'cancelled') {
                    return NextResponse.json(
                        { error: 'Only a Super Admin can cancel a transfer.' },
                        { status: 403 }
                    );
                }
            }
        }

        const result = await StockTransferStore.updateStatus(id, status as TransferStatus, actorName, { cancellationReason });
        if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
        return NextResponse.json(result.record);
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

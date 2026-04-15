export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { StockTransferStore } from '@/lib/services-store';
import { TransferStatus } from '@/lib/data';

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
        const { medicineId, fromLocation, toLocation, quantity, requestedBy, notes } = body;
        if (!medicineId || !fromLocation || !toLocation || !quantity || !requestedBy) {
            return NextResponse.json({ error: 'medicineId, fromLocation, toLocation, quantity and requestedBy are required' }, { status: 400 });
        }
        if (fromLocation === toLocation) {
            return NextResponse.json({ error: 'Source and destination must be different' }, { status: 400 });
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
        const { id, status, actorName, cancellationReason } = body;
        if (!id || !status || !actorName) {
            return NextResponse.json({ error: 'id, status and actorName are required' }, { status: 400 });
        }
        const result = await StockTransferStore.updateStatus(id, status as TransferStatus, actorName, { cancellationReason });
        if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
        return NextResponse.json(result.record);
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

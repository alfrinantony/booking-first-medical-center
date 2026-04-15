export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { ExpiredStockStore } from '@/lib/services-store';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const records = year
        ? await ExpiredStockStore.getByYear(Number(year))
        : await ExpiredStockStore.getAll();
    return NextResponse.json(records);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { medicineId, medicineName, quantity, expiryDate, location, movedBy, batchNumber } = body;
        if (!medicineId || !medicineName || !quantity || !expiryDate || !location || !movedBy) {
            return NextResponse.json({ error: 'medicineId, medicineName, quantity, expiryDate, location and movedBy are required' }, { status: 400 });
        }
        const result = await ExpiredStockStore.add({ medicineId, medicineName, quantity: Number(quantity), expiryDate, location, movedBy, batchNumber: batchNumber || undefined });
        if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
        return NextResponse.json(result.record);
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, disposalDate, disposalNotes } = body;
        if (!id || !disposalDate) return NextResponse.json({ error: 'id and disposalDate are required' }, { status: 400 });
        const ok = await ExpiredStockStore.updateDisposal(id, disposalDate, disposalNotes || '');
        if (!ok) return NextResponse.json({ error: 'Record not found' }, { status: 404 });
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

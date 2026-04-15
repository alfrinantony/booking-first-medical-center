export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { StockAdjustmentStore } from '@/lib/services-store';

export async function GET() {
    const records = await StockAdjustmentStore.getAll();
    return NextResponse.json(records);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { medicineId, medicineName, location, newQty, adjustedBy, reason } = body;
        if (!medicineId || !medicineName || location === undefined || newQty === undefined || !adjustedBy || !reason?.trim()) {
            return NextResponse.json({ error: 'medicineId, medicineName, location, newQty, adjustedBy and reason are all required' }, { status: 400 });
        }
        if (Number(newQty) < 0) return NextResponse.json({ error: 'Quantity cannot be negative' }, { status: 400 });
        const result = await StockAdjustmentStore.add({ medicineId, medicineName, location, newQty: Number(newQty), adjustedBy, reason });
        if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
        return NextResponse.json(result.record);
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

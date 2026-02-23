import { NextResponse } from 'next/server';
import { DistributionStore } from '@/lib/services-store';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const medicineId = searchParams.get('medicineId') || undefined;
    const clinicId = searchParams.get('clinicId') || undefined;
    const records = DistributionStore.getByFilters({ medicineId, clinicId });
    return NextResponse.json(records);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { medicineId, fromClinicId, toClinicId, quantity, distributedDate, notes } = body;

        if (!medicineId || !toClinicId || !quantity || !distributedDate) {
            return NextResponse.json({ error: 'medicineId, toClinicId, quantity, and distributedDate are required' }, { status: 400 });
        }

        if (fromClinicId && fromClinicId === toClinicId) {
            return NextResponse.json({ error: 'Source and destination branches must be different' }, { status: 400 });
        }

        const record = DistributionStore.add({
            medicineId,
            fromClinicId: fromClinicId || undefined,
            toClinicId,
            quantity: Number(quantity),
            distributedDate,
            notes: notes || undefined
        });

        if (!record) {
            return NextResponse.json({ error: 'Insufficient stock for transfer' }, { status: 400 });
        }

        return NextResponse.json(record);
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

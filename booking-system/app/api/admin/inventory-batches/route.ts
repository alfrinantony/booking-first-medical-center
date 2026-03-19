export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { InventoryBatchStore } from '@/lib/services-store';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const medicineId = searchParams.get('medicineId') || undefined;
    const registeredProductId = searchParams.get('registeredProductId') || undefined;
    const alertsOnly = searchParams.get('alerts') === 'true';
    const activeOnly = searchParams.get('active') === 'true';

    if (alertsOnly) {
        const alerts = await InventoryBatchStore.getAlerts();
        return NextResponse.json(alerts);
    }

    if (activeOnly && medicineId) {
        const batches = await InventoryBatchStore.getActiveBatches(medicineId);
        return NextResponse.json(batches);
    }

    if (medicineId) {
        const batches = await InventoryBatchStore.getByMedicine(medicineId);
        return NextResponse.json(batches);
    }

    if (registeredProductId) {
        const batches = await InventoryBatchStore.getByProduct(registeredProductId);
        return NextResponse.json(batches);
    }

    const batches = await InventoryBatchStore.getAll();
    return NextResponse.json(batches);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { batchId, quantity, clinicId } = body;

        if (!batchId || !quantity) {
            return NextResponse.json({ error: 'batchId and quantity are required' }, { status: 400 });
        }

        const result = await InventoryBatchStore.deductFromBatch(batchId, Number(quantity), clinicId);
        if (!result.success) {
            return NextResponse.json({ error: result.message }, { status: 400 });
        }
        return NextResponse.json(result);
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { PurchaseStore } from '@/lib/services-store';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const medicineId = searchParams.get('medicineId') || undefined;
    const supplierId = searchParams.get('supplierId') || undefined;
    const records = await PurchaseStore.getByFilters({ medicineId, supplierId });
    return NextResponse.json(records);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { supplierId, billNumber, purchaseDate, items, subtotal, taxAmount, totalAmount, chequeNumber, chequeDate, notes } = body;

        if (!supplierId || !billNumber || !purchaseDate || !items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: 'supplierId, billNumber, purchaseDate, and at least one item are required' }, { status: 400 });
        }

        // Validate each line item
        for (const item of items) {
            if (!item.medicineId || !item.quantity || item.quantity <= 0) {
                return NextResponse.json({ error: 'Each item must have a medicineId and quantity > 0' }, { status: 400 });
            }
        }

        const record = await PurchaseStore.add({
            supplierId,
            billNumber,
            purchaseDate,
            items: items.map((item: { medicineId: string; quantity: number; unitPrice: number; focQuantity?: number; batchNumber?: string; expiryDate?: string }) => ({
                medicineId: item.medicineId,
                quantity: Number(item.quantity),
                unitPrice: Number(item.unitPrice) || 0,
                focQuantity: item.focQuantity !== undefined ? Number(item.focQuantity) : 0,
                batchNumber: item.batchNumber || undefined,
                expiryDate: item.expiryDate || undefined,
            })),
            subtotal: Number(subtotal) || 0,
            taxAmount: taxAmount !== undefined ? Number(taxAmount) : 0,
            totalAmount: Number(totalAmount) || 0,
            chequeNumber: chequeNumber || undefined,
            chequeDate: chequeDate || undefined,
            notes: notes || undefined
        });
        return NextResponse.json(record);
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'Purchase record ID is required' }, { status: 400 });
        }
        const success = await PurchaseStore.remove(id);
        if (success) return NextResponse.json({ success: true });
        return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

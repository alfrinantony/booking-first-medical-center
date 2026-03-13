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
        const { supplierId, billNumber, purchaseDate, items, subtotal, taxAmount, totalAmount, chequeNumber, chequeDate, notes, invoiceFileBase64, invoiceFileName } = body;

        if (!supplierId || !billNumber || !purchaseDate || !items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: 'supplierId, billNumber, purchaseDate, and at least one item are required' }, { status: 400 });
        }

        for (const item of items) {
            if (!item.medicineId || !item.quantity || item.quantity <= 0) {
                return NextResponse.json({ error: 'Each item must have a medicineId and quantity > 0' }, { status: 400 });
            }
        }

        const record = await PurchaseStore.add({
            supplierId,
            billNumber,
            purchaseDate,
            items: items.map((item: { medicineId: string; registeredProductId?: string; quantity: number; unitPrice: number; focQuantity?: number; batchNumber?: string; expiryDate?: string }) => ({
                medicineId: item.medicineId,
                registeredProductId: item.registeredProductId || undefined,
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
            notes: notes || undefined,
            invoiceFileBase64: invoiceFileBase64 || undefined,
            invoiceFileName: invoiceFileName || undefined,
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

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, supplierId, billNumber, purchaseDate, items, subtotal, taxAmount, totalAmount, chequeNumber, chequeDate, notes, invoiceFileBase64, invoiceFileName } = body;

        if (!id) {
            return NextResponse.json({ error: 'Purchase record ID is required' }, { status: 400 });
        }

        const updates: Record<string, unknown> = {};
        if (supplierId !== undefined) updates.supplierId = supplierId;
        if (billNumber !== undefined) updates.billNumber = billNumber;
        if (purchaseDate !== undefined) updates.purchaseDate = purchaseDate;
        if (chequeNumber !== undefined) updates.chequeNumber = chequeNumber;
        if (chequeDate !== undefined) updates.chequeDate = chequeDate;
        if (notes !== undefined) updates.notes = notes;
        if (subtotal !== undefined) updates.subtotal = Number(subtotal) || 0;
        if (taxAmount !== undefined) updates.taxAmount = Number(taxAmount) || 0;
        if (totalAmount !== undefined) updates.totalAmount = Number(totalAmount) || 0;
        if (invoiceFileBase64 !== undefined) updates.invoiceFileBase64 = invoiceFileBase64;
        if (invoiceFileName !== undefined) updates.invoiceFileName = invoiceFileName;
        if (items && Array.isArray(items)) {
            updates.items = items.map((item: { medicineId: string; registeredProductId?: string; quantity: number; unitPrice: number; focQuantity?: number; batchNumber?: string; expiryDate?: string }) => ({
                medicineId: item.medicineId,
                registeredProductId: item.registeredProductId || undefined,
                quantity: Number(item.quantity),
                unitPrice: Number(item.unitPrice) || 0,
                focQuantity: item.focQuantity !== undefined ? Number(item.focQuantity) : 0,
                batchNumber: item.batchNumber || undefined,
                expiryDate: item.expiryDate || undefined,
            }));
        }

        const updated = await PurchaseStore.update(id, updates as any);
        if (!updated) return NextResponse.json({ error: 'Record not found' }, { status: 404 });
        return NextResponse.json(updated);
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { FurnitureStore } from '@/lib/furniture-store';

// ── GET — list furniture + optional history ──
export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const branchId = url.searchParams.get('branchId') || undefined;
        const status = url.searchParams.get('status') || undefined;
        const category = url.searchParams.get('category') || undefined;
        const historyFor = url.searchParams.get('historyFor') || undefined;

        if (historyFor) {
            const entries = await FurnitureStore.getHistory(historyFor);
            return NextResponse.json(entries);
        }

        const items = await FurnitureStore.getAll({ branchId, status, category });
        return NextResponse.json(items);
    } catch (err) {
        console.error('[Furniture GET]', err);
        return NextResponse.json({ error: 'Failed to load furniture' }, { status: 500 });
    }
}

// ── POST — add new furniture ──
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const item = await FurnitureStore.add({
            name: body.name || '',
            code: body.code || '',
            category: body.category || '',
            brand: body.brand || '',
            serialNumber: body.serialNumber || '',
            quantity: Number(body.quantity) || 1,
            branchId: body.branchId || '',
            purchaseDate: body.purchaseDate || '',
            warrantyExpiry: body.warrantyExpiry || '',
            status: body.status || 'active',
            assignedDepartment: body.assignedDepartment || '',
            notes: body.notes || '',
            lowStockThreshold: Number(body.lowStockThreshold) || 1,
            nextMaintenanceDate: body.nextMaintenanceDate || undefined,
        });
        return NextResponse.json(item);
    } catch (err) {
        console.error('[Furniture POST]', err);
        return NextResponse.json({ error: 'Failed to add furniture' }, { status: 500 });
    }
}

// ── PUT — update or transfer ──
export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();

        // Transfer mode
        if (body.action === 'transfer') {
            const result = await FurnitureStore.transfer(
                body.id,
                body.toBranchId,
                Number(body.quantity) || 1,
                body.notes
            );
            if (!result) {
                return NextResponse.json({ error: 'Transfer failed — item not found or insufficient quantity' }, { status: 400 });
            }
            return NextResponse.json(result);
        }

        // Normal update
        const { id, ...updates } = body;
        if (!id) {
            return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        }
        if (updates.quantity !== undefined) updates.quantity = Number(updates.quantity);
        if (updates.lowStockThreshold !== undefined) updates.lowStockThreshold = Number(updates.lowStockThreshold);
        const updated = await FurnitureStore.update(id, updates);
        if (!updated) {
            return NextResponse.json({ error: 'Furniture not found' }, { status: 404 });
        }
        return NextResponse.json(updated);
    } catch (err) {
        console.error('[Furniture PUT]', err);
        return NextResponse.json({ error: 'Failed to update furniture' }, { status: 500 });
    }
}

// ── DELETE ──
export async function DELETE(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const id = url.searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        }
        const ok = await FurnitureStore.delete(id);
        return NextResponse.json({ success: ok });
    } catch (err) {
        console.error('[Furniture DELETE]', err);
        return NextResponse.json({ error: 'Failed to delete furniture' }, { status: 500 });
    }
}

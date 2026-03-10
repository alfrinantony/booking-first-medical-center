import { NextResponse } from 'next/server';
import { MedicineStore } from '@/lib/services-store';

export async function GET() {
    return NextResponse.json(await MedicineStore.getMedicines());
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, price, centralStock, branchStock, expiryDate, category, minCentralStock, itemCode, purchaseUnit, itemsPerPurchaseUnit, consumableUnit } = body;

        if (!name || price === undefined) {
            return NextResponse.json({ error: 'Name and price are required' }, { status: 400 });
        }

        const medicine = await MedicineStore.addMedicine({
            name,
            price: Number(price),
            centralStock: centralStock !== undefined ? Number(centralStock) : 0,
            branchStock: branchStock || [],
            expiryDate: expiryDate || undefined,
            category: category || 'medicine',
            minCentralStock: minCentralStock !== undefined ? Number(minCentralStock) : undefined,
            itemCode: itemCode || undefined,
            purchaseUnit: purchaseUnit || undefined,
            itemsPerPurchaseUnit: itemsPerPurchaseUnit !== undefined ? Number(itemsPerPurchaseUnit) : undefined,
            consumableUnit: consumableUnit || undefined
        });
        return NextResponse.json(medicine);
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Medicine ID is required' }, { status: 400 });
        }

        if (updates.price !== undefined) {
            updates.price = Number(updates.price);
        }
        if (updates.centralStock !== undefined) {
            updates.centralStock = Number(updates.centralStock);
        }
        if (updates.minCentralStock !== undefined) {
            updates.minCentralStock = updates.minCentralStock === '' ? undefined : Number(updates.minCentralStock);
        }

        const updated = await MedicineStore.updateMedicine(id, updates);
        if (updated) {
            return NextResponse.json(updated);
        }
        return NextResponse.json({ error: 'Medicine not found' }, { status: 404 });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Medicine ID is required' }, { status: 400 });
        }

        const success = await MedicineStore.removeMedicine(id);
        if (success) {
            return NextResponse.json({ success: true });
        }
        return NextResponse.json({ error: 'Medicine not found' }, { status: 404 });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

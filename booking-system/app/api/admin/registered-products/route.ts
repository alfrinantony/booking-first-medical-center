import { NextResponse } from 'next/server';
import { RegisteredProductStore } from '@/lib/services-store';

export async function GET() {
    return NextResponse.json(await RegisteredProductStore.getAll());
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { tradeName, genericName, itemCode } = body;
        if (!tradeName || !genericName || !itemCode) {
            return NextResponse.json({ error: 'Trade name, generic name, and item code are required' }, { status: 400 });
        }
        const product = await RegisteredProductStore.add(body);
        return NextResponse.json(product);
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, ...updates } = body;
        if (!id) {
            return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
        }
        const updated = await RegisteredProductStore.update(id, updates);
        if (updated) return NextResponse.json(updated);
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
        }
        const success = await RegisteredProductStore.remove(id);
        if (success) return NextResponse.json({ success: true });
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

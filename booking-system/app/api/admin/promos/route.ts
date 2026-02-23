import { NextResponse } from 'next/server';
import { PromoStore } from '@/lib/promo-store';

export async function GET() {
    return NextResponse.json(PromoStore.getAll());
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { code, discountType, discountValue, applicableServiceIds, active } = body;

        if (!code || !discountType || discountValue === undefined) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const newPromo = PromoStore.add({
            code,
            discountType,
            discountValue: Number(discountValue),
            applicableServiceIds: applicableServiceIds || [],
            active: active !== undefined ? active : true
        });

        return NextResponse.json(newPromo);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create promo code' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        const updatedPromo = PromoStore.update(id, updates);

        if (!updatedPromo) {
            return NextResponse.json({ error: 'Promo code not found' }, { status: 404 });
        }

        return NextResponse.json(updatedPromo);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update promo code' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        const success = PromoStore.delete(id);

        if (!success) {
            return NextResponse.json({ error: 'Promo code not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete promo code' }, { status: 500 });
    }
}

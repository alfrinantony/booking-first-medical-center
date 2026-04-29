import { NextResponse } from 'next/server';
import { CategoryOrderStore } from '@/lib/services-store';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { order } = body;

        if (!Array.isArray(order)) {
            return NextResponse.json({ error: 'Order must be an array of strings' }, { status: 400 });
        }

        await CategoryOrderStore.set(order);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

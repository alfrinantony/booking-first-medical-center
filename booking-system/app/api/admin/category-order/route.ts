import { NextResponse } from 'next/server';
import { CategoryOrderStore } from '@/lib/services-store';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request: Request) {
    try {
        const order = await CategoryOrderStore.get();
        return NextResponse.json(order);
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

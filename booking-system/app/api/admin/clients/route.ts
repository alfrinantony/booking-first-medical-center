export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { ClientsStore } from '@/lib/clients-store';

export async function GET(request: NextRequest) {
    try {
        const clients = await ClientsStore.getAll();
        return NextResponse.json(clients);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

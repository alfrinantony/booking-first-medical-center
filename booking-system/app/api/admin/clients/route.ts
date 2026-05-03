export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { ClientsStore } from '@/lib/clients-store';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '50', 10);
        const search = searchParams.get('search') || '';
        
        // Check if we want the paginated version
        if (searchParams.has('page') || searchParams.has('limit')) {
            const data = await ClientsStore.getPage(page, limit, search);
            return NextResponse.json(data);
        }

        // Fallback for legacy requests (will be removed once fully migrated)
        const clients = await ClientsStore.getAll();
        return NextResponse.json(clients);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const clientId = body.id || `client_${Date.now()}`;
        await ClientsStore.update(clientId, body);
        return NextResponse.json({ success: true, clientId });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

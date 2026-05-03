import { NextRequest, NextResponse } from 'next/server';
import { ClientsStore } from '@/lib/clients-store';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { targetClientId, sourceClientIds } = body;
        
        if (!targetClientId || !Array.isArray(sourceClientIds)) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        const results = [];
        for (const src of sourceClientIds) {
            if (src !== targetClientId) {
                const success = await ClientsStore.merge(targetClientId, src);
                results.push({ src, success });
            }
        }

        return NextResponse.json({ success: true, results });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

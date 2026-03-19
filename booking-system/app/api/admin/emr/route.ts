export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { EMRStore } from '@/lib/emr-store';

export async function GET() {
    const config = await EMRStore.getConfig();
    return NextResponse.json(config);
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { action } = body;

    switch (action) {
        case 'updateConfig':
            await EMRStore.updateConfig(body.updates);
            return NextResponse.json({ success: true });
        case 'testConnection':
            const result = await EMRStore.testConnection();
            return NextResponse.json(result);
        case 'setPushStatus':
            await EMRStore.setPushStatus(body.clientId, body.record);
            return NextResponse.json({ success: true });
        case 'getPushStatus':
            const record = await EMRStore.getPushStatus(body.clientId);
            return NextResponse.json(record || null);
        default:
            return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
}

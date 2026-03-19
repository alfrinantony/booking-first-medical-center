export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { RestrictionsStore } from '@/lib/restrictions-store';

export async function GET() {
    const state = await RestrictionsStore.getState();
    return NextResponse.json(state);
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { action } = body;

    switch (action) {
        case 'setPeakConfig':
            await RestrictionsStore.setPeakConfig(body.days, body.slots);
            return NextResponse.json({ success: true });
        case 'setNoShowRestrictionDays':
            await RestrictionsStore.setNoShowRestrictionDays(body.days);
            return NextResponse.json({ success: true });
        case 'recordNoShow':
            await RestrictionsStore.recordNoShow(body.clientId);
            return NextResponse.json({ success: true });
        case 'setNoShowExempt':
            await RestrictionsStore.setNoShowExempt(body.clientId, body.exempt);
            return NextResponse.json({ success: true });
        case 'setVoiceAgentBlocked':
            await RestrictionsStore.setVoiceAgentBlocked(body.clientId, body.blocked);
            return NextResponse.json({ success: true });
        case 'isSlotRestricted':
            const restricted = await RestrictionsStore.isSlotRestricted(body.clientId, new Date(body.date), body.slot, body.serviceId);
            return NextResponse.json({ restricted });
        case 'isVoiceBlocked':
            const blocked = await RestrictionsStore.isVoiceBlocked(body.clientId);
            return NextResponse.json({ blocked });
        default:
            return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
}

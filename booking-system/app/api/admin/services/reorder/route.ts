import { NextResponse } from 'next/server';
import { ServicesStore } from '@/lib/services-store';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { updates } = body; // Array of { serviceId: string, order: number }

        if (!Array.isArray(updates)) {
            return NextResponse.json({ error: 'Updates must be an array' }, { status: 400 });
        }

        // Apply global updates to all services mentioned
        for (const update of updates) {
            await ServicesStore.updateServiceGlobally(update.serviceId, { order: update.order });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

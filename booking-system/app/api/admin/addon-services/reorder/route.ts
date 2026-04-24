export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { AddonServicesStore } from '@/lib/addon-services-store';

/** POST /api/admin/addon-services/reorder  body: { ids: string[] } */
export async function POST(req: Request) {
    try {
        const { ids } = await req.json() as { ids: string[] };
        if (!Array.isArray(ids)) return NextResponse.json({ error: 'ids must be an array' }, { status: 400 });
        const all = await AddonServicesStore.getAll();
        // Rebuild array in the requested order, appending any missing ids at the end
        const idSet = new Set(ids);
        const ordered = [
            ...ids.map(id => all.find(a => a.id === id)).filter(Boolean),
            ...all.filter(a => !idSet.has(a.id)),
        ] as typeof all;
        await AddonServicesStore.saveOrder(ordered);
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: 'Reorder failed' }, { status: 500 });
    }
}

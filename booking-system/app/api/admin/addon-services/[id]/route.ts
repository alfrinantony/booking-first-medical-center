export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { AddonServicesStore } from '@/lib/addon-services-store';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    const data = await req.json();
    const updated = await AddonServicesStore.update(params.id, data);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
    const ok = await AddonServicesStore.delete(params.id);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
}

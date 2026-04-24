export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { SimplybookStore } from '@/lib/simplybook-store';

/** PATCH /api/admin/simplybook/[sbId]  — update client info on a SimplyBook record */
export async function PATCH(
    req: Request,
    { params }: { params: { sbId: string } }
) {
    try {
        const { sbId } = params;
        const body = await req.json() as { clientName?: string; clientPhone?: string; clientEmail?: string };
        const record = await SimplybookStore.getById(sbId);
        if (!record) return NextResponse.json({ error: 'Record not found' }, { status: 404 });

        const updated = await SimplybookStore.upsert({
            ...record,
            ...(body.clientName  !== undefined && { clientName:  body.clientName.trim() }),
            ...(body.clientPhone !== undefined && { clientPhone: body.clientPhone.trim() }),
            ...(body.clientEmail !== undefined && { clientEmail: body.clientEmail.trim() }),
        });
        return NextResponse.json(updated);
    } catch {
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
}

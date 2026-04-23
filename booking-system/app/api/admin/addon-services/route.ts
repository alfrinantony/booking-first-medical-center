export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { AddonServicesStore } from '@/lib/addon-services-store';

export async function GET() {
    const addons = await AddonServicesStore.getAll();
    return NextResponse.json(addons);
}

export async function POST(req: Request) {
    const data = await req.json();
    const { name, group, defaultPrice, linkedConsumables, isActive } = data;
    if (!name || !group || defaultPrice === undefined) {
        return NextResponse.json({ error: 'name, group and defaultPrice are required' }, { status: 400 });
    }
    const addon = await AddonServicesStore.create({
        name: String(name).trim(),
        group: String(group).trim(),
        defaultPrice: Number(defaultPrice),
        linkedConsumables: Array.isArray(linkedConsumables) ? linkedConsumables : [],
        isActive: isActive !== false,
    });
    return NextResponse.json(addon, { status: 201 });
}

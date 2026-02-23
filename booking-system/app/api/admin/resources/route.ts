import { NextResponse } from 'next/server';
import { ResourcesStore } from '@/lib/resources-store';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const clinicId = searchParams.get('clinicId');

    // Convert null to undefined if not present, though store handles it
    const resources = ResourcesStore.getResources(clinicId || undefined);
    return NextResponse.json(resources);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        if (!body.name || !body.clinicId || !body.totalQuantity) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const newResource = ResourcesStore.addResource(body);
        return NextResponse.json(newResource);
    } catch (error) {
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
        }

        const updated = ResourcesStore.updateResource(id, updates);
        if (!updated) {
            return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
        }

        return NextResponse.json(updated);
    } catch (error) {
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
    }

    const deleted = ResourcesStore.deleteResource(id);
    if (!deleted) {
        return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
}

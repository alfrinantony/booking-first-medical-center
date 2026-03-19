export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { CallAgentSummaryStore } from '@/lib/call-agent-summary-store';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const branch = searchParams.get('branch');

    let summaries = await CallAgentSummaryStore.getAll();

    if (branch) {
        summaries = summaries.filter(s => s.branch === branch);
    }

    return NextResponse.json(summaries);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { customerId, customerName, customerNumber, summary } = body;

        if (!customerId || !customerName || !customerNumber || !summary) {
            return NextResponse.json(
                { error: 'Required fields: customerId, customerName, customerNumber, summary' },
                { status: 400 }
            );
        }

        const record = await CallAgentSummaryStore.add({
            ...body,
            callDuration: Number(body.callDuration) || 0,
            timestamp: body.timestamp || new Date().toISOString(),
        });

        return NextResponse.json(record);
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Summary ID is required' }, { status: 400 });
        }

        if (updates.callDuration) updates.callDuration = Number(updates.callDuration);

        const updated = await CallAgentSummaryStore.update(id, updates);
        if (!updated) {
            return NextResponse.json({ error: 'Summary not found' }, { status: 404 });
        }

        return NextResponse.json(updated);
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Summary ID is required' }, { status: 400 });
        }

        const success = await CallAgentSummaryStore.remove(id);
        if (!success) {
            return NextResponse.json({ error: 'Summary not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

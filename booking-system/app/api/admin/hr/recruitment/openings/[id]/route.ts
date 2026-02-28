import { NextResponse } from 'next/server';
import { RecruitmentStore } from '@/lib/hr-recruitment-store';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const opening = RecruitmentStore.getOpeningById(id);
    if (!opening) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(opening);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const body = await request.json();
        const updated = RecruitmentStore.updateOpening(id, body);
        if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json(updated);
    } catch {
        return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const deleted = RecruitmentStore.deleteOpening(id);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
}

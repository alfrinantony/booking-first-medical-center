export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { RecruitmentStore } from '@/lib/hr-recruitment-store';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const candidate = await RecruitmentStore.getCandidateById(id);
    if (!candidate) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(candidate);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const body = await request.json();
        const updated = await RecruitmentStore.updateCandidate(id, body);
        if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json(updated);
    } catch {
        return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const deleted = await RecruitmentStore.deleteCandidate(id);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
}

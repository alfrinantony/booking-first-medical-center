import { NextResponse } from 'next/server';
import { RecruitmentStore } from '@/lib/hr-recruitment-store';
import type { RecruitmentStage } from '@/lib/hr-recruitment-store';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const openingId = searchParams.get('openingId') || undefined;
    const stage = searchParams.get('stage') as RecruitmentStage | null;
    const search = searchParams.get('search') || undefined;

    const candidates = await RecruitmentStore.getAllCandidates({
        openingId,
        stage: stage || undefined,
        search,
    });
    return NextResponse.json(candidates);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const candidate = await RecruitmentStore.addCandidate(body);
        return NextResponse.json(candidate, { status: 201 });
    } catch {
        return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }
}

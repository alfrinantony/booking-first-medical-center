export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { RecruitmentStore } from '@/lib/hr-recruitment-store';
import type { OpeningStatus } from '@/lib/hr-recruitment-store';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as OpeningStatus | null;
    const search = searchParams.get('search') || undefined;

    const openings = await RecruitmentStore.getAllOpenings({
        status: status || undefined,
        search,
    });
    return NextResponse.json(openings);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const opening = await RecruitmentStore.addOpening(body);
        return NextResponse.json(opening, { status: 201 });
    } catch {
        return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }
}

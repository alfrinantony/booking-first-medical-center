export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { HREosStore } from '@/lib/hr-eos-store';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');

    if (!employeeId) {
        return NextResponse.json({ error: 'Missing employeeId' }, { status: 400 });
    }

    try {
        const record = await HREosStore.getForEmployee(employeeId);
        if (!record) {
            return NextResponse.json({ found: false });
        }
        return NextResponse.json({ found: true, record });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Failed to fetch EOS record' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { employeeId, calculation } = body;

        if (!employeeId || !calculation) {
            return NextResponse.json({ error: 'Missing employeeId or calculation payload' }, { status: 400 });
        }

        const saved = await HREosStore.save(employeeId, calculation);
        return NextResponse.json({ success: true, record: saved });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Failed to save EOS record' }, { status: 500 });
    }
}

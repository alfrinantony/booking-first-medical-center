export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { AccountingStore } from '@/lib/accounting-store';

export async function GET() {
    return NextResponse.json({ payables: await AccountingStore.getAllPayables(), receivables: await AccountingStore.getAllReceivables() });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        if (body._type === 'receivable') {
            delete body._type;
            const r = await AccountingStore.addReceivable(body);
            return NextResponse.json(r, { status: 201 });
        } else {
            delete body._type;
            const p = await AccountingStore.addPayable(body);
            return NextResponse.json(p, { status: 201 });
        }
    } catch {
        return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }
}

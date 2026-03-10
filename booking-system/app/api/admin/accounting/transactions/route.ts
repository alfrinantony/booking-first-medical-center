import { NextResponse } from 'next/server';
import { AccountingStore } from '@/lib/accounting-store';
import type { TransactionType } from '@/lib/accounting-store';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as TransactionType | null;
    const accountId = searchParams.get('accountId') || undefined;
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;
    const search = searchParams.get('search') || undefined;
    const branchId = searchParams.get('branchId') || undefined;
    const txns = await AccountingStore.getAllTransactions({
        type: type || undefined, accountId, dateFrom, dateTo, search, branchId,
    });
    return NextResponse.json(txns);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const txn = await AccountingStore.addTransaction(body);
        return NextResponse.json(txn, { status: 201 });
    } catch {
        return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }
}

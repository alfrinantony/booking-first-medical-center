export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { AccountingStore } from '@/lib/accounting-store';
import type { AccountType } from '@/lib/accounting-store';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as AccountType | null;
    const search = searchParams.get('search') || undefined;
    const active = searchParams.has('active') ? searchParams.get('active') === 'true' : undefined;
    const accounts = await AccountingStore.getAllAccounts({ type: type || undefined, search, active });
    return NextResponse.json(accounts);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const account = await AccountingStore.addAccount(body);
        return NextResponse.json(account, { status: 201 });
    } catch {
        return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }
}

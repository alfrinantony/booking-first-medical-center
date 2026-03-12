import { NextRequest, NextResponse } from 'next/server';
import { LogsStore } from '@/lib/logs-store';

export async function GET() {
    const logs = await LogsStore.getAll();
    return NextResponse.json(logs);
}

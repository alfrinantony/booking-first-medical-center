export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
    try {
        const clients = await prisma.client.findMany({ take: 1 });
        return NextResponse.json({ ok: true, count: clients.length });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: String(error), stack: error.stack }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

let dbUrl = process.env.DATABASE_URL || '';
if (dbUrl.includes(':6543')) {
    dbUrl = dbUrl.replace(':6543', ':5432').replace('?pgbouncer=true', '').replace('&pgbouncer=true', '');
}
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: dbUrl
        }
    }
});

export async function GET() {
    try {
        const clients = await prisma.client.findMany({ take: 1 });
        return NextResponse.json({ ok: true, count: clients.length });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: String(error), stack: error.stack }, { status: 500 });
    }
}

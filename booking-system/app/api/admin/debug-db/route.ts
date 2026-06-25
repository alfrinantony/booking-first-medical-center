export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

async function testConnection(url: string) {
    const start = Date.now();
    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: url
            }
        }
    });
    try {
        await prisma.$connect();
        const count = await prisma.client.count();
        return { ok: true, count, elapsedMs: Date.now() - start };
    } catch (err: any) {
        return { ok: false, error: err.message, elapsedMs: Date.now() - start };
    } finally {
        await prisma.$disconnect();
    }
}

export async function GET() {
    const baseDbUrl = process.env.DATABASE_URL || '';
    if (!baseDbUrl) {
        return NextResponse.json({ ok: false, error: 'DATABASE_URL is not set' });
    }

    // Add connect_timeout=5 to prevent hanging
    const addTimeout = (url: string) => {
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}connect_timeout=5`;
    };

    // 1. Port 6543 (as configured in prod)
    const url6543 = addTimeout(baseDbUrl);

    // 2. Port 5432 (rewritten)
    let url5432 = baseDbUrl;
    if (url5432.includes(':6543')) {
        url5432 = url5432.replace(':6543', ':5432').replace('?pgbouncer=true', '').replace('&pgbouncer=true', '');
    }
    url5432 = addTimeout(url5432);

    const result6543 = await testConnection(url6543);
    const result5432 = await testConnection(url5432);

    return NextResponse.json({
        dbUrl6543_hidden: url6543.replace(/:[^:@]+@/, ':***@'),
        dbUrl5432_hidden: url5432.replace(/:[^:@]+@/, ':***@'),
        result6543,
        result5432
    });
}

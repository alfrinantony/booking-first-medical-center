export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

async function runStep(label: string, fn: () => Promise<any>) {
    const start = Date.now();
    try {
        const result = await fn();
        return { ok: true, elapsedMs: Date.now() - start, summary: JSON.stringify(result).substring(0, 200) };
    } catch (err: any) {
        return { ok: false, elapsedMs: Date.now() - start, error: err.message };
    }
}

export async function GET() {
    const baseDbUrl = process.env.DATABASE_URL || '';
    if (!baseDbUrl) {
        return NextResponse.json({ ok: false, error: 'DATABASE_URL is not set' });
    }

    // Rewrite to port 5432 for testing
    let url5432 = baseDbUrl;
    if (url5432.includes(':6543')) {
        url5432 = url5432.replace(':6543', ':5432').replace('?pgbouncer=true', '').replace('&pgbouncer=true', '');
    }
    const separator = url5432.includes('?') ? '&' : '?';
    const testUrl = `${url5432}${separator}connect_timeout=5`;

    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: testUrl
            }
        }
    });

    const step1 = await runStep('1. count()', () => prisma.booking.count());
    const step2 = await runStep('2. findMany(select id, take 1)', () => prisma.booking.findMany({ select: { id: true }, take: 1 }));
    const step3 = await runStep('3. findMany(take 1)', () => prisma.booking.findMany({ take: 1 }));
    const step4 = await runStep('4. findMany(date filter, take 5)', () => prisma.booking.findMany({
        where: { date: '2026-06-25' },
        take: 5
    }));

    await prisma.$disconnect();

    return NextResponse.json({
        dbUrl_hidden: testUrl.replace(/:[^:@]+@/, ':***@'),
        step1,
        step2,
        step3,
        step4
    });
}

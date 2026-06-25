export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

async function runStep(label: string, fn: () => Promise<any>) {
    const start = Date.now();
    try {
        const result = await fn();
        return { ok: true, elapsedMs: Date.now() - start, summary: `Found ${result.length} records. Size: ${JSON.stringify(result).length} chars` };
    } catch (err: any) {
        return { ok: false, elapsedMs: Date.now() - start, error: err.message };
    }
}

export async function GET() {
    const baseDbUrl = process.env.DATABASE_URL || '';
    if (!baseDbUrl) {
        return NextResponse.json({ ok: false, error: 'DATABASE_URL is not set' });
    }

    let url5432 = baseDbUrl;
    if (url5432.includes(':6543')) {
        url5432 = url5432.replace(':6543', ':5432').replace('?pgbouncer=true', '').replace('&pgbouncer=true', '');
    }
    const testUrl = `${url5432}${url5432.includes('?') ? '&' : '?'}connect_timeout=5`;

    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: testUrl
            }
        }
    });

    // Test 1: Single day range query WITHOUT orderBy
    const step1 = await runStep('1. Range query single day NO orderBy', () => prisma.booking.findMany({
        where: {
            date: {
                gte: '2026-06-25',
                lte: '2026-06-25'
            }
        },
        take: 2000
    }));

    // Test 2: Single day range query WITH orderBy
    const step2 = await runStep('2. Range query single day WITH orderBy', () => prisma.booking.findMany({
        where: {
            date: {
                gte: '2026-06-25',
                lte: '2026-06-25'
            }
        },
        orderBy: { date: 'desc' },
        take: 2000
    }));

    // Test 3: 5-month range query WITHOUT orderBy
    const step3 = await runStep('3. Range query 5 months NO orderBy', () => prisma.booking.findMany({
        where: {
            date: {
                gte: '2026-05-01',
                lte: '2026-09-30'
            }
        },
        take: 2000
    }));

    // Test 4: 5-month range query WITH orderBy
    const step4 = await runStep('4. Range query 5 months WITH orderBy', () => prisma.booking.findMany({
        where: {
            date: {
                gte: '2026-05-01',
                lte: '2026-09-30'
            }
        },
        orderBy: { date: 'desc' },
        take: 2000
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

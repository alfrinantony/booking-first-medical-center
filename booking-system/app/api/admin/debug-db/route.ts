export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

async function testBookingQuery(url: string) {
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
        const startQuery = Date.now();
        const bookings = await prisma.booking.findMany({
            where: {
                date: {
                    gte: '2026-06-25',
                    lte: '2026-06-25'
                }
            },
            orderBy: { date: 'desc' },
            take: 2000
        });
        return { 
            ok: true, 
            count: bookings.length, 
            connectMs: startQuery - start,
            queryMs: Date.now() - startQuery,
            totalMs: Date.now() - start
        };
    } catch (err: any) {
        return { ok: false, error: err.message, totalMs: Date.now() - start };
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

    const queryResult6543 = await testBookingQuery(url6543);
    const queryResult5432 = await testBookingQuery(url5432);

    return NextResponse.json({
        dbUrl6543_hidden: url6543.replace(/:[^:@]+@/, ':***@'),
        dbUrl5432_hidden: url5432.replace(/:[^:@]+@/, ':***@'),
        queryResult6543,
        queryResult5432
    });
}

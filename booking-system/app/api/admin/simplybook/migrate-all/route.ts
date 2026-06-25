/**
 * POST /api/admin/simplybook/migrate-all
 *
 * Imports ALL SimplyBook bookings from a given start year to today
 * into the internal BookingsStore. Processes data in monthly chunks
 * to avoid SimplyBook API timeouts and the existing 45-day cap.
 *
 * Body: { startYear?: number }   default: 2020
 *
 * Response:
 * {
 *   ok: true,
 *   chunksProcessed: number,
 *   totalMigrated: number,
 *   totalSkipped: number,
 *   totalMatched: number,
 *   totalUnmatched: number,
 *   errors: string[],
 *   chunks: ChunkResult[]
 * }
 */
export const dynamic = 'force-dynamic';
// Increase max execution time — large historical imports can take time
export const maxDuration = 300; // seconds (Vercel Pro / Azure)

import { NextResponse } from 'next/server';

interface ChunkResult {
    from: string;
    to: string;
    migrated: number;
    skipped: number;
    matched: number;
    unmatched: number;
    error?: string;
}

/** Generate [from, to] pairs in monthly chunks */
function buildMonthlyChunks(startYear: number): Array<{ from: string; to: string }> {
    const chunks: Array<{ from: string; to: string }> = [];
    const today = new Date();
    const startDate = new Date(`${startYear}-01-01`);

    let cursor = new Date(startDate);
    while (cursor <= today) {
        const from = cursor.toISOString().split('T')[0];

        // Last day of this month
        const endOfMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
        const to = (endOfMonth <= today ? endOfMonth : today).toISOString().split('T')[0];

        chunks.push({ from, to });

        // Move to first day of next month
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return chunks;
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({})) as { startYear?: number };
        const startYear = Math.max(2015, Math.min(2030, Number(body.startYear) || 2020));

        const chunks = buildMonthlyChunks(startYear);
        console.log(`[MigrateAll] Starting all-time migration from ${startYear}. ${chunks.length} monthly chunks.`);

        let totalMigrated = 0;
        let totalSkipped = 0;
        let totalMatched = 0;
        let totalUnmatched = 0;
        const errors: string[] = [];
        const chunkResults: ChunkResult[] = [];

        // Process chunks SEQUENTIALLY to respect SimplyBook rate limits
        for (const chunk of chunks) {
            try {
                // Reuse existing migrate logic by calling it internally
                const { getAdminBookings, getServiceList, getProviderList, getInvoiceList } = await import('@/lib/simplybook-client');
                const { SimplybookStore } = await import('@/lib/simplybook-store');
                const { BookingsStore } = await import('@/lib/bookings-store');
                const { ServicesStore } = await import('@/lib/services-store');

                console.log(`[MigrateAll] Chunk ${chunk.from} → ${chunk.to}`);

                const [sbBookings, services, providers, clinics, invoices] = await Promise.all([
                    getAdminBookings(chunk.from, chunk.to),
                    getServiceList(),
                    getProviderList(),
                    ServicesStore.getClinics(),
                    getInvoiceList(chunk.from, chunk.to),
                ]);

                if (sbBookings.length === 0) {
                    chunkResults.push({ ...chunk, migrated: 0, skipped: 0, matched: 0, unmatched: 0 });
                    continue;
                }

                // ── Call the internal migrate route with the fetched data ──
                // Instead of duplicating all mapping logic, call our internal migrate API
                const migrateUrl = new URL('/api/admin/simplybook', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
                migrateUrl.searchParams.set('migrate', 'true');
                migrateUrl.searchParams.set('from', chunk.from);
                migrateUrl.searchParams.set('to', chunk.to);

                const res = await fetch(migrateUrl.toString());
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
                }
                const data = await res.json();

                const result: ChunkResult = {
                    from: chunk.from,
                    to: chunk.to,
                    migrated: data.migrated || 0,
                    skipped: data.skipped || 0,
                    matched: data.matched || 0,
                    unmatched: data.unmatched || 0,
                };
                chunkResults.push(result);

                totalMigrated += result.migrated;
                totalSkipped += result.skipped;
                totalMatched += result.matched;
                totalUnmatched += result.unmatched;

                // Small delay to avoid rate limiting
                await new Promise(r => setTimeout(r, 500));

            } catch (err) {
                const errMsg = `${chunk.from}→${chunk.to}: ${String(err).substring(0, 200)}`;
                console.error(`[MigrateAll] Chunk error: ${errMsg}`);
                errors.push(errMsg);
                chunkResults.push({ ...chunk, migrated: 0, skipped: 0, matched: 0, unmatched: 0, error: errMsg });
            }
        }

        console.log(`[MigrateAll] Complete. Migrated: ${totalMigrated}, Skipped: ${totalSkipped}, Errors: ${errors.length}`);

        return NextResponse.json({
            ok: true,
            startYear,
            chunksProcessed: chunks.length,
            chunksWithErrors: errors.length,
            totalMigrated,
            totalSkipped,
            totalMatched,
            totalUnmatched,
            errors: errors.length > 0 ? errors : undefined,
            chunks: chunkResults,
        });

    } catch (err) {
        console.error('[MigrateAll] Fatal error:', err);
        return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
    }
}

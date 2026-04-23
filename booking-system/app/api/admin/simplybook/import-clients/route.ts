/**
 * POST /api/admin/simplybook/import-clients
 *
 * Fetches all clients from SimplyBook's getClientList API, enriches each
 * client with their full booking history (count + visit dates), then
 * upserts them into the app's ClientsStore.
 *
 * Booking history window: 2 years back → 3 months ahead.
 *
 * Response: { total, imported, updated, skipped }
 */
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAdminClientList, getAdminBookings } from '@/lib/simplybook-client';
import { ClientsStore } from '@/lib/clients-store';

export async function POST() {
    try {
        // ── 1. Fetch client list ──
        const sbClients = await getAdminClientList();
        console.log(`[SB import-clients] Fetched ${sbClients.length} clients`);

        // ── 2. Fetch booking history (wide window for full visit history) ──
        const twoYearsAgo  = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const threeMonthsAhead = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        let allBookings: Awaited<ReturnType<typeof getAdminBookings>> = [];
        try {
            allBookings = await getAdminBookings(twoYearsAgo, threeMonthsAhead, 1000, 0);
            console.log(`[SB import-clients] Fetched ${allBookings.length} bookings for enrichment`);
        } catch (bookingErr) {
            console.warn('[SB import-clients] Could not fetch bookings for enrichment:', String(bookingErr).substring(0, 200));
        }

        // ── 3. Build booking map keyed by SB client_id ──
        const bookingMap = new Map<string, { dates: string[]; count: number }>();
        for (const booking of allBookings) {
            const clientId =
                String(booking.client_id || booking.client?.id || '').trim();
            if (!clientId) continue;

            if (!bookingMap.has(clientId)) bookingMap.set(clientId, { dates: [], count: 0 });
            const entry = bookingMap.get(clientId)!;

            // Extract the date from start_date_time (supports "YYYY-MM-DD HH:MM:SS" and ISO)
            const startStr = booking.start_date_time || '';
            const visitDate = startStr.split('T')[0].split(' ')[0]; // "YYYY-MM-DD"
            if (visitDate && /^\d{4}-\d{2}-\d{2}$/.test(visitDate)) {
                entry.dates.push(visitDate);
            }
            entry.count++;
        }

        // ── 4. Import / upsert each client ──
        let imported = 0;
        let updated  = 0;
        let skipped  = 0;

        for (const sbClient of sbClients) {
            const id = String(sbClient.id);
            const name =
                sbClient.name ||
                (sbClient.fname ? `${sbClient.fname} ${sbClient.lname || ''}`.trim() : '') ||
                `SB Client #${id}`;

            const phone = typeof sbClient.phone === 'string' ? sbClient.phone.trim() : '';
            const email = typeof sbClient.email === 'string' ? sbClient.email.trim() : '';

            if (!name || (!phone && !email)) { skipped++; continue; }

            // Booking enrichment
            const bookingData = bookingMap.get(id) ?? { dates: [], count: 0 };
            // Sort descending so [0] = most recent
            const sortedDates = [...new Set(bookingData.dates)].sort((a, b) => b.localeCompare(a));
            const lastVisit   = sortedDates[0];

            const result = await ClientsStore.upsertStandalone({
                id: `sb-client-${id}`,
                name,
                phone:          phone || undefined,
                mobile:         phone || undefined,
                email:          email || undefined,
                source:         'simplybook',
                sbClientId:     id,
                totalBookings:  bookingData.count,
                lastBookingDate: lastVisit,
                visitDates:     sortedDates.length > 0 ? sortedDates : undefined,
                bookingIds:     [],
            });

            if      (result === 'imported') imported++;
            else if (result === 'updated')  updated++;
            else                            skipped++;
        }

        const msg = `imported=${imported}, updated=${updated}, skipped=${skipped}`;
        console.log(`[SB import-clients] Done: total=${sbClients.length}, ${msg}`);

        return NextResponse.json({
            ok: true,
            total:      sbClients.length,
            imported,
            updated,
            skipped,
            bookingsFetched: allBookings.length,
            importedAt: new Date().toISOString(),
        });
    } catch (err) {
        console.error('[SB import-clients] failed:', err);
        return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
    }
}

/**
 * POST /api/admin/simplybook/import-clients
 *
 * Fetches all clients from SimplyBook's getClientList API and imports them
 * into the app's ClientsStore as "standalone" (booking-less) clients.
 * Existing clients (matched by phone or email) are skipped.
 *
 * Response: { total, imported, skipped }
 */
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAdminClientList } from '@/lib/simplybook-client';
import { ClientsStore } from '@/lib/clients-store';

export async function POST() {
    try {
        const sbClients = await getAdminClientList();
        console.log(`[SimplyBook import-clients] Fetched ${sbClients.length} clients from SimplyBook`);

        let imported = 0;
        let skipped = 0;

        for (const sbClient of sbClients) {
            const id = String(sbClient.id);
            const name =
                sbClient.name ||
                (sbClient.fname ? `${sbClient.fname} ${sbClient.lname || ''}`.trim() : '') ||
                `SB Client #${id}`;

            const phone = typeof sbClient.phone === 'string' ? sbClient.phone.trim() : '';
            const email = typeof sbClient.email === 'string' ? sbClient.email.trim() : '';

            // Need at least a name and one contact method to be useful
            if (!name || (!phone && !email)) {
                skipped++;
                continue;
            }

            const result = await ClientsStore.importStandalone({
                id: `sb-client-${id}`,
                name,
                phone: phone || undefined,
                email: email || undefined,
                source: 'simplybook',
                sbClientId: id,
            });

            if (result === 'imported') imported++;
            else skipped++;
        }

        console.log(`[SimplyBook import-clients] Done: imported=${imported}, skipped=${skipped}`);

        return NextResponse.json({
            ok: true,
            total: sbClients.length,
            imported,
            skipped,
            importedAt: new Date().toISOString(),
        });
    } catch (err) {
        console.error('[SimplyBook import-clients] failed:', err);
        return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
    }
}

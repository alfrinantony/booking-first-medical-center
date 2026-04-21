/**
 * POST /api/admin/simplybook/import-registered-users
 *
 * Fetches all clients from SimplyBook's getClientList API and creates
 * RegisteredCustomer accounts for each one that has an email address
 * and does not already exist in the system.
 *
 * Imported accounts:
 *  - emailVerified: true  (SB already verified them)
 *  - blocked: false
 *  - passwordHash: base64("FMC@2026")  — temporary, admin should reset
 *  - source: 'simplybook'
 *
 * Response: { total, imported, skipped }
 */
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAdminClientList } from '@/lib/simplybook-client';
import { CustomerAuthServerStore } from '@/lib/customer-auth-server-store';

const TEMP_PASSWORD = 'FMC@2026';

export async function POST() {
    try {
        const sbClients = await getAdminClientList();
        console.log(`[SimplyBook import-registered-users] Fetched ${sbClients.length} clients`);

        let imported = 0;
        let skipped = 0;

        for (const sbClient of sbClients) {
            const email = typeof sbClient.email === 'string' ? sbClient.email.trim() : '';
            if (!email) {
                // No email — cannot create a login account
                skipped++;
                continue;
            }

            const phone = typeof sbClient.phone === 'string' ? sbClient.phone.trim() : '';

            // Skip if email already registered
            const existing = await CustomerAuthServerStore.getByEmail(email);
            if (existing) {
                skipped++;
                continue;
            }

            // Also skip if phone already registered
            if (phone) {
                const existingByPhone = await CustomerAuthServerStore.getByPhone(phone);
                if (existingByPhone) {
                    skipped++;
                    continue;
                }
            }

            const id = String(sbClient.id);
            const name =
                sbClient.name ||
                (sbClient.fname ? `${sbClient.fname} ${sbClient.lname || ''}`.trim() : '') ||
                `SB Client #${id}`;

            // Create via internal register, then mark as verified + simplybook source
            const result = await CustomerAuthServerStore.register({
                name,
                email,
                phone,
                password: TEMP_PASSWORD,
            });

            if (!result.success || !result.user) {
                skipped++;
                continue;
            }

            // Mark email as verified and tag with simplybook source
            await CustomerAuthServerStore.updateUser(result.user.id, {
                emailVerified: true,
                source: 'simplybook',
                sbClientId: id,
            });

            imported++;
        }

        console.log(`[SimplyBook import-registered-users] imported=${imported}, skipped=${skipped}`);

        return NextResponse.json({
            ok: true,
            total: sbClients.length,
            imported,
            skipped,
            tempPassword: TEMP_PASSWORD,
            importedAt: new Date().toISOString(),
        });
    } catch (err) {
        console.error('[SimplyBook import-registered-users] failed:', err);
        return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
    }
}

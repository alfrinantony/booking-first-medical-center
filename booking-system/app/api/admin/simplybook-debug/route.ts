/**
 * Debug endpoint to test SimplyBook connectivity
 * GET /api/admin/simplybook-debug
 * DELETE THIS FILE after debugging
 */
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

const REST_ADMIN_BASE = 'https://user-api-v2.simplybook.it/admin';
const COMPANY         = process.env.SIMPLYBOOK_COMPANY_LOGIN   || 'firstmedicalcenter';
const ADMIN_LOGIN     = process.env.SIMPLYBOOK_ADMIN_LOGIN     || '';
const ADMIN_PASSWORD  = process.env.SIMPLYBOOK_ADMIN_PASSWORD  || '';

export async function GET() {
    const log: Record<string, unknown> = {
        company: COMPANY,
        login: ADMIN_LOGIN,
        passwordLength: ADMIN_PASSWORD.length,
    };

    // Step 1: Auth
    try {
        const authRes = await fetch(`${REST_ADMIN_BASE}/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ company: COMPANY, login: ADMIN_LOGIN, password: ADMIN_PASSWORD }),
            cache: 'no-store',
        });

        const authBody = await authRes.text();
        log.authStatus = authRes.status;
        log.authBody = authBody;

        if (!authRes.ok) {
            return NextResponse.json({ step: 'auth_failed', ...log });
        }

        const authData = JSON.parse(authBody) as { token?: string };
        const token = authData.token;
        log.tokenReceived = !!token;
        log.tokenPreview = token ? token.substring(0, 20) + '...' : null;

        if (!token) {
            return NextResponse.json({ step: 'no_token', ...log });
        }

        // Step 2: Fetch bookings
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

        const bookUrl = `${REST_ADMIN_BASE}/bookings?filter[date_from]=${weekAgo}&filter[date_to]=${today}&limit=10`;
        log.bookingsUrl = bookUrl;

        const bookRes = await fetch(bookUrl, {
            headers: {
                'X-Company-Login': COMPANY,
                'X-User-Token': token,
                'Content-Type': 'application/json',
            },
            cache: 'no-store',
        });

        const bookBody = await bookRes.text();
        log.bookingsStatus = bookRes.status;
        log.bookingsBody = bookBody.substring(0, 2000); // trim long responses

        return NextResponse.json({ step: 'done', ...log });

    } catch (err) {
        return NextResponse.json({ step: 'exception', error: String(err), ...log });
    }
}

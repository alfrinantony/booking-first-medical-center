/**
 * SimplyBook.me Webhook Handler
 * POST /api/webhooks/simplybook
 *
 * SimplyBook sends a raw POST with JSON payload on every booking event.
 * Payload fields:
 *   booking_id        — SimplyBook booking ID
 *   booking_hash      — hash for public API lookup
 *   company           — company login (for verification)
 *   notification_type — "create" | "change" | "cancel" | "notify"
 *
 * Setup in SimplyBook admin:
 *   Plugins → API → Callback URL: https://ai.dubaifmc.com/api/webhooks/simplybook
 */

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getBookingDetailsByHash, getServiceList, getProviderList } from '@/lib/simplybook-client';
import { SimplybookStore, SimplybookRecord } from '@/lib/simplybook-store';

const EXPECTED_COMPANY = process.env.SIMPLYBOOK_COMPANY_LOGIN || 'firstmedicalcenter';

function deriveStatus(notificationType: string, rawStatus?: string): SimplybookRecord['status'] {
    if (notificationType === 'cancel') return 'cancelled';
    if (notificationType === 'create') return 'confirmed';
    if (notificationType === 'change') return 'confirmed';
    if (rawStatus === 'canceled' || rawStatus === 'cancelled') return 'cancelled';
    return 'pending';
}

export async function POST(request: NextRequest) {
    try {
        // ── Parse body ──
        let payload: { booking_id?: string; booking_hash?: string; company?: string; notification_type?: string };
        try {
            payload = await request.json();
        } catch {
            const text = await request.text();
            // SimplyBook sometimes sends form-encoded data
            const params = new URLSearchParams(text);
            payload = {
                booking_id: params.get('booking_id') || undefined,
                booking_hash: params.get('booking_hash') || undefined,
                company: params.get('company') || undefined,
                notification_type: params.get('notification_type') || undefined,
            };
        }

        const { booking_id, booking_hash, company, notification_type } = payload;

        // ── Validate ──
        if (!booking_id || !booking_hash) {
            console.warn('[SimplyBook webhook] Missing booking_id or booking_hash');
            return NextResponse.json({ ok: false, error: 'Missing fields' }, { status: 400 });
        }

        if (company && company !== EXPECTED_COMPANY) {
            console.warn(`[SimplyBook webhook] Company mismatch: received "${company}"`);
            return NextResponse.json({ ok: false, error: 'Company mismatch' }, { status: 403 });
        }

        const notifType = notification_type || 'create';

        // ── Handle cancel (no need to fetch details) ──
        if (notifType === 'cancel') {
            await SimplybookStore.cancel(String(booking_id));
            console.log(`[SimplyBook webhook] Cancelled booking ${booking_id}`);
            return NextResponse.json({ ok: true, action: 'cancelled' });
        }

        // ── Fetch full booking details ──
        const detail = await getBookingDetailsByHash(String(booking_id), String(booking_hash));

        if (!detail) {
            // Still acknowledge but log the error
            console.error(`[SimplyBook webhook] Could not fetch details for booking ${booking_id}`);
            return NextResponse.json({ ok: true, action: 'acknowledged_no_detail' });
        }

        // ── Resolve service & provider names ──
        const [services, providers] = await Promise.all([getServiceList(), getProviderList()]);

        const service = services.find(s => String(s.id) === String(detail.event_id));
        const provider = providers.find(p => String(p.id) === String(detail.unit_id));

        // ── Parse date/time ──
        const startDT: string = (detail.start_date_time as string) || '';
        const endDT: string = (detail.end_date_time as string) || '';
        const [dateStr = '', timeStr = ''] = startDT.split(' ');

        // ── Extract client info ──
        const client = (detail.client as Record<string, string>) || {};
        const clientName = client.name || client.fname ? `${client.fname || ''} ${client.lname || ''}`.trim() : '';
        const clientEmail = client.email || '';
        const clientPhone = client.phone || '';

        // ── Upsert into store ──
        const record: SimplybookRecord = {
            sbId: String(booking_id),
            sbHash: String(booking_hash),
            company: company || EXPECTED_COMPANY,
            startDateTime: startDT,
            endDateTime: endDT,
            date: dateStr,
            time: timeStr.substring(0, 5), // "HH:MM"
            eventId: String(detail.event_id),
            unitId: String(detail.unit_id),
            serviceName: service?.name || `Service #${detail.event_id}`,
            providerName: provider?.name || `Provider #${detail.unit_id}`,
            clientId: String(detail.client_id || ''),
            clientName: clientName || `Client #${detail.client_id}`,
            clientEmail,
            clientPhone,
            status: deriveStatus(notifType, String(detail.status || '')),
            notificationType: notifType,
            receivedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            raw: detail as Record<string, unknown>,
        };

        await SimplybookStore.upsert(record);

        console.log(`[SimplyBook webhook] Processed booking ${booking_id} (${notifType}) — ${record.clientName} @ ${startDT}`);

        return NextResponse.json({ ok: true, action: notifType, bookingId: booking_id });

    } catch (err) {
        console.error('[SimplyBook webhook] Unhandled error:', err);
        // Always return 200 to avoid SimplyBook retry storms
        return NextResponse.json({ ok: false, error: String(err) }, { status: 200 });
    }
}

// SimplyBook may send a GET ping to verify the URL
export async function GET() {
    return NextResponse.json({ ok: true, service: 'SimplyBook Webhook Receiver', status: 'active' });
}

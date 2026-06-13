/**
 * SimplyBook.me Webhook Handler
 * POST /api/webhooks/simplybook
 *
 * SimplyBook fires this on every booking event.
 * Strategy:
 *   1. Parse ALL fields SimplyBook sends (it sends more than just id/hash)
 *   2. Save a record IMMEDIATELY from the payload (never drop a booking)
 *   3. Attempt to enrich via public API getBookingDetails — update if successful
 *
 * Callback URL to set in SimplyBook:
 *   https://ai.dubaifmc.com/api/webhooks/simplybook
 */

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getBookingDetailsByHash, getAdminBooking, getServiceList, getProviderList } from '@/lib/simplybook-client';
import { SimplybookStore, SimplybookRecord } from '@/lib/simplybook-store';
import { BookingsStore } from '@/lib/bookings-store';

const EXPECTED_COMPANY = process.env.SIMPLYBOOK_COMPANY_LOGIN || 'firstmedicalcenter';

// ── Parse raw payload (JSON or form-encoded) ──
async function parsePayload(request: NextRequest): Promise<Record<string, unknown>> {
    const contentType = request.headers.get('content-type') || '';
    const text = await request.text();
    if (!text) return {};

    if (contentType.includes('application/json')) {
        try { return JSON.parse(text); } catch { return {}; }
    }

    // form-encoded fallback
    const params = new URLSearchParams(text);
    const obj: Record<string, unknown> = {};
    params.forEach((v, k) => { obj[k] = v; });

    // SimplyBook also embeds JSON in a "data" field sometimes
    if (obj.data && typeof obj.data === 'string') {
        try { Object.assign(obj, JSON.parse(obj.data as string)); } catch { /* ignore */ }
    }

    return obj;
}

function deriveStatus(notifType: string, rawStatus?: string, paymentStatus?: string): SimplybookRecord['status'] {
    if (notifType === 'cancel') return 'cancelled';
    const s = String(rawStatus || '').toLowerCase();
    const p = String(paymentStatus || '').toLowerCase();
    if (s === '3' || s.includes('cancel') || p === 'error') return 'cancelled';
    if (s.includes('pending') || s.includes('new')) return 'pending';
    return 'confirmed';
}

function parseDateTime(dt: string): { date: string; time: string } {
    if (!dt) return { date: '', time: '' };
    const [date = '', time = ''] = dt.split(' ');
    return { date, time: time.substring(0, 5) };
}

export async function POST(request: NextRequest) {
    try {
        const payload = await parsePayload(request);
        console.log('[SimplyBook webhook] Received payload:', JSON.stringify(payload).substring(0, 500));

        const bookingId  = String(payload.booking_id  || payload.id        || '');
        const bookingHash = String(payload.booking_hash || payload.hash    || '');
        const company    = String(payload.company      || EXPECTED_COMPANY);
        const notifType  = String(payload.notification_type || payload.action || 'create');

        if (!bookingId) {
            console.warn('[SimplyBook webhook] No booking_id in payload');
            return NextResponse.json({ ok: false, error: 'Missing booking_id' }, { status: 400 });
        }

        if (company !== EXPECTED_COMPANY) {
            return NextResponse.json({ ok: false, error: 'Company mismatch' }, { status: 403 });
        }

        // ── Handle cancel immediately ──
        if (notifType === 'cancel') {
            await SimplybookStore.cancel(bookingId);
            // Cascade to BookingsStore if this booking was migrated
            await BookingsStore.updateBySbId(bookingId, 'cancelled').catch(() => null);
            console.log(`[SimplyBook webhook] Cancelled booking ${bookingId}`);
            return NextResponse.json({ ok: true, action: 'cancelled', bookingId });
        }

        // ── Extract whatever fields SimplyBook included in payload ──
        // SimplyBook includes inline client/service data in newer API versions
        const clientData  = (payload.client  as Record<string, string>) || {};
        const rawStart    = String(payload.start_date_time || payload.date_time || payload.start_time || '');
        const rawEnd      = String(payload.end_date_time   || payload.end_time  || '');
        const { date, time } = parseDateTime(rawStart);

        const minimalRecord: SimplybookRecord = {
            sbId:           bookingId,
            sbHash:         bookingHash,
            company,
            startDateTime:  rawStart,
            endDateTime:    rawEnd,
            date:           date || new Date().toISOString().split('T')[0],
            time,
            eventId:        String(payload.event_id  || payload.service_id || ''),
            unitId:         String(payload.unit_id   || payload.staff_id   || ''),
            serviceName:    String(payload.event_name || payload.service_name || `Booking #${bookingId}`),
            providerName:   String(payload.unit_name  || payload.staff_name   || 'Staff'),
            clientId:       String(payload.client_id  || clientData.id || ''),
            clientName:     String(clientData.name    || payload.client_name  || `Client`),
            clientEmail:    String(clientData.email   || payload.client_email || ''),
            clientPhone:    String(clientData.phone   || payload.client_phone || ''),
            status:         deriveStatus(notifType, String(payload.status || ''), String(payload.payment_status || '')),
            notificationType: notifType,
            receivedAt:     new Date().toISOString(),
            updatedAt:      new Date().toISOString(),
            raw:            payload,
        };

        // ── Save immediately — never drop a booking ──
        await SimplybookStore.upsert(minimalRecord);
        console.log(`[SimplyBook webhook] Saved minimal record for booking ${bookingId}`);

        // ── Try to enrich with full admin details (names instead of IDs) ──
        try {
            const [adminDetail, services, providers] = await Promise.all([
                getAdminBooking(bookingId),
                getServiceList(),
                getProviderList(),
            ]);

            // Also try public hash-based details as fallback
            const publicDetail = bookingHash ? await getBookingDetailsByHash(bookingId, bookingHash).catch(() => null) : null;
            const detail = adminDetail || publicDetail;

            const serviceMap = new Map(services.map(s => [String(s.id), s.name]));
            const providerMap = new Map(providers.map(p => [String(p.id), p.name]));

            if (detail) {
                const enrichedStart = String(detail.start_date_time || rawStart);
                const enrichedEnd   = String(detail.end_date_time   || rawEnd);
                const { date: eDate, time: eTime } = parseDateTime(enrichedStart);
                const dc = (detail.client as Record<string, string>) || {};

                const resolvedEventId = String(detail.event_id || minimalRecord.eventId);
                const resolvedUnitId  = String(detail.unit_id  || minimalRecord.unitId);

                const enriched: SimplybookRecord = {
                    ...minimalRecord,
                    startDateTime: enrichedStart,
                    endDateTime:   enrichedEnd,
                    date:          eDate || minimalRecord.date,
                    time:          eTime || minimalRecord.time,
                    eventId:       resolvedEventId,
                    unitId:        resolvedUnitId,
                    // Resolve real service & provider names
                    serviceName:   (detail as Record<string, unknown>).event_name as string ||
                                   serviceMap.get(resolvedEventId) ||
                                   minimalRecord.serviceName,
                    providerName:  (detail as Record<string, unknown>).unit_name as string ||
                                   providerMap.get(resolvedUnitId) ||
                                   minimalRecord.providerName,
                    clientId:      String(detail.client_id || minimalRecord.clientId),
                    clientName:    dc.name || (dc.fname ? `${dc.fname} ${dc.lname || ''}`.trim() : minimalRecord.clientName),
                    clientEmail:   dc.email || minimalRecord.clientEmail,
                    clientPhone:   dc.phone || minimalRecord.clientPhone,
                    status:        deriveStatus(notifType, String(detail.status || ''), String((detail as Record<string, unknown>).payment_status || '')),
                    raw:           detail as Record<string, unknown>,
                    updatedAt:     new Date().toISOString(),
                };

                await SimplybookStore.upsert(enriched);
                console.log(`[SimplyBook webhook] Enriched booking ${bookingId} — ${enriched.clientName} / ${enriched.serviceName} / ${enriched.providerName} @ ${enrichedStart}`);
            }
        } catch (enrichErr) {
            // Don't fail — minimal record is already saved
            console.warn(`[SimplyBook webhook] Enrichment failed for ${bookingId}:`, enrichErr);
        }

        // ── Cascade status to BookingsStore (if booking was migrated) ──
        const sbRec = await SimplybookStore.getById(bookingId);
        const finalStatus = deriveStatus(notifType, String(sbRec?.status || ''), String(sbRec?.paymentStatus || ''));
        const bookingStoreStatus = finalStatus === 'cancelled' ? 'cancelled'
            : finalStatus === 'pending' ? 'booked'
            : 'confirmed';
        await BookingsStore.updateBySbId(bookingId, bookingStoreStatus as any).catch(() => null);

        return NextResponse.json({ ok: true, action: notifType, bookingId });

    } catch (err) {
        console.error('[SimplyBook webhook] Unhandled error:', err);
        // Always 200 to avoid SimplyBook retry storms
        return NextResponse.json({ ok: false, error: String(err) }, { status: 200 });
    }
}

// SimplyBook pings GET to verify the URL is reachable
export async function GET() {
    return NextResponse.json({ ok: true, service: 'SimplyBook Webhook Receiver', status: 'active' });
}

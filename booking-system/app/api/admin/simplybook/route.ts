/**
 * Admin API: SimplyBook Bookings
 * GET  /api/admin/simplybook                   – list bookings from blob (with filters)
 * GET  /api/admin/simplybook?sync=true&from=&to= – pull from SimplyBook Admin API → save to blob
 * GET  /api/admin/simplybook?stats=1&date=      – daily stats
 */
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { SimplybookStore, SimplybookRecord } from '@/lib/simplybook-store';
import {
    getAdminBookings,
    getServiceList,
    getProviderList,
    getAdminClientList,
    SimplyBookAdminBooking,
} from '@/lib/simplybook-client';

// ── Map a SimplyBook admin booking to our stored record ──
function mapAdminBooking(
    b: SimplyBookAdminBooking,
    serviceMap: Map<string, string>,
    providerMap: Map<string, string>,
    clientMap: Map<string, { name: string; email: string; phone: string }>
): SimplybookRecord {
    const startDT: string = b.start_date_time || '';
    const endDT: string = b.end_date_time || '';
    const [dateStr = '', timeStr = ''] = startDT.split(' ');

    // ── Resolve client details ──
    const clientFromMap = clientMap.get(String(b.client_id || ''));
    const clientObj = b.client || {};
    const clientName =
        clientObj.name ||
        (clientObj.fname ? `${clientObj.fname} ${clientObj.lname || ''}`.trim() : '') ||
        clientFromMap?.name ||
        b.client_name ||
        (b.client_id ? `Client #${b.client_id}` : 'Unknown Client');
    const clientEmail = clientObj.email || clientFromMap?.email || b.client_email || '';
    const clientPhone = clientObj.phone || clientFromMap?.phone || b.client_phone || '';

    // ── Resolve service & provider names from lookup maps ──
    const serviceName =
        b.event_name ||
        serviceMap.get(String(b.event_id || '')) ||
        (b.event_id ? `Service #${b.event_id}` : 'Unknown Service');
    const providerName =
        b.unit_name ||
        providerMap.get(String(b.unit_id || '')) ||
        (b.unit_id ? `Provider #${b.unit_id}` : 'Unknown Provider');

    // Normalise SimplyBook status string → our enum
    const rawStatus = String(b.status || '').toLowerCase();
    let status: SimplybookRecord['status'] = 'confirmed';
    if (rawStatus.includes('cancel')) status = 'cancelled';
    else if (rawStatus.includes('pending') || rawStatus.includes('new')) status = 'pending';
    else if (rawStatus.includes('no') && rawStatus.includes('show')) status = 'noshow';

    return {
        sbId: String(b.id),
        sbHash: String(b.booking_hash || ''),
        company: 'firstmedicalcenter',
        startDateTime: startDT,
        endDateTime: endDT,
        date: dateStr,
        time: timeStr.substring(0, 5),
        eventId: String(b.event_id),
        unitId: String(b.unit_id),
        serviceName,
        providerName,
        clientId: String(b.client_id || ''),
        clientName,
        clientEmail,
        clientPhone,
        status,
        notificationType: 'sync',
        receivedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        raw: b as Record<string, unknown>,
    };
}

export async function GET(request: NextRequest) {
    const sp = request.nextUrl.searchParams;

    // ── Stats mode ──
    if (sp.get('stats') === '1') {
        const date = sp.get('date') || new Date().toISOString().split('T')[0];
        const stats = await SimplybookStore.getStats(date);
        return NextResponse.json(stats);
    }

    // ── Sync mode: pull directly from SimplyBook Admin API ──
    if (sp.get('sync') === 'true') {
        const today = new Date().toISOString().split('T')[0];
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const dateFrom = sp.get('from') || sevenDaysAgo;
        const dateTo = sp.get('to') || today;

        try {
            // Pre-fetch lookup data in parallel
            const [sbBookings, services, providers, clients] = await Promise.all([
                getAdminBookings(dateFrom, dateTo),
                getServiceList(),
                getProviderList(),
                getAdminClientList(),
            ]);

            // Build lookup maps  id → name
            const serviceMap = new Map<string, string>(
                services.map(s => [String(s.id), s.name])
            );
            const providerMap = new Map<string, string>(
                providers.map(p => [String(p.id), p.name])
            );
            const clientMap = new Map<string, { name: string; email: string; phone: string }>(
                clients.map(c => {
                    const name = c.name || (c.fname ? `${c.fname} ${c.lname || ''}`.trim() : '');
                    return [String(c.id), { name, email: c.email || '', phone: c.phone || '' }];
                })
            );

            let synced = 0;
            for (const booking of sbBookings) {
                const record = mapAdminBooking(booking, serviceMap, providerMap, clientMap);
                await SimplybookStore.upsert(record);
                synced++;
            }

            return NextResponse.json({
                ok: true,
                synced,
                dateFrom,
                dateTo,
                syncedAt: new Date().toISOString(),
                lookups: {
                    services: services.length,
                    providers: providers.length,
                    clients: clients.length,
                },
            });
        } catch (err) {
            console.error('[SimplyBook sync] failed:', err);
            return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
        }
    }

    // ── List mode: return stored bookings with filters ──
    const dateFrom = sp.get('from');
    const dateTo = sp.get('to');
    const status = sp.get('status') || '';
    const search = (sp.get('search') || '').toLowerCase();

    let bookings = dateFrom && dateTo
        ? await SimplybookStore.getByDateRange(dateFrom, dateTo)
        : sp.get('date')
            ? await SimplybookStore.getByDate(sp.get('date')!)
            : await SimplybookStore.getAll();

    if (status) bookings = bookings.filter(b => b.status === status);

    if (search) {
        bookings = bookings.filter(b =>
            b.clientName.toLowerCase().includes(search) ||
            b.clientEmail.toLowerCase().includes(search) ||
            b.clientPhone.includes(search) ||
            b.serviceName.toLowerCase().includes(search) ||
            b.providerName.toLowerCase().includes(search) ||
            b.sbId.includes(search)
        );
    }

    return NextResponse.json(bookings);
}

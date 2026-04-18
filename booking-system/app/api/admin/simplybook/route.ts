/**
 * Admin API: SimplyBook Bookings
 * GET  /api/admin/simplybook           — list bookings (with filters)
 * GET  /api/admin/simplybook?sync=true — trigger a metadata refresh (services/providers)
 * GET  /api/admin/simplybook?stats=1   — get daily stats
 */
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { SimplybookStore } from '@/lib/simplybook-store';
import { getServiceList, getProviderList } from '@/lib/simplybook-client';

export async function GET(request: NextRequest) {
    const sp = request.nextUrl.searchParams;

    // ── Stats mode ──
    if (sp.get('stats') === '1') {
        const date = sp.get('date') || new Date().toISOString().split('T')[0];
        const stats = await SimplybookStore.getStats(date);
        return NextResponse.json(stats);
    }

    // ── Sync mode: fetch services & providers to verify connectivity ──
    if (sp.get('sync') === 'true') {
        const [services, providers] = await Promise.all([getServiceList(), getProviderList()]);
        return NextResponse.json({
            ok: true,
            servicesCount: services.length,
            providersCount: providers.length,
            services,
            providers,
            syncedAt: new Date().toISOString(),
        });
    }

    // ── List mode ──
    const dateFrom = sp.get('from');
    const dateTo = sp.get('to');
    const status = sp.get('status') || '';
    const search = (sp.get('search') || '').toLowerCase();

    let bookings = dateFrom && dateTo
        ? await SimplybookStore.getByDateRange(dateFrom, dateTo)
        : sp.get('date')
            ? await SimplybookStore.getByDate(sp.get('date')!)
            : await SimplybookStore.getAll();

    if (status) {
        bookings = bookings.filter(b => b.status === status);
    }

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

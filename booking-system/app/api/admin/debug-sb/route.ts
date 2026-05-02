export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServiceList, getProviderList, getAdminBookings } from '@/lib/simplybook-client';

export async function GET() {
    try {
        const services = await getServiceList();
        const providers = await getProviderList();
        const bookings = await getAdminBookings('2026-05-01', '2026-05-10');
        
        return NextResponse.json({
            ok: true,
            servicesCount: services.length,
            providersCount: providers.length,
            bookingsCount: bookings.length,
            servicesExample: services[0] || null,
        });
    } catch (e: any) {
        return NextResponse.json({
            ok: false,
            error: e.message,
            stack: e.stack
        });
    }
}

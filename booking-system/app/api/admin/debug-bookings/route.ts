export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { BookingsStore } from '@/lib/bookings-store';

export async function GET() {
    const start = Date.now();
    const log: string[] = [];

    const addLog = (msg: string) => {
        const time = ((Date.now() - start) / 1000).toFixed(2);
        log.push(`[${time}s] ${msg}`);
        console.log(`[debug-bookings] [${time}s] ${msg}`);
    };

    try {
        addLog('Starting getByFilters test for single day...');
        const bookingsToday = await BookingsStore.getByFilters({
            startDate: '2026-06-25',
            endDate: '2026-06-25'
        });
        addLog(`Single day query finished. Found ${bookingsToday.length} bookings.`);

        addLog('Starting getByFilters test for 5-month range...');
        const bookings5Months = await BookingsStore.getByFilters({
            startDate: '2026-05-01',
            endDate: '2026-09-30'
        });
        addLog(`5-month query finished. Found ${bookings5Months.length} bookings.`);

        return NextResponse.json({
            ok: true,
            log,
            bookingsTodayCount: bookingsToday.length,
            bookings5MonthsCount: bookings5Months.length
        });
    } catch (err: any) {
        addLog(`Error encountered: ${err.message}`);
        return NextResponse.json({
            ok: false,
            log,
            error: err.message,
            stack: err.stack
        }, { status: 500 });
    }
}

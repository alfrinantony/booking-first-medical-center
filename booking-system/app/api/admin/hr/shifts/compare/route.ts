export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { HRShiftStore } from '@/lib/hr-shift-store';

// GET /api/admin/hr/shifts/compare?date= — Compare shift vs attendance
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
        return NextResponse.json({ error: 'date is required' }, { status: 400 });
    }

    const comparisons = await HRShiftStore.compareAttendanceVsShift(date);
    return NextResponse.json({ comparisons, date });
}

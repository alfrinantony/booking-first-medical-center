export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { HRCalendarStore } from '@/lib/hr-calendar-store';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    try {
        if (month && year) {
            const holidays = await HRCalendarStore.getForMonthYear(parseInt(month), parseInt(year));
            return NextResponse.json(holidays);
        } else {
            const holidays = await HRCalendarStore.getAll();
            return NextResponse.json(holidays);
        }
    } catch (err) {
        return NextResponse.json({ error: 'Failed to fetch calendar data' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { date, name } = body;

        if (!date || !name) {
            return NextResponse.json({ error: 'Missing date or name' }, { status: 400 });
        }

        const holiday = await HRCalendarStore.add({ date, name });
        return NextResponse.json({ success: true, holiday });
    } catch (err) {
        return NextResponse.json({ error: 'Failed to add holiday' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        }

        const success = await HRCalendarStore.delete(id);
        if (success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: 'Holiday not found' }, { status: 404 });
        }
    } catch (err) {
        return NextResponse.json({ error: 'Failed to delete holiday' }, { status: 500 });
    }
}

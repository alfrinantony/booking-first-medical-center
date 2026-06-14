import { NextResponse } from 'next/server';
import { Scheduler } from '@/lib/scheduler';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const clinicId = searchParams.get('clinicId');

    const schedules = await Scheduler.getAllSchedules();
    let filtered = schedules;

    if (date) {
        filtered = filtered.filter(s => s.date === date);
    }
    if (clinicId) {
        filtered = filtered.filter(s => s.clinicId === clinicId);
    }

    return NextResponse.json(filtered);
}

import { NextResponse } from 'next/server';
import { HRAttendanceStore } from '@/lib/hr-attendance-store';
import { HRStore } from '@/lib/hr-store';

// GET /api/admin/hr/attendance/alerts — Get attendance alerts
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const generate = searchParams.get('generate') === 'true';

    // Optionally generate fresh alerts for a given date
    if (generate) {
        const employees = HRStore.getAll({ status: 'ACTIVE' }).map(emp => ({
            id: emp.id,
            name: `${emp.firstName} ${emp.lastName}`,
        }));
        HRAttendanceStore.generateAlerts(date, employees);
    }

    const alerts = HRAttendanceStore.getAlerts(unreadOnly);

    return NextResponse.json({
        alerts,
        summary: {
            total: alerts.length,
            unread: alerts.filter(a => !a.read).length,
            late: alerts.filter(a => a.type === 'LATE').length,
            absent: alerts.filter(a => a.type === 'ABSENT').length,
            earlyLeave: alerts.filter(a => a.type === 'EARLY_LEAVE').length,
        },
    });
}

// POST /api/admin/hr/attendance/alerts — Mark alert as read
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { alertId } = body;

        if (!alertId) {
            return NextResponse.json({ error: 'alertId is required' }, { status: 400 });
        }

        HRAttendanceStore.markAlertRead(alertId);
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
}

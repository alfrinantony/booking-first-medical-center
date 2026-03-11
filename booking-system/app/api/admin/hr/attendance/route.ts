import { NextResponse } from 'next/server';
import { HRAttendanceStore } from '@/lib/hr-attendance-store';
import { HRStore } from '@/lib/hr-store';

// GET /api/admin/hr/attendance — List attendance records with filters
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId') || undefined;
    const date = searchParams.get('date') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const statusParam = searchParams.get('status') || undefined;

    const records = await HRAttendanceStore.getAll({ employeeId, date, startDate, endDate, status: statusParam as 'PRESENT' | 'LATE' | 'ABSENT' | 'EARLY_LEAVE' | 'HALF_DAY' | 'ON_LEAVE' | 'DAY_OFF' | undefined });

    // Enrich with employee names + branch info
    const allEmployees = await HRStore.getAll();
    const enriched = records.map(r => {
        const emp = allEmployees.find(e => e.id === r.employeeId);
        return {
            ...r,
            employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
            employeeCode: emp?.employeeCode || '',
            branchId: emp?.workplaceId || '',
            branchName: emp?.workplaceName || '',
        };
    });

    // If requesting today summary
    if (searchParams.get('summary') === 'today') {
        const today = date || new Date().toISOString().split('T')[0];
        const summary = await HRAttendanceStore.getTodaySummary(
            today,
            allEmployees.map(e => ({ weeklyOffDays: e.weeklyOffDays }))
        );

        // Build per-branch breakdown
        const branchMap: Record<string, { branchId: string; branchName: string; present: number; late: number; absent: number; total: number }> = {};
        for (const emp of allEmployees) {
            const bid = emp.workplaceId || 'unknown';
            if (!branchMap[bid]) {
                branchMap[bid] = { branchId: bid, branchName: emp.workplaceName || bid, present: 0, late: 0, absent: 0, total: 0 };
            }
            branchMap[bid].total++;
            const rec = enriched.find(r => r.employeeId === emp.id);
            if (rec) {
                if (rec.status === 'PRESENT') branchMap[bid].present++;
                else if (rec.status === 'LATE') { branchMap[bid].present++; branchMap[bid].late++; }
                else if (rec.status === 'ABSENT') branchMap[bid].absent++;
            }
        }

        return NextResponse.json({
            records: enriched,
            summary,
            branchBreakdown: Object.values(branchMap),
        });
    }

    return NextResponse.json(enriched);
}

// POST /api/admin/hr/attendance — Create or update attendance record
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, id, ...data } = body;

        if (action === 'update' && id) {
            const updated = await HRAttendanceStore.update(id, data);
            if (!updated) {
                return NextResponse.json({ error: 'Record not found' }, { status: 404 });
            }
            return NextResponse.json(updated);
        }

        // Create new record
        if (!data.employeeId || !data.date) {
            return NextResponse.json({ error: 'employeeId and date are required' }, { status: 400 });
        }

        const record = await HRAttendanceStore.create({
            employeeId: data.employeeId,
            date: data.date,
            punchIn: data.punchIn || null,
            punchOut: data.punchOut || null,
            source: data.source || 'MANUAL',
            notes: data.notes || 'Manual entry',
        });

        return NextResponse.json(record, { status: 201 });
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}

// DELETE /api/admin/hr/attendance — Remove attendance record
export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Record id is required' }, { status: 400 });
    }

    const deleted = await HRAttendanceStore.delete(id);
    if (!deleted) {
        return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
}

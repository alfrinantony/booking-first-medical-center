import { NextResponse } from 'next/server';
import { HRShiftStore, ShiftStatus } from '@/lib/hr-shift-store';
import { HRStore } from '@/lib/hr-store';

// GET /api/admin/hr/shifts — List shift assignments
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const branchId = searchParams.get('branchId') || undefined;
    const employeeId = searchParams.get('employeeId') || undefined;
    const status = searchParams.get('status') as ShiftStatus | undefined;

    const assignments = await HRShiftStore.getAssignments({ date, startDate, endDate, branchId, employeeId, status });

    // Enrich with employee names
    const enriched = await Promise.all(assignments.map(async a => {
        const emp = await HRStore.getById(a.employeeId);
        return {
            ...a,
            employeeName: emp ? `${emp.firstName} ${emp.lastName}` : a.shiftName,
            employeeCode: emp?.employeeCode || '',
            designation: emp?.designation || '',
        };
    }));

    // If summary requested
    if (searchParams.get('summary') === 'true') {
        const summaryDate = date || new Date().toISOString().split('T')[0];
        const summary = await HRShiftStore.getDaySummary(summaryDate);
        return NextResponse.json({ assignments: enriched, summary });
    }

    return NextResponse.json(enriched);
}

// POST /api/admin/hr/shifts — Create, update, delete, or generate clinician shifts
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, ...data } = body;

        // Generate clinician auto-shifts from bookings
        if (action === 'generate-clinician-shifts') {
            const result = await HRShiftStore.generateClinicianShifts(data.date, data.branchId);
            return NextResponse.json(result);
        }

        // Update existing assignment
        if (action === 'update' && data.id) {
            const updated = await HRShiftStore.updateAssignment(data.id, data);
            if (!updated) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
            return NextResponse.json(updated);
        }

        // Assign a shift — requires employee, date, branch, and either a template or custom times
        const hasTemplate = !!data.shiftTemplateId;
        const hasCustomTimes = !!(data.startTime && data.endTime);
        if (!data.employeeId || !data.date || !data.branchId || (!hasTemplate && !hasCustomTimes)) {
            return NextResponse.json({ error: 'employeeId, date, branchId required; provide shiftTemplateId or startTime+endTime' }, { status: 400 });
        }

        const assignment = await HRShiftStore.assignShift(data);
        return NextResponse.json(assignment, { status: 201 });
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}

// DELETE /api/admin/hr/shifts
export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const deleted = await HRShiftStore.deleteAssignment(id);
    if (!deleted) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    return NextResponse.json({ success: true });
}

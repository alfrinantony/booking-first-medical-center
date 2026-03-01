import { NextRequest, NextResponse } from 'next/server';
import { getLeavesByDateRange } from '@/lib/hr-leave-store';
import { HRStore } from '@/lib/hr-store';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
        return NextResponse.json({ error: 'Missing startDate or endDate' }, { status: 400 });
    }

    // Get all Clinical department employees
    const clinicalEmployees = HRStore.getAll({ department: 'Clinical' });

    // Get all leaves overlapping the date range
    const allLeaves = getLeavesByDateRange(startDate, endDate);

    // Filter leaves to only Clinical department employees
    const clinicalEmployeeIds = new Set(clinicalEmployees.map(e => e.id));
    const clinicalLeaves = allLeaves.filter(lr => clinicalEmployeeIds.has(lr.employeeId));

    // Build response with employee info attached to each leave
    const leavesWithEmployee = clinicalLeaves.map(lr => {
        const emp = clinicalEmployees.find(e => e.id === lr.employeeId);
        return {
            ...lr,
            employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
            employeeCode: emp?.employeeCode || '',
            designation: emp?.designation || '',
            workplaceName: emp?.workplaceName || '',
        };
    });

    return NextResponse.json({
        leaves: leavesWithEmployee,
        employees: clinicalEmployees.map(e => ({
            id: e.id,
            name: `${e.firstName} ${e.lastName}`,
            employeeCode: e.employeeCode,
            designation: e.designation,
            workplaceName: e.workplaceName,
        })),
    });
}

import { NextResponse } from 'next/server';
import { HRAttendanceStore } from '@/lib/hr-attendance-store';
import { HRStore } from '@/lib/hr-store';

// GET /api/admin/hr/attendance/timesheet — Generate monthly timesheet
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1), 10);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);

    if (employeeId) {
        // Single employee timesheet
        const employee = HRStore.getById(employeeId);
        if (!employee) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }

        const timesheet = HRAttendanceStore.generateTimesheet(
            employeeId,
            month,
            year,
            `${employee.firstName} ${employee.lastName}`,
            employee.employeeCode
        );

        return NextResponse.json(timesheet);
    }

    // All employees timesheets
    const employees = HRStore.getAll({ status: 'ACTIVE' });
    const timesheets = employees.map(emp =>
        HRAttendanceStore.generateTimesheet(
            emp.id,
            month,
            year,
            `${emp.firstName} ${emp.lastName}`,
            emp.employeeCode
        )
    );

    return NextResponse.json(timesheets);
}

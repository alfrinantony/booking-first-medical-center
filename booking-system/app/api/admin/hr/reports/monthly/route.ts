export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { HRStore } from '@/lib/hr-store';
import { HRPayslipStore } from '@/lib/hr-payslip-store';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const monthStr = searchParams.get('month');
    const yearStr = searchParams.get('year');

    if (!monthStr || !yearStr) {
        return NextResponse.json({ error: 'Missing month or year parameter' }, { status: 400 });
    }

    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);

    // 1. Fetch all active employees
    const employees = await HRStore.getAll({ status: 'ACTIVE' });

    // 2. Fetch all generated payslip records for this month/year
    const payslipRecords = await HRPayslipStore.getByMonth(month, year);

    // Map records to a lookup dictionary for fast access
    const payslipLookup = new Map();
    payslipRecords.forEach(record => {
        payslipLookup.set(record.employeeId, record);
    });

    // 3. Merge data
    const reportList = employees.map(emp => {
        const record = payslipLookup.get(emp.id);

        return {
            employeeId: emp.id,
            employeeCode: emp.employeeCode,
            name: `${emp.firstName} ${emp.lastName}`,
            department: emp.department,
            designation: emp.designation,
            
            // Payslip availability
            isGenerated: !!record && !!record.payslip,
            payslipRecordId: record ? record.id : null,
            
            // Pull data from the generated payslip if it exists, otherwise provide empty/null format
            payslip: record ? record.payslip : null,
            formInputs: record ? {
                daysWorked: record.daysWorked,
                annualLeave: record.annualLeave,
                sickLeave: record.sickLeave,
                unpaidLeave: record.unpaidLeave,
                absentDays: record.absentDays,
                phDays: record.phDays,
                offDays: record.offDays,
                expectedHours: record.expectedHours,
                actualHours: record.actualHours,
                netOvertimeHours: record.payslip?.netOvertimeHours || 0,
            } : null
        };
    });

    return NextResponse.json(reportList);
}

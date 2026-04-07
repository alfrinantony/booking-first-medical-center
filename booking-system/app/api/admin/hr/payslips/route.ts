export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { HRPayslipStore } from '@/lib/hr-payslip-store';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const monthStr = searchParams.get('month');
    const yearStr = searchParams.get('year');

    if (!employeeId || !monthStr || !yearStr) {
        return NextResponse.json({ error: 'Missing employeeId, month, or year' }, { status: 400 });
    }

    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);

    const record = await HRPayslipStore.getForEmployeeMonth(employeeId, month, year);
    if (!record) {
        return NextResponse.json({ found: false });
    }

    return NextResponse.json({ found: true, record });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            employeeId, month, year, daysWorked, annualLeave, sickLeave, unpaidLeave,
            absentDays, phDays, offDays, cumSick, incomeProfitAch, pkgSalesAch, referralCount,
            responsibilityAllowanceAch, blocked, expectedHours, actualHours, previousOT, otCompensation,
            advanceDeduction, advanceTotal, advanceRemaining, penaltyAmount,
            penaltyReason, damagesAmount, damagesReason, payslip
        } = body;

        if (!employeeId || !month || !year) {
            return NextResponse.json({ error: 'Missing employeeId, month, or year' }, { status: 400 });
        }

        const saved = await HRPayslipStore.save({
            employeeId, month, year, daysWorked, annualLeave, sickLeave, unpaidLeave,
            absentDays, phDays, offDays, cumSick, incomeProfitAch, pkgSalesAch, referralCount,
            responsibilityAllowanceAch, blocked, expectedHours, actualHours, previousOT, otCompensation,
            advanceDeduction, advanceTotal, advanceRemaining, penaltyAmount,
            penaltyReason, damagesAmount, damagesReason, payslip
        });

        return NextResponse.json({ success: true, record: saved });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Failed to save payslip' }, { status: 500 });
    }
}

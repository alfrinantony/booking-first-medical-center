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

    try {
        const arrears = await HRPayslipStore.calculateTotalArrearsForEmployee(employeeId, month, year);
        return NextResponse.json({ arrears });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Failed to calculate arrears' }, { status: 500 });
    }
}

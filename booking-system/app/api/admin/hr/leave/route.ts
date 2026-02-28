import { NextRequest, NextResponse } from 'next/server';
import {
    getLeavesByEmployee,
    getPlanningsByEmployee,
    getLeaveBalance,
    createLeaveRequest,
    updateLeaveStatus,
    createLeavePlanning,
    deleteLeavePlanning,
    UAE_LEAVE_RULES,
} from '@/lib/hr-leave-store';
import type { LeaveType, LeaveStatus } from '@/lib/hr-leave-store';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    if (!employeeId) return NextResponse.json({ error: 'Missing employeeId' }, { status: 400 });

    return NextResponse.json({
        requests: getLeavesByEmployee(employeeId),
        plannings: getPlanningsByEmployee(employeeId),
        balance: getLeaveBalance(employeeId),
        rules: UAE_LEAVE_RULES,
    });
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { action } = body;

    if (action === 'createRequest') {
        const lr = createLeaveRequest({
            employeeId: body.employeeId,
            leaveType: body.leaveType as LeaveType,
            startDate: body.startDate,
            endDate: body.endDate,
            totalDays: body.totalDays,
            reason: body.reason || '',
            status: 'PENDING',
        });
        return NextResponse.json(lr);
    }

    if (action === 'updateStatus') {
        const lr = updateLeaveStatus(body.id, body.status as LeaveStatus, body.approvedBy, body.rejectedReason);
        if (!lr) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json(lr);
    }

    if (action === 'createPlanning') {
        const lp = createLeavePlanning({
            employeeId: body.employeeId,
            leaveType: body.leaveType as LeaveType,
            plannedStartDate: body.plannedStartDate,
            plannedEndDate: body.plannedEndDate,
            plannedDays: body.plannedDays,
            notes: body.notes || '',
        });
        return NextResponse.json(lp);
    }

    if (action === 'deletePlanning') {
        const ok = deleteLeavePlanning(body.id);
        if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

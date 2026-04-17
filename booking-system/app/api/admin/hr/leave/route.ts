export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import {
    getLeavesByEmployee,
    getPlanningsByEmployee,
    getLeaveBalance,
    createLeaveRequest,
    updateLeaveStatus,
    updateLeaveRecord,
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
        requests: await getLeavesByEmployee(employeeId),
        plannings: await getPlanningsByEmployee(employeeId),
        balance: await getLeaveBalance(employeeId),
        rules: UAE_LEAVE_RULES,
    });
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { action } = body;

    if (action === 'createRequest') {
        const lr = await createLeaveRequest({
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
        const lr = await updateLeaveStatus(body.id, body.status as LeaveStatus, body.approvedBy, body.rejectedReason);
        if (!lr) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json(lr);
    }

    // Super Admin: edit all fields of an approved (or any) leave record
    if (action === 'updateLeave') {
        const lr = await updateLeaveRecord(body.id, {
            leaveType: body.leaveType as LeaveType | undefined,
            startDate: body.startDate,
            endDate: body.endDate,
            totalDays: body.totalDays,
            reason: body.reason,
            status: body.status as LeaveStatus | undefined,
            approvedBy: body.approvedBy,
            rejectedReason: body.rejectedReason,
        });
        if (!lr) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json(lr);
    }

    if (action === 'createPlanning') {
        const lp = await createLeavePlanning({
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
        const ok = await deleteLeavePlanning(body.id);
        if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

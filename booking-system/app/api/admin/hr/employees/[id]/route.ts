export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { HRStore } from '@/lib/hr-store';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const employee = await HRStore.getById(id);
    if (!employee) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }
    return NextResponse.json(employee);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const body = await request.json();

        // Convert numeric fields
        if (body.basicSalary !== undefined) body.basicSalary = Number(body.basicSalary);
        if (body.housingAllowance !== undefined) body.housingAllowance = Number(body.housingAllowance);
        if (body.transportAllowance !== undefined) body.transportAllowance = Number(body.transportAllowance);
        if (body.otherAllowances !== undefined) body.otherAllowances = Number(body.otherAllowances);
        if (body.annualLeaveEntitlement !== undefined) body.annualLeaveEntitlement = Number(body.annualLeaveEntitlement);
        if (body.leavesTaken !== undefined) body.leavesTaken = Number(body.leavesTaken);
        if (body.sickLeavesTaken !== undefined) body.sickLeavesTaken = Number(body.sickLeavesTaken);

        const updated = await HRStore.update(id, body);
        if (!updated) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }
        return NextResponse.json(updated);
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const deleted = await HRStore.delete(id);
    if (!deleted) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
}

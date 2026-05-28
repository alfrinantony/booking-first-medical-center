export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { HRStore } from '@/lib/hr-store';
import type { EmployeeStatus } from '@/lib/hr-store';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const status = (searchParams.get('status') as EmployeeStatus) || undefined;
    const department = searchParams.get('department') || undefined;
    const clinicId = searchParams.get('clinicId') || undefined;

    const employees = await HRStore.getAll({ search, status, department, clinicId });
    return NextResponse.json(employees);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Auto-generate employee code if not provided
        if (!body.employeeCode) {
            body.employeeCode = await HRStore.getNextCode();
        }

        // Set defaults
        const data = {
            firstName: body.firstName || '',
            lastName: body.lastName || '',
            email: body.email || '',
            phone: body.phone || '',
            nationality: body.nationality || '',
            dateOfBirth: body.dateOfBirth || '',
            gender: body.gender || 'MALE',
            designation: body.designation || '',
            department: body.department || '',
            clinicId: body.clinicId || 'clinic-1',
            joiningDate: body.joiningDate || new Date().toISOString().split('T')[0],
            contractEndDate: body.contractEndDate || undefined,
            employmentType: body.employmentType || 'FULL_TIME',
            status: body.status || 'ACTIVE',
            basicSalary: Number(body.basicSalary) || 0,
            housingAllowance: Number(body.housingAllowance) || 0,
            transportAllowance: Number(body.transportAllowance) || 0,
            otherAllowances: Number(body.otherAllowances) || 0,
            workAllowance: Number(body.workAllowance) || 0,
            trainingAllowance: Number(body.trainingAllowance) || 0,
            internalAllowance: Number(body.internalAllowance) || 0,
            workplaceId: body.workplaceId || body.clinicId || 'clinic-1',
            annualLeaveEntitlement: Number(body.annualLeaveEntitlement) || 30,
            leavesTaken: Number(body.leavesTaken) || 0,
            sickLeavesTaken: Number(body.sickLeavesTaken) || 0,
            visaStatus: body.visaStatus || '',
            visaExpiryDate: body.visaExpiryDate || undefined,
            laborCardNumber: body.laborCardNumber || undefined,
            laborCardExpiry: body.laborCardExpiry || undefined,
            emiratesId: body.emiratesId || undefined,
            emiratesIdExpiry: body.emiratesIdExpiry || undefined,
            passportNumber: body.passportNumber || undefined,
            passportExpiry: body.passportExpiry || undefined,
            employeeCode: body.employeeCode,
        };

        const employee = await HRStore.add(data);
        return NextResponse.json(employee, { status: 201 });
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}

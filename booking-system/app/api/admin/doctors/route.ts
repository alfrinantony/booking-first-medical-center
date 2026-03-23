export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
import { NextResponse } from 'next/server';
import { DoctorsStore } from '@/lib/doctors-store';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const clinicId = searchParams.get('clinicId');

    // Return all clinics structure (containing doctors)
    // If clinicId is provided, we could filter, but returning full structure is easier for UI to parse
    const data = await DoctorsStore.getClinics();

    if (clinicId) {
        return NextResponse.json(data.filter(c => c.id === clinicId));
    }

    return NextResponse.json(data);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { clinicId, departmentId, id, name, specialty, image, certifications, maxConcurrentBookings, licenseNumber, licenseExpiry, startDate, endDate, status, daysOff } = body;

        if (!clinicId || !departmentId || !name || !specialty) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const newDoctor = await DoctorsStore.addDoctor(clinicId, departmentId, {
            ...(id ? { id } : {}),
            name,
            specialty,
            image: image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
            certifications: certifications || [],
            maxConcurrentBookings: maxConcurrentBookings || 1,
            licenseNumber: licenseNumber || undefined,
            licenseExpiry: licenseExpiry || undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            status: status || 'working',
            daysOff: daysOff || undefined
        });

        if (!newDoctor) {
            return NextResponse.json({ error: 'Failed to add doctor' }, { status: 500 });
        }

        return NextResponse.json(newDoctor);
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { clinicId, departmentId, doctorId, ...updates } = body;

        if (!clinicId || !departmentId || !doctorId) {
            return NextResponse.json({ error: 'Missing IDs' }, { status: 400 });
        }

        const updatedDoctor = await DoctorsStore.updateDoctor(clinicId, departmentId, doctorId, updates);

        if (!updatedDoctor) {
            return NextResponse.json({ error: 'Failed to update doctor' }, { status: 404 });
        }

        return NextResponse.json(updatedDoctor);
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const clinicId = searchParams.get('clinicId');
    const departmentId = searchParams.get('departmentId');
    const doctorId = searchParams.get('doctorId');

    if (!clinicId || !departmentId || !doctorId) {
        return NextResponse.json({ error: 'Missing IDs' }, { status: 400 });
    }

    const success = await DoctorsStore.removeDoctor(clinicId, departmentId, doctorId);

    if (success) {
        return NextResponse.json({ success: true });
    } else {
        return NextResponse.json({ error: 'Failed to delete doctor' }, { status: 404 });
    }
}

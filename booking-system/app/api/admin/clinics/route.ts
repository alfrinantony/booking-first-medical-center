import { NextResponse } from 'next/server';
import { ClinicsStore } from '@/lib/clinics-store';

export async function GET(request: Request) {
    const clinics = await ClinicsStore.getClinics();
    return NextResponse.json(clinics);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, address, vatPercentage, image, operationHours, locationMap, parkingInfo, contactPhone, email, workingDays, openingTime, closingTime } = body;

        if (!name || !address) {
            return NextResponse.json({ error: 'Name and Address are required' }, { status: 400 });
        }

        const newClinic = await ClinicsStore.addClinic({
            name,
            address,
            vatPercentage: Number(vatPercentage) || 0,
            image,
            operationHours,
            locationMap,
            parkingInfo,
            contactPhone,
            email,
            workingDays: workingDays || [1, 2, 3, 4, 5], // Default Mon-Fri
            openingTime: openingTime || "09:00",
            closingTime: closingTime || "17:00"
        });

        return NextResponse.json(newClinic);
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Clinic ID is required' }, { status: 400 });
        }

        const updatedClinic = await ClinicsStore.updateClinic(id, updates);

        if (!updatedClinic) {
            return NextResponse.json({ error: 'Clinic not found' }, { status: 404 });
        }

        return NextResponse.json(updatedClinic);
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Clinic ID is required' }, { status: 400 });
        }

        const success = await ClinicsStore.removeClinic(id);

        if (!success) {
            return NextResponse.json({ error: 'Clinic not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

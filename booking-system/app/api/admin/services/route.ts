import { NextResponse } from 'next/server';
import { ServicesStore } from '@/lib/services-store';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const clinicId = searchParams.get('clinicId');

    if (clinicId) {
        const clinic = ServicesStore.getClinic(clinicId);
        return NextResponse.json(clinic || {});
    }

    return NextResponse.json(ServicesStore.getClinics());
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { clinicId, departmentId, name, price, duration, isTaxable, category, followUpDuration, screeningQuestions, maxMedicines, medicineIds, medicineSelectionMode, consumableIds, addOns, description, preCare, postCare, regularPrice, discountedPrice, threeSessionPackage, sixSessionPackage } = body;

        if (!clinicId || !departmentId || !name || !price || !duration) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const newService = ServicesStore.addService(clinicId, departmentId, {
            name,
            description: description || '',
            preCare: preCare || '',
            postCare: postCare || '',
            price: Number(price),
            regularPrice: regularPrice ? Number(regularPrice) : undefined,
            discountedPrice: discountedPrice ? Number(discountedPrice) : undefined,
            threeSessionPackage: threeSessionPackage || undefined,
            sixSessionPackage: sixSessionPackage || undefined,
            duration: Number(duration),
            isTaxable: isTaxable || false,
            category: category || '',
            followUpDuration: followUpDuration ? Number(followUpDuration) : undefined,
            screeningQuestions: screeningQuestions || [],
            maxMedicines: maxMedicines ? Number(maxMedicines) : undefined,
            medicineIds: medicineIds || [],
            medicineSelectionMode: medicineSelectionMode || undefined,
            consumableIds: consumableIds || [],
            addOns: addOns || []
        });

        if (!newService) {
            return NextResponse.json({ error: 'Clinic or Department not found' }, { status: 404 });
        }

        return NextResponse.json(newService);
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { clinicId, departmentId, serviceId, ...updates } = body;

        if (!clinicId || !departmentId || !serviceId) {
            return NextResponse.json({ error: 'Missing required IDs' }, { status: 400 });
        }

        const updatedService = ServicesStore.updateService(clinicId, departmentId, serviceId, updates);

        if (updatedService) {
            return NextResponse.json(updatedService);
        } else {
            return NextResponse.json({ error: 'Service not found' }, { status: 404 });
        }
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const clinicId = searchParams.get('clinicId');
        const departmentId = searchParams.get('departmentId');
        const serviceId = searchParams.get('serviceId');

        if (!clinicId || !departmentId || !serviceId) {
            return NextResponse.json({ error: 'Missing ids' }, { status: 400 });
        }

        const success = ServicesStore.removeService(clinicId, departmentId, serviceId);

        if (success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: 'Service not found' }, { status: 404 });
        }
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

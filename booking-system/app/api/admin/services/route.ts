import { NextResponse } from 'next/server';
import { ServicesStore } from '@/lib/services-store';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const clinicId = searchParams.get('clinicId');
    const serviceId = searchParams.get('id');

    if (serviceId) {
        // Search all clinics and departments for this service ID
        const clinics = await ServicesStore.getClinics();
        for (const clinic of clinics) {
            for (const dept of clinic.departments) {
                const svc = dept.services.find(s => s.id === serviceId);
                if (svc) {
                    return NextResponse.json(svc);
                }
            }
        }
        return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    if (clinicId) {
        const clinic = await ServicesStore.getClinic(clinicId);
        return NextResponse.json(clinic || {});
    }

    return NextResponse.json(await ServicesStore.getClinics());
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { clinicId, departmentId, serviceId, ...serviceData } = body;

        if (!clinicId || !departmentId || !serviceData.name || serviceData.price === undefined || serviceData.price === null || serviceData.duration === undefined || serviceData.duration === null) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const newService = await ServicesStore.addService(clinicId, departmentId, {
            ...serviceData,
            ...(serviceId ? { id: serviceId } : {}) // Preserve original service ID if provided
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
        const { clinicId, departmentId, serviceId, updateGlobally, ...updates } = body;

        if (!serviceId) {
            return NextResponse.json({ error: 'Missing service ID' }, { status: 400 });
        }

        if (updateGlobally) {
            const updated = await ServicesStore.updateServiceGlobally(serviceId, updates);
            if (updated) return NextResponse.json({ success: true, updatedService: updated });
            return NextResponse.json({ error: 'Service not found globally' }, { status: 404 });
        }

        if (!clinicId || !departmentId) {
            return NextResponse.json({ error: 'Missing required IDs' }, { status: 400 });
        }

        const updatedService = await ServicesStore.updateService(clinicId, departmentId, serviceId, updates);

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

        const success = await ServicesStore.removeService(clinicId, departmentId, serviceId);

        if (success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: 'Service not found' }, { status: 404 });
        }
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

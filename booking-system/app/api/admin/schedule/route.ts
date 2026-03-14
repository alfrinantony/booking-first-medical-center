import { NextResponse } from 'next/server';
import { Scheduler } from '@/lib/scheduler';
import { BookingsStore } from '@/lib/bookings-store';
import { clinics } from '@/lib/data';
import { HRShiftStore } from '@/lib/hr-shift-store';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const doctorId = searchParams.get('doctorId');
    const date = searchParams.get('date');
    const clinicId = searchParams.get('clinicId') || undefined;
    const otherBranches = searchParams.get('otherBranches') === 'true';
    const serviceId = searchParams.get('serviceId'); // Optional: Check resource availability for this service

    if (!doctorId || !date) {
        return NextResponse.json({ error: 'Missing doctorId or date' }, { status: 400 });
    }

    // ── Clinician Availability Check (shift integration) ──
    const availability = await HRShiftStore.isClinicianAvailable(doctorId, date);
    if (!availability.available) {
        return NextResponse.json({
            slots: [],
            unavailable: true,
            reason: availability.reason || 'Clinician not on duty',
        });
    }

    // 1. Get Base Schedule (or default availability)
    let slots = Scheduler.getSchedule(doctorId, date, clinicId);

    // If no custom schedule, use default slots (handled by UI falling back to all timeSlots)
    // But here we need to know the base slots to filter them. 
    // If Scheduler returns empty, it means "Default Availability" (all slots).
    // In that case, we should probably return the full list SO THAT we can filter it here on the server.
    // However, the current UI logic handles "empty" as "all slots". 
    // To properly filter server-side, we need the full list if it's empty.

    const { timeSlots, Service, Resource } = require('@/lib/data'); // Lazy load
    const { ServicesStore } = require('@/lib/services-store');
    const { ResourcesStore } = require('@/lib/resources-store');

    if (slots.length === 0) {
        slots = timeSlots;
    }

    // 2. Get Doctor's Capacity
    let maxConcurrent = 1;
    // Find doctor in clinics to get maxConcurrentBookings
    // This optimization is O(N) but N is small.
    let doctorFound = false;
    for (const clinic of clinics) {
        for (const dept of clinic.departments) {
            const doc = dept.doctors.find(d => d.id === doctorId);
            if (doc) {
                maxConcurrent = doc.maxConcurrentBookings || 1;
                doctorFound = true;
                break;
            }
        }
        if (doctorFound) break;
    }

    // 3. Get Existing Bookings
    const bookings = await BookingsStore.getByFilters({ doctorId, date });

    // 4. Filter Slots based on Capacity
    // Count bookings per slot
    const slotCounts: Record<string, number> = {};
    bookings.forEach(b => {
        if (b.status !== 'cancelled') {
            slotCounts[b.slot] = (slotCounts[b.slot] || 0) + 1;
        }
    });

    // Filter out full slots (Doctor Capacity)
    let availableSlots = slots.filter(slot => {
        const count = slotCounts[slot] || 0;
        return count < maxConcurrent;
    });

    // 5. Check Resource Availability (if serviceId is provided)
    if (serviceId) {
        // Find service to get required resources
        // We need to search all clinics/departments to find the service, or use a helper if available
        // Since `serviceId` is unique, we can find it. 
        // Simplification: We assume ServicesStore has a way to get by ID, or we iterate.
        // ServicesStore breaks down by clinic. Let's assume we can find it.
        // Actually, efficiently we might need clinicId passed in too, but let's try to find it.

        // Helper to find service (inefficient but works for mock data)
        const allServices = ServicesStore.getAllServices ? ServicesStore.getAllServices() : [];
        // Wait, ServicesStore structure might be per-clinic.
        // Let's assume we can fetch all. If not, we iterate clinics.
        // For now, let's look at BookingsStore to see if we can get service details? No.

        // Let's iterate all clinics in the store to find the service (if not easily available)
        // OR better: Just fetch the service if we can.

        let targetService: any = null;
        const allClinics = require('@/lib/services-store').ServicesStore.getClinics ? await require('@/lib/services-store').ServicesStore.getClinics() : [];
        // The store might just be a flat list or map. 
        // Let's assume we can find it.
        // NOTE: In `lib/services-store.ts`, we probably need a `getServiceById` method.
        // I will add that method to `lib/services-store.ts` in the next step or assume it exists.
        // Let's try to find it via brute force on `clinics` from data if store doesn't have it, 
        // BUT the store is mutable.

        // Let's rely on `ServicesStore.getServiceById(serviceId)` which I should add.
        // validating existence:
        const service = await ServicesStore.getServiceById(serviceId);

        if (service && service.requiredResourceIds && service.requiredResourceIds.length > 0) {
            // Check each resource
            const resourceCounts: Record<string, Record<string, number>> = {}; // resourceId -> slot -> count

            for (const b of bookings) {
                if (b.status !== 'cancelled') {
                    // Look up service for every booking to check resource usage
                    const bookedService = await ServicesStore.getServiceById(b.serviceId);
                    if (bookedService && bookedService.requiredResourceIds) {
                        bookedService.requiredResourceIds.forEach((resId: string) => {
                            if (!resourceCounts[resId]) resourceCounts[resId] = {};
                            resourceCounts[resId][b.slot] = (resourceCounts[resId][b.slot] || 0) + 1;
                        });
                    }
                }
            }

            // Pre-load required resources
            const resourceMap = new Map();
            for (const resId of service.requiredResourceIds) {
                const resource = await ResourcesStore.getResourceById(resId);
                if (resource) resourceMap.set(resId, resource);
            }

            // Filter slots based on resource limits
            availableSlots = availableSlots.filter(slot => {
                // Check if ALL required resources are available for this slot
                return service.requiredResourceIds.every((resId: string) => {
                    const resource = resourceMap.get(resId);
                    if (!resource) return true; // Resource not found, ignore

                    const usedCount = (resourceCounts[resId] && resourceCounts[resId][slot]) || 0;
                    return usedCount < resource.totalQuantity;
                });
            });
        }
    }

    // 6. Collect other-branch conflict data if requested
    const response: any = { slots: availableSlots };
    if (otherBranches && clinicId) {
        response.otherBranchSlots = Scheduler.getOtherBranchSlots(doctorId, date, clinicId);
    }

    return NextResponse.json(response);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { doctorId, date, slots, clinicId } = body;

        if (!doctorId || !date || !Array.isArray(slots)) {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
        }

        const updatedSchedule = Scheduler.setSchedule(doctorId, date, slots, clinicId || 'default');
        return NextResponse.json(updatedSchedule);
    } catch (error) {
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

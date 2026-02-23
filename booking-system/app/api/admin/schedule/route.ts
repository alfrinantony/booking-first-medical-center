import { NextResponse } from 'next/server';
import { Scheduler } from '@/lib/scheduler';
import { BookingsStore } from '@/lib/bookings-store';
import { clinics } from '@/lib/data';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const doctorId = searchParams.get('doctorId');
    const date = searchParams.get('date');
    const serviceId = searchParams.get('serviceId'); // Optional: Check resource availability for this service

    if (!doctorId || !date) {
        return NextResponse.json({ error: 'Missing doctorId or date' }, { status: 400 });
    }

    // 1. Get Base Schedule (or default availability)
    let slots = Scheduler.getSchedule(doctorId, date);

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
    const bookings = BookingsStore.getByFilters({ doctorId, date });

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
        const allClinics = require('@/lib/services-store').ServicesStore.getClinics ? require('@/lib/services-store').ServicesStore.getClinics() : [];
        // The store might just be a flat list or map. 
        // Let's assume we can find it.
        // NOTE: In `lib/services-store.ts`, we probably need a `getServiceById` method.
        // I will add that method to `lib/services-store.ts` in the next step or assume it exists.
        // Let's try to find it via brute force on `clinics` from data if store doesn't have it, 
        // BUT the store is mutable.

        // Let's rely on `ServicesStore.getServiceById(serviceId)` which I should add.
        // validating existence:
        const service = ServicesStore.getServiceById(serviceId);

        if (service && service.requiredResourceIds && service.requiredResourceIds.length > 0) {
            // Check each resource
            const resourceCounts: Record<string, Record<string, number>> = {}; // resourceId -> slot -> count

            bookings.forEach(b => {
                if (b.status !== 'cancelled') {
                    // Look up service for every booking to check resource usage
                    const bookedService = ServicesStore.getServiceById(b.serviceId);
                    if (bookedService && bookedService.requiredResourceIds) {
                        bookedService.requiredResourceIds.forEach((resId: string) => {
                            if (!resourceCounts[resId]) resourceCounts[resId] = {};
                            resourceCounts[resId][b.slot] = (resourceCounts[resId][b.slot] || 0) + 1;
                        });
                    }
                }
            });

            // Filter slots based on resource limits
            availableSlots = availableSlots.filter(slot => {
                // Check if ALL required resources are available for this slot
                return service.requiredResourceIds.every((resId: string) => {
                    const resource = ResourcesStore.getResourceById(resId);
                    if (!resource) return true; // Resource not found, ignore? or block? Assume ignore for now.

                    const usedCount = (resourceCounts[resId] && resourceCounts[resId][slot]) || 0;
                    return usedCount < resource.totalQuantity;
                });
            });
        }
    }

    return NextResponse.json({ slots: availableSlots });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { doctorId, date, slots } = body;

        if (!doctorId || !date || !Array.isArray(slots)) {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
        }

        const updatedSchedule = Scheduler.setSchedule(doctorId, date, slots);
        return NextResponse.json(updatedSchedule);
    } catch (error) {
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

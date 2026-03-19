export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { ServicesStore } from '@/lib/services-store';
import { BOOKING_CATEGORIES } from '@/lib/data';
import { Scheduler } from '@/lib/scheduler';

/**
 * GET /api/booking-catalog
 *
 * Returns an aggregated catalog for the customer booking wizard.
 * Services are grouped by category across ALL clinics/branches,
 * and each service lists which clinic+department combos offer it.
 */
export async function GET() {
    const clinics = await ServicesStore.getClinics();

    // Build a map: serviceName → aggregated service data
    const serviceMap = new Map<string, {
        service: any;
        availability: { clinicId: string; clinicName: string; departmentId: string; doctors: any[] }[];
    }>();

    for (const clinic of clinics) {
        for (const dept of clinic.departments) {
            for (const svc of dept.services) {
                // Skip services that are hidden from the booking portal
                if (svc.isVisible === false) continue;
                const category = svc.category || 'General Services';
                const key = `${category}::${svc.name}`;

                if (!serviceMap.has(key)) {
                    serviceMap.set(key, {
                        service: {
                            id: svc.id,
                            name: svc.name,
                            category,
                            price: svc.price,
                            regularPrice: svc.regularPrice,
                            discountedPrice: svc.discountedPrice,
                            threeSessionPackage: svc.threeSessionPackage,
                            sixSessionPackage: svc.sixSessionPackage,
                            duration: svc.duration,
                            description: svc.description,
                            image: svc.image,
                            preCare: svc.preCare,
                            postCare: svc.postCare,
                            isTaxable: svc.isTaxable,
                            followUpDuration: svc.followUpDuration,
                            minimumIntervalDays: svc.minimumIntervalDays,
                            allowedGender: svc.allowedGender,
                            allowedDays: svc.allowedDays,
                            timeWindow: svc.timeWindow,
                            screeningQuestions: svc.screeningQuestions,
                            maxMedicines: svc.maxMedicines,
                            medicineIds: svc.medicineIds,
                            medicineSelectionMode: svc.medicineSelectionMode,
                            consumableIds: svc.consumableIds,
                            addOns: svc.addOns,
                            peakDays: svc.peakDays,
                            peakSlots: svc.peakSlots,
                            allowedDoctorIds: svc.allowedDoctorIds,
                        },
                        availability: [],
                    });
                }

                const entry = serviceMap.get(key)!;
                // Add this clinic+dept as an availability option
                entry.availability.push({
                    clinicId: clinic.id,
                    clinicName: clinic.name,
                    departmentId: dept.id,
                    doctors: Array.from(
                        new Map(
                            clinic.departments
                                .flatMap(d => d.doctors)
                                .filter(d => d.status !== 'not_working')
                                .map(d => [d.id, d])
                        ).values()
                    ).map(d => ({
                            id: d.id,
                            name: d.name,
                            specialty: d.specialty,
                            image: d.image,
                            maxConcurrentBookings: d.maxConcurrentBookings,
                            daysOff: d.daysOff,
                            startDate: d.startDate,
                            endDate: d.endDate,
                            status: d.status,
                        })),
                });
            }
        }
    }

    // Build flattened services array
    const services = Array.from(serviceMap.values()).map(entry => ({
        ...entry.service,
        availability: entry.availability,
    }));

    // Build category list (ordered by BOOKING_CATEGORIES, then any extras)
    const foundCategories = new Set(services.map(s => s.category));
    const orderedCategories: string[] = [];
    for (const cat of BOOKING_CATEGORIES) {
        if (foundCategories.has(cat)) {
            orderedCategories.push(cat);
            foundCategories.delete(cat);
        }
    }
    // Append any categories not in the predefined list
    for (const cat of foundCategories) {
        orderedCategories.push(cat);
    }

    // Also return clinic summaries for the branch selection step
    const clinicSummaries = clinics.map(c => ({
        id: c.id,
        name: c.name,
        address: c.address,
        vatPercentage: c.vatPercentage,
        image: c.image,
        operationHours: c.operationHours,
        locationMap: c.locationMap,
        parkingInfo: c.parkingInfo,
        contactPhone: c.contactPhone,
        email: c.email,
        workingDays: c.workingDays,
        openingTime: c.openingTime,
        closingTime: c.closingTime,
        coordinates: c.coordinates,
        cid: c.cid,
        rating: c.rating,
        reviewCount: c.reviewCount,
    }));

    return NextResponse.json({
        categories: orderedCategories,
        services,
        clinics: clinicSummaries,
        schedules: Scheduler.getAllSchedules(),
    });
}

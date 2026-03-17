export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { Scheduler } from '@/lib/scheduler';
import { BookingsStore } from '@/lib/bookings-store';
import { clinics } from '@/lib/data';
import { HRShiftStore } from '@/lib/hr-shift-store';

// ── Helper: parse "10:30 AM" → minutes from midnight ──
function parseSlotToMinutes(slot: string): number {
    const [time, period] = slot.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
}

// ── Helper: parse "17:00" (24h) → minutes from midnight ──
function parse24hToMinutes(time: string | undefined): number | null {
    if (!time) return null;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + (m || 0);
}

// ── Helper: check if two time ranges overlap ──
function rangesOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
    return startA < endB && startB < endA;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const doctorId = searchParams.get('doctorId');
    const date = searchParams.get('date');
    const clinicId = searchParams.get('clinicId') || undefined;
    const otherBranches = searchParams.get('otherBranches') === 'true';
    const serviceId = searchParams.get('serviceId');

    if (!doctorId || !date) {
        return NextResponse.json({ error: 'Missing doctorId or date' }, { status: 400 });
    }

    // ── 1. Clinician Availability Check (shift integration) ──
    const availability = await HRShiftStore.isClinicianAvailable(doctorId, date);
    if (!availability.available) {
        return NextResponse.json({
            slots: [],
            unavailable: true,
            reason: availability.reason || 'Clinician not on duty',
        });
    }

    const { timeSlots } = require('@/lib/data');
    const { ServicesStore } = require('@/lib/services-store');
    const { ResourcesStore } = require('@/lib/resources-store');

    // ── 2. Get Base Schedule Slots (15-min checkpoints representing doctor availability) ──
    let baseScheduleSlots: string[] = Scheduler.getSchedule(doctorId, date, clinicId);
    if (baseScheduleSlots.length === 0) {
        baseScheduleSlots = timeSlots;
    }

    // ── 3. Resolve Requested Service Duration ──
    let requestedDuration = 30; // Default 30 min
    let requestedService: any = null;
    if (serviceId) {
        requestedService = await ServicesStore.getServiceById(serviceId);
        if (requestedService?.duration) {
            requestedDuration = requestedService.duration;
        }
    }

    // ── 3b. Generate Candidate Slots at Service-Duration Intervals ──
    // Convert base schedule to a Set of available minutes for fast lookup
    const availableMinutesSet = new Set<number>();
    for (const slot of baseScheduleSlots) {
        availableMinutesSet.add(parseSlotToMinutes(slot));
    }

    // Find the time window from the schedule
    const scheduleMinutesArray = Array.from(availableMinutesSet).sort((a, b) => a - b);
    const scheduleStart = scheduleMinutesArray.length > 0 ? scheduleMinutesArray[0] : 10 * 60;
    const scheduleEnd = scheduleMinutesArray.length > 0 ? scheduleMinutesArray[scheduleMinutesArray.length - 1] + 15 : 22 * 60;

    // Helper: convert minutes to slot string like "02:30 PM"
    function minutesToSlotString(totalMinutes: number): string {
        let h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        const period = h >= 12 ? 'PM' : 'AM';
        if (h > 12) h -= 12;
        if (h === 0) h = 12;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
    }

    // Generate slots at service-duration intervals
    // A slot is valid only if every 15-min checkpoint within its duration is in the doctor's schedule
    let slots: string[] = [];
    for (let startMin = scheduleStart; startMin + requestedDuration <= scheduleEnd; startMin += requestedDuration) {
        // Verify all 15-min blocks within this slot are available in the schedule
        let allAvailable = true;
        for (let checkpoint = startMin; checkpoint < startMin + requestedDuration; checkpoint += 15) {
            if (!availableMinutesSet.has(checkpoint)) {
                allAvailable = false;
                break;
            }
        }
        if (allAvailable) {
            slots.push(minutesToSlotString(startMin));
        }
    }

    // ── 4. Resolve Branch Closing Time (minutes from midnight) ──
    let closingMinutes = 22 * 60; // Default 10 PM
    if (clinicId) {
        // Try dynamic store first, then fall back to static data
        const storedClinic = await ServicesStore.getClinicById(clinicId);
        const staticClinic = clinics.find(c => c.id === clinicId);
        const closingStr = storedClinic?.closingTime || staticClinic?.closingTime;
        const parsed = parse24hToMinutes(closingStr);
        if (parsed !== null) closingMinutes = parsed;
    }

    // ── 5. Get Doctor Capacity (dynamic store first, fallback to static) ──
    let maxConcurrent = 1;
    const allClinics = await ServicesStore.getClinics();
    const clinicSources = allClinics.length > 0 ? allClinics : clinics;
    for (const c of clinicSources) {
        let found = false;
        for (const dept of c.departments) {
            const doc = dept.doctors.find((d: any) => d.id === doctorId);
            if (doc) {
                maxConcurrent = doc.maxConcurrentBookings || 1;
                found = true;
                break;
            }
        }
        if (found) break;
    }

    // ── 6. Get Existing Bookings & Build Occupied Time Ranges ──
    const bookings = await BookingsStore.getByFilters({ doctorId, date });
    const activeBookings = bookings.filter(b => b.status !== 'cancelled');

    // Build occupied ranges for the SELECTED doctor
    const occupiedRanges: { start: number; end: number; serviceId: string; resourceIds: string[]; doctorId: string }[] = [];

    for (const b of activeBookings) {
        const bStart = parseSlotToMinutes(b.slot);
        let bDuration = b.duration || 30;
        if (!b.duration) {
            const bService = await ServicesStore.getServiceById(b.serviceId);
            if (bService?.duration) bDuration = bService.duration;
        }
        const bEnd = bStart + bDuration;

        let resourceIds: string[] = [];
        const bService = await ServicesStore.getServiceById(b.serviceId);
        if (bService?.requiredResourceIds) {
            resourceIds = bService.requiredResourceIds;
        }

        occupiedRanges.push({ start: bStart, end: bEnd, serviceId: b.serviceId, resourceIds, doctorId: b.doctorId });
    }

    // ── 6b. Cross-Doctor Resource Check: get ALL bookings at this branch on this date ──
    // (for shared resource blocking across different doctors)
    let branchOccupiedRanges: typeof occupiedRanges = [];
    if (clinicId && requestedService?.requiredResourceIds?.length > 0) {
        const allBranchBookings = await BookingsStore.getByFilters({ clinicId, date });
        const activeBranch = allBranchBookings.filter(b => b.status !== 'cancelled' && b.doctorId !== doctorId);
        for (const b of activeBranch) {
            const bStart = parseSlotToMinutes(b.slot);
            let bDuration = b.duration || 30;
            if (!b.duration) {
                const bService = await ServicesStore.getServiceById(b.serviceId);
                if (bService?.duration) bDuration = bService.duration;
            }
            const bEnd = bStart + bDuration;
            let resourceIds: string[] = [];
            const bService = await ServicesStore.getServiceById(b.serviceId);
            if (bService?.requiredResourceIds) resourceIds = bService.requiredResourceIds;
            branchOccupiedRanges.push({ start: bStart, end: bEnd, serviceId: b.serviceId, resourceIds, doctorId: b.doctorId });
        }
    }

    // ── 7. Filter Slots with Duration-Aware Logic ──
    let availableSlots = slots.filter(slot => {
        const candidateStart = parseSlotToMinutes(slot);
        const candidateEnd = candidateStart + requestedDuration;

        // Check 1: Service must finish before branch closing time
        if (candidateEnd > closingMinutes) return false;

        // Check 2: Count overlapping bookings for doctor capacity
        let overlapCount = 0;
        for (const range of occupiedRanges) {
            if (rangesOverlap(candidateStart, candidateEnd, range.start, range.end)) {
                overlapCount++;
            }
        }
        if (overlapCount >= maxConcurrent) return false;

        return true;
    });

    // ── 8. Resource Availability Check (duration-aware, cross-doctor) ──
    if (requestedService?.requiredResourceIds && requestedService.requiredResourceIds.length > 0) {
        // Pre-load required resources
        const resourceMap = new Map<string, any>();
        for (const resId of requestedService.requiredResourceIds) {
            const resource = await ResourcesStore.getResourceById(resId);
            if (resource) resourceMap.set(resId, resource);
        }

        // Combine this doctor's ranges + all other doctors' ranges at same branch
        const allResourceRanges = [...occupiedRanges, ...branchOccupiedRanges];

        availableSlots = availableSlots.filter(slot => {
            const candidateStart = parseSlotToMinutes(slot);
            const candidateEnd = candidateStart + requestedDuration;

            // Check each required resource
            return requestedService.requiredResourceIds.every((resId: string) => {
                const resource = resourceMap.get(resId);
                if (!resource) return true; // Resource not found, skip check

                // Count how many existing bookings (ANY doctor) use this resource during our time window
                let usedCount = 0;
                for (const range of allResourceRanges) {
                    if (range.resourceIds.includes(resId) && rangesOverlap(candidateStart, candidateEnd, range.start, range.end)) {
                        usedCount++;
                    }
                }
                return usedCount < resource.totalQuantity;
            });
        });
    }

    // ── 9. Build Response with metadata ──
    const response: any = {
        slots: availableSlots,
        serviceDuration: requestedDuration,
        closingTime: closingMinutes,
    };
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

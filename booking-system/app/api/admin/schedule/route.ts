export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { Scheduler } from '@/lib/scheduler';
import { BookingsStore } from '@/lib/bookings-store';
import { clinics } from '@/lib/data';
import { HRShiftStore } from '@/lib/hr-shift-store';
import { HRStore } from '@/lib/hr-store';
import { isEmployeeOnApprovedLeave } from '@/lib/hr-leave-store';
import { ServicesStore } from '@/lib/services-store';

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
    const clientId = searchParams.get('clientId');

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

    // ── 1b. HR Leave Validation ──
    const hrEmployees = await HRStore.getAll();
    let employee = hrEmployees.find(e => e.id === doctorId);
    let doctorObjResult = null;
    
    // Resolve doctor object for fallback name matching
    // (We also use this to get the real doctor name below)
    const allClinicsHrCheck = await ServicesStore.getClinics();
    for (const c of allClinicsHrCheck) {
        for (const dept of c.departments) {
            const d = dept.doctors.find((x: any) => x.id === doctorId);
            if (d) {
                doctorObjResult = d;
                break;
            }
        }
        if (doctorObjResult) break;
    }

    if (!employee && doctorObjResult) {
        const docName = doctorObjResult.name.replace(/^Dr\.\s+/i, '').toLowerCase().trim();
        employee = hrEmployees.find(e => 
            `${e.firstName} ${e.lastName}`.toLowerCase().includes(docName) || 
            docName.includes(`${e.firstName} ${e.lastName}`.toLowerCase())
        );
    }

    if (employee) {
        const onLeave = await isEmployeeOnApprovedLeave(employee.id, date);
        if (onLeave) {
            return NextResponse.json({
                slots: [],
                unavailable: true,
                reason: 'Clinician is on approved leave today.',
            });
        }
    }

    const { timeSlots } = require('@/lib/data');
    const { ResourcesStore } = require('@/lib/resources-store');

    // ── 2. Get Base Schedule Slots (15-min checkpoints representing doctor availability) ──
    let baseScheduleSlots: string[] = await Scheduler.getSchedule(doctorId, date, clinicId);
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

    // ── 3b. Handle Admin Edit Mode (bypass duration merging) ──
    const editMode = searchParams.get('editMode') === 'true';
    if (editMode) {
        let closingMinutes = 22 * 60; // Default 10 PM
        if (clinicId) {
            const storedClinic = await ServicesStore.getClinicById(clinicId);
            const staticClinic = clinics.find(c => c.id === clinicId);
            const closingStr = storedClinic?.closingTime || staticClinic?.closingTime;
            const parsed = parse24hToMinutes(closingStr);
            if (parsed !== null) closingMinutes = parsed;
        }

        const response: any = {
            slots: baseScheduleSlots, // Return raw 15-minute blocks for the admin UI
            serviceDuration: requestedDuration,
            closingTime: closingMinutes,
        };
        if (otherBranches && clinicId) {
            response.otherBranchSlots = await Scheduler.getOtherBranchSlots(doctorId, date, clinicId);
        }
        return NextResponse.json(response);
    }

    // ── 3c. Generate Candidate Slots at Service-Duration Intervals ──
    // Convert base schedule to a Set of available minutes for fast lookup
    const availableMinutesSet = new Set<number>();
    for (const slot of baseScheduleSlots) {
        availableMinutesSet.add(parseSlotToMinutes(slot));
    }

    // Find the absolute maximum bounds
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

    // Generate slots at strict geometries anchored to 10:00 AM initially.
    // 60-min: 10:00, 11:00, 12:00
    // 45-min: 10:00, 10:45, 11:30
    // ── 4. Resolve Branch Closing Time (minutes from midnight) ──
    let closingMinutes = 22 * 60; // Default 10 PM
    if (clinicId) {
        const storedClinic = await ServicesStore.getClinicById(clinicId);
        const staticClinic = clinics.find(c => c.id === clinicId);
        const closingStr = storedClinic?.closingTime || staticClinic?.closingTime;
        const parsed = parse24hToMinutes(closingStr);
        if (parsed !== null) closingMinutes = parsed;
    }

    // ── 5. Get Doctor Capacity (dynamic store first, fallback to static) ──
    let maxConcurrent = 1;
    const allClinicsCapacity = await ServicesStore.getClinics();
    const clinicSources = allClinicsCapacity.length > 0 ? allClinicsCapacity : clinics;
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

    const occupiedRanges: { start: number; end: number; serviceId: string; resourceIds: string[]; equipmentIds: string[]; doctorId: string }[] = [];
    for (const b of activeBookings) {
        const bStart = parseSlotToMinutes(b.slot);
        let bDuration = b.duration || 30;
        if (!b.duration) {
            const bService = await ServicesStore.getServiceById(b.serviceId);
            if (bService?.duration) bDuration = bService.duration;
        }
        const bEnd = bStart + bDuration;
        
        let resourceIds: string[] = [];
        let equipmentIds: string[] = [];
        const bService = await ServicesStore.getServiceById(b.serviceId);
        if (bService?.requiredResourceIds) resourceIds = bService.requiredResourceIds;
        if (bService?.requiredEquipmentIds) equipmentIds = bService.requiredEquipmentIds;
        
        occupiedRanges.push({ start: bStart, end: bEnd, serviceId: b.serviceId, resourceIds, equipmentIds, doctorId: b.doctorId });
    }

    // ── 6b. Shared Resource Check (Cross-Doctor Bookings) ──
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
            let equipmentIds: string[] = [];
            const bService = await ServicesStore.getServiceById(b.serviceId);
            if (bService?.requiredResourceIds) resourceIds = bService.requiredResourceIds;
            if (bService?.requiredEquipmentIds) equipmentIds = bService.requiredEquipmentIds;
            
            branchOccupiedRanges.push({ start: bStart, end: bEnd, serviceId: b.serviceId, resourceIds, equipmentIds, doctorId: b.doctorId });
        }
    }

    // Pre-load resources if needed
    const resourceMap = new Map<string, any>();
    if (requestedService?.requiredResourceIds && requestedService.requiredResourceIds.length > 0) {
        for (const resId of requestedService.requiredResourceIds) {
            const { ResourcesStore } = require('@/lib/resources-store');
            const resource = await ResourcesStore.getResourceById(resId);
            if (resource) resourceMap.set(resId, resource);
        }
    }
    
    // Pre-load equipments if needed
    const { EquipmentStore } = require('@/lib/equipment-store');
    const allEquipments = await EquipmentStore.getAll();
    let requestedEquipmentCapacity = 0;
    if (requestedService?.requiredEquipmentIds && requestedService.requiredEquipmentIds.length > 0) {
        for (const eqId of requestedService.requiredEquipmentIds) {
            const eq = allEquipments.find((e: any) => e.id === eqId);
            if (eq) requestedEquipmentCapacity += eq.quantity || 1;
        }
    }
    const allResourceRanges = [...occupiedRanges, ...branchOccupiedRanges];

    // ── 7. Generate Slots with Duration-Aware Increments ──
    const CLINIC_OPENING_MINUTES = 10 * 60;
    let availableSlots: string[] = [];
    let currentMin = CLINIC_OPENING_MINUTES;
    let anySlotRejectedDueToEquipment = false;

    while (currentMin + requestedDuration <= Math.min(scheduleEnd, closingMinutes)) {
        let isAvailable = true;

        // A. Verify all 15-min sub-blocks within this requested duration chunk are available on doctor's schedule
        for (let checkpoint = currentMin; checkpoint < currentMin + requestedDuration; checkpoint += 15) {
            if (!availableMinutesSet.has(checkpoint)) {
                isAvailable = false;
                break;
            }
        }

        // B. Check for existing booking overlaps (Doctor Capacity)
        if (isAvailable) {
            let overlapCount = 0;
            for (const range of occupiedRanges) {
                if (rangesOverlap(currentMin, currentMin + requestedDuration, range.start, range.end)) {
                    overlapCount++;
                }
            }
            if (overlapCount >= maxConcurrent) isAvailable = false;
        }

        // C. Check Resource availability (Cross-Doctor)
        if (isAvailable && requestedService?.requiredResourceIds && requestedService.requiredResourceIds.length > 0) {
            const hasResources = requestedService.requiredResourceIds.every((resId: string) => {
                const resource = resourceMap.get(resId);
                if (!resource) return true; 

                let usedCount = 0;
                for (const range of allResourceRanges) {
                    if (range.resourceIds.includes(resId) && rangesOverlap(currentMin, currentMin + requestedDuration, range.start, range.end)) {
                        usedCount++;
                    }
                }
                return usedCount < resource.totalQuantity;
            });
            if (!hasResources) isAvailable = false;
        }

        // C2. Check Equipment availability (Cross-Doctor)
        if (isAvailable && requestedService?.requiredEquipmentIds && requestedService.requiredEquipmentIds.length > 0) {
            let usedEquipmentCount = 0;
            // Any booking that uses ANY of the same equipment IDs consumes 1 unit of capacity from this pool
            for (const range of allResourceRanges) {
                const usesSharedEquipment = range.equipmentIds && range.equipmentIds.some((id: string) => requestedService.requiredEquipmentIds.includes(id));
                if (usesSharedEquipment && rangesOverlap(currentMin, currentMin + requestedDuration, range.start, range.end)) {
                    usedEquipmentCount++;
                }
            }
            if (usedEquipmentCount >= requestedEquipmentCapacity) {
                isAvailable = false;
                anySlotRejectedDueToEquipment = true;
            }
        }

        // D. Check No-Show peak restrictions
        if (isAvailable && clientId) {
            const { RestrictionsStore } = require('@/lib/restrictions-store');
            const restricted = await RestrictionsStore.isSlotRestricted(clientId, new Date(date as string), minutesToSlotString(currentMin), serviceId);
            if (restricted) isAvailable = false;
        }

        if (isAvailable) {
            availableSlots.push(minutesToSlotString(currentMin));
            // Jump by the duration of the service so slots don't overlap with themselves on the grid
            currentMin += requestedDuration;
        } else {
            // Slide by 15 mins to search for the next available chunk that fits
            currentMin += 15;
        }
    }

    // ── 8. Build Response with metadata ──
    const response: any = {
        slots: availableSlots,
        serviceDuration: requestedDuration,
        closingTime: closingMinutes,
        equipmentCapacityReached: anySlotRejectedDueToEquipment,
        alternativeServiceId: requestedService?.alternativeServiceId || null,
    };
    if (otherBranches && clinicId) {
        response.otherBranchSlots = await Scheduler.getOtherBranchSlots(doctorId, date, clinicId);
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

        // Check HR Leaves before creating schedule manager records
        const hrEmployees = await HRStore.getAll();
        let employee = hrEmployees.find(e => e.id === doctorId);
        
        let doctorObjResult = null;
        const allClinics = await ServicesStore.getClinics();
        for (const c of allClinics) {
            for (const dept of c.departments) {
                const d = dept.doctors.find((x: any) => x.id === doctorId);
                if (d) { doctorObjResult = d; break; }
            }
            if (doctorObjResult) break;
        }

        if (!employee && doctorObjResult) {
            const docName = doctorObjResult.name.replace(/^Dr\.\s+/i, '').toLowerCase().trim();
            employee = hrEmployees.find(e => 
                `${e.firstName} ${e.lastName}`.toLowerCase().includes(docName) || 
                docName.includes(`${e.firstName} ${e.lastName}`.toLowerCase())
            );
        }

        if (employee) {
            const onLeave = await isEmployeeOnApprovedLeave(employee.id, date);
            if (onLeave) {
                return NextResponse.json({ error: 'Cannot assign schedule to a clinician on approved leave.' }, { status: 400 });
            }
        }

        const updatedSchedule = await Scheduler.setSchedule(doctorId, date, slots, clinicId || 'default');
        return NextResponse.json(updatedSchedule);
    } catch (error) {
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

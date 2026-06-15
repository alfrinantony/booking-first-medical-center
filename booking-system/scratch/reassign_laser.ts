import { BookingsStore } from '../lib/bookings-store';
import { SimplybookStore } from '../lib/simplybook-store';
import { DoctorsStore } from '../lib/doctors-store';


function parseSlotToMinutes(slot: string): number {
    const [hh, mm] = slot.split(':').map(Number);
    return hh * 60 + mm;
}

async function run() {
    console.log('Loading stores...');
    const allBookings = await BookingsStore.getAll();
    const allSb = await SimplybookStore.getAll();
    
    const clinics = await DoctorsStore.getClinics();
    const allDocs = clinics.flatMap(c => c.departments.map(d => ({ ...d, clinicId: c.id })).flatMap(d => d.doctors.map(doc => ({ ...doc, clinicId: d.clinicId, deptId: d.id, departmentName: d.name }))));

    const laserDocs = allDocs.filter(d => 
        ((d.departmentName && d.departmentName.toLowerCase().includes('laser')) || 
        (d.allowedServiceNames && d.allowedServiceNames.some((s: string) => s.toLowerCase().includes('laser')))) &&
        !d.name.startsWith('Dr.')
    );

    console.log(`Found ${laserDocs.length} doctors who can perform laser.`);

    // Map SB records by ID for quick lookup
    const sbMap = new Map(allSb.map(sb => [sb.sbId, sb]));

    const anyDoctorBookings = allBookings.filter(b => b.anyDoctor === true);
    console.log(`Found ${anyDoctorBookings.length} anyDoctor bookings total.`);

    let reassigned = 0;

    for (const b of anyDoctorBookings) {
        if (!b.sbId) continue;
        
        const sbRecord = sbMap.get(b.sbId);
        if (!sbRecord) continue;

        const svcName = (sbRecord.serviceName || '').toLowerCase();
        
        // If the service is laser hair removal
        if (svcName.includes('laser')) {
            // Find a free laser doctor
            let alternativeDoc = null;

            for (const candidate of laserDocs) {
                // Check if candidate is free
                const candidateOverlaps = allBookings.some(ob => 
                    ob.id !== b.id && // ignore self
                    ob.doctorId === candidate.id &&
                    ob.date === b.date &&
                    ob.status !== 'cancelled' &&
                    (() => {
                        const bStart = parseSlotToMinutes(b.slot);
                        const bEnd = bStart + (b.duration || 30);
                        const oStart = parseSlotToMinutes(ob.slot);
                        const oEnd = oStart + (ob.duration || 30);
                        return oStart < bEnd && bStart < oEnd;
                    })()
                );

                if (!candidateOverlaps) {
                    alternativeDoc = candidate;
                    break;
                }
            }

            if (!alternativeDoc) {
                console.log(`Booking ${b.id}: No alternative doc found. All ${laserDocs.length} laser docs overlap!`);
            } else if (alternativeDoc.id === b.doctorId) {
                // Already assigned to the best free laser doc
            } else {
                console.log(`Reassigning booking ${b.id} (${b.patientName}) from ${b.doctorId} to ${alternativeDoc.id} for service ${sbRecord.serviceName}`);
                await BookingsStore.update(b.id, {
                    doctorId: alternativeDoc.id,
                    deptId: alternativeDoc.deptId,
                    clinicId: alternativeDoc.clinicId
                });
                b.doctorId = alternativeDoc.id; // Update in-memory to prevent future overlaps
                reassigned++;
            }
        }
    }

    console.log(`Successfully reassigned ${reassigned} laser bookings.`);
}

run().catch(console.error);

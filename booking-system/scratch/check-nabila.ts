import { Scheduler } from '../lib/scheduler';
import { HRShiftStore } from '../lib/hr-shift-store';
import { ServicesStore } from '../lib/services-store';

async function main() {
    const clinics = await ServicesStore.getClinics();
    let doctorId = null;
    
    // Find Dr. Nabila Battat
    for (const c of clinics) {
        for (const d of c.departments) {
            const doc = d.doctors.find(doc => doc.name.includes('Nabila'));
            if (doc) {
                doctorId = doc.id;
                console.log(`Found Dr. Nabila Battat: ${doctorId}`);
                break;
            }
        }
        if (doctorId) break;
    }

    if (!doctorId) {
        console.log("Could not find doctor ID for Nabila.");
        // Try fallback with data.ts
        const { clinics: staticClinics } = require('../lib/data');
        for (const c of staticClinics) {
            for (const d of c.departments) {
                const doc = d.doctors.find((doc: any) => doc.name.includes('Nabila'));
                if (doc) {
                    doctorId = doc.id;
                    console.log(`Found Dr. Nabila Battat in static data: ${doctorId}`);
                    break;
                }
            }
            if (doctorId) break;
        }
    }

    if (!doctorId) {
        console.log("Could not find Dr. Nabila Battat in the system.");
        return;
    }

    const date = '2026-06-17';
    
    // Check HR shifts
    const avail = await HRShiftStore.isClinicianAvailable(doctorId, date);
    console.log(`\nHR Availability on ${date}:`, avail);

    // Check clinician schedules
    const schedules = await Scheduler.getAllSchedules();
    const docSchedule = schedules.find(s => s.doctorId === doctorId && s.date === date);
    console.log(`\nClinician Schedule on ${date}:`, docSchedule);
}

main().catch(console.error);

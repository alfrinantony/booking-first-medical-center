import { SimplybookStore } from '../lib/simplybook-store';
import { DoctorsStore } from '../lib/doctors-store';
import { BookingsStore } from '../lib/bookings-store';

function normalizeName(name: string) {
    if (!name) return '';
    return name.toLowerCase().replace(/[^a-z]/g, '');
}

async function run() {
    console.log('Loading stores...');
    const sbRecords = await SimplybookStore.getAll();
    const clinics = await DoctorsStore.getClinics();
    
    const allDoctors = clinics.flatMap(c => c.departments.flatMap(d => d.doctors));
    console.log(`Loaded ${sbRecords.length} SB records and ${allDoctors.length} doctors.`);

    let matchedCount = 0;
    
    for (const sb of sbRecords) {
        if (sb.matchStatus === 'matched' && sb.syncedToBookingsId) {
            continue; // Already matched
        }

        const dateStr = sb.date || sb.startDateTime?.split('T')[0];
        if (dateStr && dateStr < '2026-05-01') {
            continue; // Skip historical records to be fast
        }

        const sbNorm = normalizeName(sb.providerName || '');
        if (!sbNorm || sbNorm.includes('anyavailable')) continue;

        let bestDoc = null;
        let bestScore = 0;

        for (const doc of allDoctors) {
            const docNorm = normalizeName(doc.name);
            // If one contains the other, it's a very strong match
            if (sbNorm.includes(docNorm) || docNorm.includes(sbNorm)) {
                bestDoc = doc;
                break;
            }
        }

        if (bestDoc) {
            console.log(`Matching SB Provider "${sb.providerName}" -> Doctor "${bestDoc.name}"`);
            
            const newBooking = await BookingsStore.add({
                doctorId: bestDoc.id,
                deptId: bestDoc.departmentId || '',
                clinicId: 'simplybook-import', // Cannot reliably guess clinic without more logic
                serviceId: 'srv-unknown',
                date: sb.date || sb.startDateTime?.split('T')[0] || new Date().toISOString().split('T')[0],
                slot: sb.startDateTime ? new Date(sb.startDateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '09:00 AM',
                duration: 30,
                status: (sb.status as any) || 'booked',
                patientName: sb.clientName,
                whatsappNumber: sb.clientPhone || '',
                email: sb.clientEmail || '',
                sbId: sb.sbId
            } as any);

            await SimplybookStore.upsert({
                ...sb,
                matchStatus: 'matched',
                matchedDoctorId: bestDoc.id,
                syncedToBookingsId: newBooking.id
            } as any);
            
            matchedCount++;
            if (matchedCount % 100 === 0) console.log(`Matched ${matchedCount} records...`);
        }
    }
    
    console.log(`Finished matching! Newly matched: ${matchedCount}`);
}

run().catch(console.error);

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const simplybook_store_1 = require("../lib/simplybook-store");
const doctors_store_1 = require("../lib/doctors-store");
const bookings_store_1 = require("../lib/bookings-store");
function normalizeName(name) {
    if (!name)
        return '';
    return name.toLowerCase().replace(/[^a-z]/g, '');
}
async function run() {
    console.log('Loading stores...');
    const sbRecords = await simplybook_store_1.SimplybookStore.getAll();
    const clinics = await doctors_store_1.DoctorsStore.getClinics();
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
        if (!sbNorm)
            continue;
        let bestDoc = null;
        let bestScore = 0;
        if (sbNorm.includes('anyavailable')) {
            bestDoc = allDoctors[0]; // Just assign the first doctor temporarily; the bump logic will handle conflicts.
        }
        else {
            for (const doc of allDoctors) {
                const docNorm = normalizeName(doc.name);
                // If one contains the other, it's a very strong match
                if (sbNorm.includes(docNorm) || docNorm.includes(sbNorm)) {
                    bestDoc = doc;
                    break;
                }
            }
        }
        if (bestDoc) {
            console.log(`Matching SB Provider "${sb.providerName}" -> Doctor "${bestDoc.name}"`);
            const newBooking = await bookings_store_1.BookingsStore.add({
                doctorId: bestDoc.id,
                deptId: bestDoc.departmentId || 'unknown',
                clinicId: 'simplybook-import', // Cannot reliably guess clinic without more logic
                serviceId: 'srv-unknown',
                date: sb.date || sb.startDateTime?.split('T')[0] || new Date().toISOString().split('T')[0],
                slot: sb.startDateTime ? new Date(sb.startDateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '09:00 AM',
                duration: 30,
                status: sb.status || 'booked',
                patientName: sb.clientName,
                whatsappNumber: sb.clientPhone || '',
                email: sb.clientEmail || '',
                sbId: sb.sbId,
                anyDoctor: sbNorm.includes('anyavailable')
            });
            await simplybook_store_1.SimplybookStore.upsert({
                ...sb,
                matchStatus: 'matched',
                matchedDoctorId: bestDoc.id,
                syncedToBookingsId: newBooking.id
            });
            matchedCount++;
            if (matchedCount % 100 === 0)
                console.log(`Matched ${matchedCount} records...`);
        }
    }
    console.log(`Finished matching! Newly matched: ${matchedCount}`);
}
run().catch(console.error);

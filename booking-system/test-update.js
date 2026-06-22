const { BookingsStore } = require('./lib/bookings-store');

async function main() {
    const id = "1arfskox9"; // Angelique's booking
    const body = {
        status: "confirmed",
        clinicId: "clinic-2",
        deptId: "c2-Nursing-Hair Removal",
        serviceId: "c2-Laser & Electrolysis Hair Removal-svc-1773406452340",
        doctorId: "doc-1773474584179",
        date: "2026-06-20",
        slot: "10:00",
        duration: 30,
        patientName: "ANGELIQUE GAYLE MARQUEZ SANTIAGO",
        whatsappNumber: "+971507851712",
        email: "geni1022@gmail.com",
        staffName: "Test"
    };

    console.log("Updating booking...");
    try {
        const updatedBooking = await BookingsStore.update(id, body);
        console.log("Success:", !!updatedBooking);
        console.log("New Status:", updatedBooking?.status);
        console.log("isModifiedAfterMigration:", updatedBooking?.isModifiedAfterMigration);
    } catch (err) {
        console.error("Error updating:", err);
    }
}

main().catch(console.error);

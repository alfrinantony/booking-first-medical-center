async function test() {
    try {
        console.log('Testing booking PATCH with exact frontend payload...');
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        const booking = await prisma.booking.findFirst({ where: { status: 'booked' } });
        if (!booking) {
            console.log('No booking found');
            return;
        }
        console.log('Updating booking:', booking.id);

        const payload = {
            status: "confirmed",
            date: booking.date,
            slot: booking.slot,
            clinicId: booking.clinicId,
            serviceId: booking.serviceId,
            doctorId: booking.doctorId,
            duration: booking.duration,
            patientName: booking.patientName,
            whatsappNumber: booking.whatsappNumber,
            email: booking.email,
            staffName: "Admin"
        };
        
        console.log("Payload:", payload);

        const res = await fetch(`https://ai.dubaifmc.com/api/bookings/${booking.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const text = await res.text();
        console.log('Status:', res.status);
        console.log('Response:', text);
    } catch(e) { console.error(e); }
}
test();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const bookings = await prisma.booking.findMany({
        where: { date: '2026-06-17', status: { not: 'cancelled' } }
    });
    console.log(JSON.stringify(bookings.map(b => ({
        id: b.id,
        patientName: b.patientName,
        doctorId: b.doctorId,
        anyDoctor: b.anyDoctor,
        clinicId: b.clinicId,
        slot: b.slot,
    })), null, 2));
}

main().finally(() => prisma.$disconnect());

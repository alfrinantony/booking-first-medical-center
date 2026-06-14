const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const b = await prisma.booking.findMany({ 
    where: { date: '2026-06-13' } 
  });
  console.log('Total bookings on June 13:', b.length);
  const elviraBookings = b.filter(x => x.patientName && x.patientName.toLowerCase().includes('elvira'));
  console.log('Elvira bookings:', elviraBookings.map(x => ({
    id: x.id,
    sbId: x.sbId,
    slot: x.slot,
    status: x.status,
    sbPaymentStatus: x.sbPaymentStatus
  })));
}

main().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });

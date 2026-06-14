const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const bookings = await prisma.booking.findMany({ 
    where: { date: '2026-06-13' } 
  });
  console.log(bookings.map(b => ({ 
    id: b.id, 
    patientName: b.patientName, 
    sbId: b.sbId, 
    date: b.date, 
    slot: b.slot, 
    status: b.status 
  })));
}

main().catch(e => { 
  console.error(e); 
  process.exit(1); 
}).finally(async () => { 
  await prisma.$disconnect(); 
});

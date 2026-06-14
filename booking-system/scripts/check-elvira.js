const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const bookings = await prisma.booking.findMany({ 
    where: { patientName: { contains: 'Elvira' } } 
  });
  console.log(bookings.map(b => ({ id: b.id, sbId: b.sbId, date: b.date, slot: b.slot, payment: b.sbPaymentStatus })));
}

main().catch(e => { 
  console.error(e); 
  process.exit(1); 
}).finally(async () => { 
  await prisma.$disconnect(); 
});

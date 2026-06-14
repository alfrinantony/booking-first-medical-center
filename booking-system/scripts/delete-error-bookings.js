const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.booking.deleteMany({
    where: { sbPaymentStatus: 'error' }
  });
  console.log(`Deleted ${result.count} bookings with payment error.`);
}

main().catch(e => { 
  console.error(e); 
  process.exit(1); 
}).finally(async () => { 
  await prisma.$disconnect(); 
});

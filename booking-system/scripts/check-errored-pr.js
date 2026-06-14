const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const b = await prisma.booking.findMany({ 
    where: { sbId: { in: ['242623', '242791', '242624', '242792', '242625'] } } 
  });
  console.log(b);
}

main().catch(e => { 
  console.error(e); 
  process.exit(1); 
}).finally(async () => { 
  await prisma.$disconnect(); 
});

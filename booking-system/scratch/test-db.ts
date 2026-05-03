import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const bookings = await prisma.booking.findMany({ take: 5 });
    console.log("SUCCESS:", bookings.length, "bookings found.");
  } catch (err) {
    console.error("ERROR:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();

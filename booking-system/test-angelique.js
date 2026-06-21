const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const b = await prisma.booking.findMany({
        where: {
            OR: [
                { patientName: { contains: 'ANGELIQUE' } },
                { whatsappNumber: { contains: '971507851712' } }
            ]
        }
    });
    console.log(JSON.stringify(b, null, 2));
}

main().finally(() => prisma.$disconnect());

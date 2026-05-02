const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const record = await prisma.blobStore.findUnique({ where: { key: 'simplybook-bookings' } });
    const data = record.data;
    console.log(data[0]);
}
check().finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.blobStore.findUnique({where: {key: 'simplybook-bookings'}}).then(b => {
    const records = b.data;
    console.log("RECORD 1:", JSON.stringify(records[0], null, 2));
    console.log("RECORD 2:", JSON.stringify(records[1], null, 2));
    prisma.$disconnect();
});

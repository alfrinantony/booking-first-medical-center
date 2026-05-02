const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clean() {
    const record = await prisma.blobStore.findUnique({ where: { key: 'simplybook-bookings' } });
    if (!record || !record.data) {
        console.log('No simplybook-bookings found.');
        return;
    }
    const data = record.data;
    const good = data.filter(d => d.startDateTime && d.startDateTime.includes(':'));
    console.log(`Original: ${data.length}, Good: ${good.length}, Bad deleted: ${data.length - good.length}`);
    
    await prisma.blobStore.update({
        where: { key: 'simplybook-bookings' },
        data: { data: good }
    });
    console.log('Cleaned successfully!');
}
clean().finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    try {
        const clients = await prisma.client.findMany({ take: 1 });
        console.log('Connected! Found:', clients.length);
    } catch(e) {
        console.error('Error connecting:', e);
    } finally {
        await prisma.$disconnect();
    }
}
test();

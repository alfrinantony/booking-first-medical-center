const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    const b = await prisma.booking.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20
    });
    for (const bk of b) {
        const hist = (typeof bk.statusHistory === 'string' ? JSON.parse(bk.statusHistory) : bk.statusHistory) || [];
        if (hist.length > 1) {
             console.log('ID:', bk.id, 'Status:', bk.status, 'History:', JSON.stringify(hist));
        }
    }
}
run().catch(console.error).finally(() => prisma.$disconnect());

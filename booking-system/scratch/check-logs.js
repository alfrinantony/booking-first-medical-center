async function test() {
    try {
        console.log('Querying recent logs for errors...');
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        
        // Let's see if there are any System errors logged in the last hour
        const logs = await prisma.log.findMany({
            where: {
                timestamp: { gte: new Date(Date.now() - 3600000).toISOString() }
            },
            orderBy: { timestamp: 'desc' },
            take: 20
        });
        
        for (const log of logs) {
            if (log.action.includes('ERROR') || log.details.includes('Failed') || log.details.includes('Error')) {
                console.log(log.timestamp, log.action, log.details);
            }
        }
        console.log('Done checking logs.');
    } catch(e) { console.error(e); }
}
test();

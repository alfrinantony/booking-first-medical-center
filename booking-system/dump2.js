const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.booking.findMany({where: {sbId: {not: null}}, select: {id: true, patientName: true, email: true, whatsappNumber: true}, take: 5}).then(b => {
    console.log(b);
    prisma.$disconnect();
});

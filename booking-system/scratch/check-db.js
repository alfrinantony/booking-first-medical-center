const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const blobs = await prisma.blobStore.findMany({ select: { key: true } });
    console.log('BlobStore keys:', blobs.map(b => b.key));
}
check().finally(() => prisma.$disconnect());

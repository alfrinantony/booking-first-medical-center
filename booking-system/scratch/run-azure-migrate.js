const { PrismaClient } = require('@prisma/client');
const { BlobServiceClient } = require('@azure/storage-blob');

const directUrl = "postgresql://postgres.fqphlhchebygaevttmzd:vIa3LbgQItyl8efo@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=60";
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: directUrl
        }
    }
});

const connectionString = 'DefaultEndpointsProtocol=https;EndpointSuffix=core.windows.net;AccountName=stfmcbooking;AccountKey=iPSH3giG76MQjVIsbqbZAt2VuKeyRgFolm1hZz+yYTTfT9NGbP6xN7WhGQ5iyO8esH/9w0uwo6w9+AStxc+QPA==;BlobEndpoint=https://stfmcbooking.blob.core.windows.net/;FileEndpoint=https://stfmcbooking.file.core.windows.net/;QueueEndpoint=https://stfmcbooking.queue.core.windows.net/;TableEndpoint=https://stfmcbooking.table.core.windows.net/';
const containerName = 'fmc-data';

const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
const containerClient = blobServiceClient.getContainerClient(containerName);

async function fetchFromAzure(key) {
    const blobName = key.endsWith('.json') ? key : `${key}.json`;
    const blobClient = containerClient.getBlobClient(blobName);
    try {
        const buffer = await blobClient.downloadToBuffer();
        return JSON.parse(buffer.toString('utf-8'));
    } catch (err) {
        if (err.statusCode === 404) {
            console.log(`Blob ${blobName} not found in Azure.`);
            return null;
        }
        throw err;
    }
}

async function migrateKeys(keys) {
    for (const key of keys) {
        console.log(`Migrating ${key}...`);
        try {
            const data = await fetchFromAzure(key);
            if (data) {
                const existing = await prisma.blobStore.findUnique({ where: { key } });
                if (existing) {
                    await prisma.blobStore.update({
                        where: { key },
                        data: { data }
                    });
                } else {
                    await prisma.blobStore.create({
                        data: { key, data }
                    });
                }
                console.log(`Successfully migrated ${key} to Supabase BlobStore.`);
            } else {
                console.log(`Skipped ${key} - No data found in Azure.`);
            }
        } catch (error) {
            console.error(`Error migrating ${key}:`, error);
        }
    }
    console.log('Migration complete!');
    await prisma.$disconnect();
}

const keysToMigrate = [
    'medicines',
    'registered-products',
    'suppliers',
    'purchases',
    'equipment',
    'resources',
    'category-images',
    'inventory-batches',
    'clinics',
    'category-order'
];

migrateKeys(keysToMigrate).catch(console.error);

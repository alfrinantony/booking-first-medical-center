const { Client } = require('pg');
const { BlobServiceClient } = require('@azure/storage-blob');

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
    const dbClient = new Client({
        connectionString: "postgresql://postgres.fqphlhchebygaevttmzd:vIa3LbgQItyl8efo@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
    });
    
    await dbClient.connect();
    console.log('Connected to Supabase via pg!');

    for (const key of keys) {
        console.log(`Migrating ${key}...`);
        try {
            const data = await fetchFromAzure(key);
            if (data) {
                const jsonStr = JSON.stringify(data);
                // Use $$ for safe quoting in PostgreSQL, bypassing prepared statements
                const query = `
                    INSERT INTO "BlobStore" (key, data)
                    VALUES ('${key}', $$${jsonStr}$$::jsonb)
                    ON CONFLICT (key) DO UPDATE
                    SET data = EXCLUDED.data;
                `;
                await dbClient.query(query);
                console.log(`Successfully migrated ${key} to Supabase BlobStore.`);
            } else {
                console.log(`Skipped ${key} - No data found in Azure.`);
            }
        } catch (error) {
            console.error(`Error migrating ${key}:`, error);
        }
    }
    console.log('Migration complete!');
    await dbClient.end();
}

const keysToMigrate = [
    'medicines',
    'registered-products',
    'suppliers',
    'purchases',
    'equipment',
    'resources'
];

migrateKeys(keysToMigrate).catch(console.error);

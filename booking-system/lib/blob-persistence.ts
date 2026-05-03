// ─────────────────────────────────────────────────────────────
// Azure Blob Persistence
// ─────────────────────────────────────────────────────────────
// Reverted to Azure to bypass Supabase PgBouncer payload limits
// and to instantly restore access to all historical data.
// ─────────────────────────────────────────────────────────────

import { BlobServiceClient } from '@azure/storage-blob';

const connectionString = 'DefaultEndpointsProtocol=https;EndpointSuffix=core.windows.net;AccountName=stfmcbooking;AccountKey=iPSH3giG76MQjVIsbqbZAt2VuKeyRgFolm1hZz+yYTTfT9NGbP6xN7WhGQ5iyO8esH/9w0uwo6w9+AStxc+QPA==;BlobEndpoint=https://stfmcbooking.blob.core.windows.net/;FileEndpoint=https://stfmcbooking.file.core.windows.net/;QueueEndpoint=https://stfmcbooking.queue.core.windows.net/;TableEndpoint=https://stfmcbooking.table.core.windows.net/';
const containerName = 'fmc-data';

const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
const containerClient = blobServiceClient.getContainerClient(containerName);

export async function loadFromBlob<T>(key: string, fallback: T): Promise<T> {
    try {
        const blobName = key.endsWith('.json') ? key : `${key}.json`;
        const blobClient = containerClient.getBlobClient(blobName);
        const buffer = await blobClient.downloadToBuffer();
        const data = JSON.parse(buffer.toString('utf-8'));
        console.log(`[BlobPersist] Loaded "${key}" from Azure Blob`);
        return data as T;
    } catch (err: any) {
        if (err.statusCode === 404) {
            console.log(`[BlobPersist] Blob "${key}" not found in Azure — using fallback`);
            return fallback;
        }
        console.error(`[BlobPersist] Failed to load "${key}":`, err.message);
        return fallback;
    }
}

export async function saveToBlob<T>(key: string, data: T): Promise<void> {
    try {
        const blobName = key.endsWith('.json') ? key : `${key}.json`;
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        const jsonStr = JSON.stringify(data);
        await blockBlobClient.upload(jsonStr, Buffer.byteLength(jsonStr));
        console.log(`[BlobPersist] Saved "${key}" to Azure Blob`);
    } catch (err: any) {
        console.error(`[BlobPersist] Failed to save "${key}":`, err.message);
    }
}

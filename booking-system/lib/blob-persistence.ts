// ─────────────────────────────────────────────────────────────
// Azure Blob Persistence
// ─────────────────────────────────────────────────────────────
// Reverted to Azure to bypass Supabase PgBouncer payload limits
// and to instantly restore access to all historical data.
// ─────────────────────────────────────────────────────────────

import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';

const connectionString = 'DefaultEndpointsProtocol=https;EndpointSuffix=core.windows.net;AccountName=stfmcbooking;AccountKey=iPSH3giG76MQjVIsbqbZAt2VuKeyRgFolm1hZz+yYTTfT9NGbP6xN7WhGQ5iyO8esH/9w0uwo6w9+AStxc+QPA==;BlobEndpoint=https://stfmcbooking.blob.core.windows.net/;FileEndpoint=https://stfmcbooking.file.core.windows.net/;QueueEndpoint=https://stfmcbooking.queue.core.windows.net/;TableEndpoint=https://stfmcbooking.table.core.windows.net/';
const containerName = 'fmc-data';

let _containerClient: ContainerClient | null = null;

function getContainerClient(): ContainerClient {
    if (typeof window !== 'undefined') {
        throw new Error('Azure Blob Storage cannot be used in the browser');
    }
    if (!_containerClient) {
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        _containerClient = blobServiceClient.getContainerClient(containerName);
    }
    return _containerClient;
}

export async function loadFromBlob<T>(key: string, fallback: T): Promise<T> {
    try {
        const blobName = key.endsWith('.json') ? key : `${key}.json`;
        const blobClient = getContainerClient().getBlobClient(blobName);
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
        const blobClient = getContainerClient().getBlockBlobClient(blobName);
        const content = JSON.stringify(data, null, 2);
        await blobClient.upload(content, content.length);
        console.log(`[BlobPersist] Saved "${key}" to Azure Blob`);
    } catch (err: any) {
        console.error(`[BlobPersist] Failed to save "${key}":`, err.message);
    }
}

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

const memoryCache = new Map<string, { data: unknown; timestamp: number }>();
const pendingPromises = new Map<string, Promise<any>>();
const CACHE_TTL = 30000; // 30 seconds

function getErrorStatusCode(err: unknown): number | undefined {
    if (!err || typeof err !== 'object' || !('statusCode' in err)) return undefined;
    const statusCode = (err as { statusCode?: unknown }).statusCode;
    return typeof statusCode === 'number' ? statusCode : undefined;
}

function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
}

export async function loadFromBlob<T>(
    key: string,
    fallback: T,
    options: { bypassCache?: boolean } = {}
): Promise<T> {
    try {
        const now = Date.now();
        const cached = memoryCache.get(key);
        if (!options.bypassCache && cached && (now - cached.timestamp < CACHE_TTL)) {
            return cached.data as T;
        }

        // Return the existing pending promise if one is already downloading this key
        if (!options.bypassCache && pendingPromises.has(key)) {
            console.log(`[BlobPersist] Joining existing download for "${key}"`);
            return pendingPromises.get(key) as Promise<T>;
        }

        const downloadPromise = (async () => {
            const blobName = key.endsWith('.json') ? key : `${key}.json`;
            const blobClient = getContainerClient().getBlobClient(blobName);
            const buffer = await blobClient.downloadToBuffer();
            const data = JSON.parse(buffer.toString('utf-8'));
            console.log(`[BlobPersist] Loaded "${key}" from Azure Blob`);
            
            memoryCache.set(key, { data, timestamp: Date.now() });
            return data as T;
        })();

        pendingPromises.set(key, downloadPromise);
        
        try {
            return await downloadPromise;
        } finally {
            pendingPromises.delete(key);
        }
    } catch (err: unknown) {
        if (getErrorStatusCode(err) === 404) {
            console.log(`[BlobPersist] Blob "${key}" not found in Azure — using fallback`);
            return fallback;
        }
        console.error(`[BlobPersist] Failed to load "${key}":`, getErrorMessage(err));
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
        memoryCache.set(key, { data, timestamp: Date.now() });
    } catch (err: unknown) {
        console.error(`[BlobPersist] Failed to save "${key}":`, getErrorMessage(err));
    }
}

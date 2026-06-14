"use strict";
// ─────────────────────────────────────────────────────────────
// Azure Blob Persistence
// ─────────────────────────────────────────────────────────────
// Reverted to Azure to bypass Supabase PgBouncer payload limits
// and to instantly restore access to all historical data.
// ─────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadFromBlob = loadFromBlob;
exports.saveToBlob = saveToBlob;
const storage_blob_1 = require("@azure/storage-blob");
const connectionString = 'DefaultEndpointsProtocol=https;EndpointSuffix=core.windows.net;AccountName=stfmcbooking;AccountKey=iPSH3giG76MQjVIsbqbZAt2VuKeyRgFolm1hZz+yYTTfT9NGbP6xN7WhGQ5iyO8esH/9w0uwo6w9+AStxc+QPA==;BlobEndpoint=https://stfmcbooking.blob.core.windows.net/;FileEndpoint=https://stfmcbooking.file.core.windows.net/;QueueEndpoint=https://stfmcbooking.queue.core.windows.net/;TableEndpoint=https://stfmcbooking.table.core.windows.net/';
const containerName = 'fmc-data';
let _containerClient = null;
function getContainerClient() {
    if (typeof window !== 'undefined') {
        throw new Error('Azure Blob Storage cannot be used in the browser');
    }
    if (!_containerClient) {
        const blobServiceClient = storage_blob_1.BlobServiceClient.fromConnectionString(connectionString);
        _containerClient = blobServiceClient.getContainerClient(containerName);
    }
    return _containerClient;
}
async function loadFromBlob(key, fallback) {
    try {
        const blobName = key.endsWith('.json') ? key : `${key}.json`;
        const blobClient = getContainerClient().getBlobClient(blobName);
        const buffer = await blobClient.downloadToBuffer();
        const data = JSON.parse(buffer.toString('utf-8'));
        console.log(`[BlobPersist] Loaded "${key}" from Azure Blob`);
        return data;
    }
    catch (err) {
        if (err.statusCode === 404) {
            console.log(`[BlobPersist] Blob "${key}" not found in Azure — using fallback`);
            return fallback;
        }
        console.error(`[BlobPersist] Failed to load "${key}":`, err.message);
        return fallback;
    }
}
async function saveToBlob(key, data) {
    try {
        const blobName = key.endsWith('.json') ? key : `${key}.json`;
        const blobClient = getContainerClient().getBlockBlobClient(blobName);
        const content = JSON.stringify(data, null, 2);
        await blobClient.upload(content, content.length);
        console.log(`[BlobPersist] Saved "${key}" to Azure Blob`);
    }
    catch (err) {
        console.error(`[BlobPersist] Failed to save "${key}":`, err.message);
    }
}

// ─────────────────────────────────────────────────────────────
// Azure Blob JSON Persistence — Load / Save data stores
// ─────────────────────────────────────────────────────────────
// Uses the existing Azure Storage Account (stfmcbooking) with a
// dedicated container `fmc-data`.  Each store saves its state as
// a single JSON file (e.g. bookings.json, clinics.json).
// Falls back to default seed data when blob doesn't exist yet.
// ─────────────────────────────────────────────────────────────

const DATA_CONTAINER = 'fmc-data';

function getConnectionString(): string {
    return process.env.AZURE_STORAGE_CONNECTION_STRING || '';
}

/**
 * Load a JSON blob from Azure Storage.
 * Returns `fallback` when:
 *  - No connection string (local dev)
 *  - Blob doesn't exist yet
 *  - Any error occurs
 */
export async function loadFromBlob<T>(key: string, fallback: T): Promise<T> {
    const connStr = getConnectionString();
    if (!connStr) {
        console.log(`[BlobPersist] No connection string — using fallback for "${key}"`);
        return fallback;
    }

    try {
        const { BlobServiceClient } = await import('@azure/storage-blob');
        const blobServiceClient = BlobServiceClient.fromConnectionString(connStr);
        const containerClient = blobServiceClient.getContainerClient(DATA_CONTAINER);

        // Container may not exist yet on first run
        await containerClient.createIfNotExists();

        const blobClient = containerClient.getBlockBlobClient(`${key}.json`);
        const exists = await blobClient.exists();
        if (!exists) {
            console.log(`[BlobPersist] Blob "${key}.json" not found — using fallback`);
            return fallback;
        }

        const downloadResponse = await blobClient.download(0);
        const body = await streamToString(downloadResponse.readableStreamBody!);
        const data = JSON.parse(body) as T;
        console.log(`[BlobPersist] Loaded "${key}.json" (${body.length} bytes)`);
        return data;
    } catch (err) {
        console.error(`[BlobPersist] Failed to load "${key}":`, err);
        return fallback;
    }
}

/**
 * Save data as a JSON blob in Azure Storage.
 * Silently logs errors but never throws — writes are best-effort
 * so the API response is never blocked by persistence failures.
 */
export async function saveToBlob<T>(key: string, data: T): Promise<void> {
    const connStr = getConnectionString();
    if (!connStr) {
        // Local dev — skip writes
        return;
    }

    try {
        const { BlobServiceClient } = await import('@azure/storage-blob');
        const blobServiceClient = BlobServiceClient.fromConnectionString(connStr);
        const containerClient = blobServiceClient.getContainerClient(DATA_CONTAINER);
        await containerClient.createIfNotExists();

        const blobClient = containerClient.getBlockBlobClient(`${key}.json`);
        const content = JSON.stringify(data, null, 2);
        const buffer = Buffer.from(content, 'utf-8');
        // Delete existing blob before upload to ensure overwrite
        try { await blobClient.deleteIfExists(); } catch { /* ignore */ }
        await blobClient.uploadData(buffer, {
            blobHTTPHeaders: { blobContentType: 'application/json' },
        });
        console.log(`[BlobPersist] Saved "${key}.json" (${content.length} bytes)`);
    } catch (err) {
        console.error(`[BlobPersist] Failed to save "${key}":`, err);
    }
}

// ── Helper: convert Node readable stream to string ──
async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf-8');
}

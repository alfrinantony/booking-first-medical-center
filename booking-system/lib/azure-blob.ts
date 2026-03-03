// ─────────────────────────────────────────────────────────────
// Azure Blob Storage — Central helper for upload / delete / URL
// ─────────────────────────────────────────────────────────────

const getConfig = () => ({
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || '',
    container: process.env.AZURE_STORAGE_CONTAINER || 'fmc-documents',
});

/**
 * Upload a file to Azure Blob Storage at the given path.
 * Returns the public blob URL, or a local fallback URL when no connection string is configured.
 */
export async function uploadToBlob(
    blobPath: string,
    data: Buffer,
    contentType: string
): Promise<string> {
    const { connectionString, container } = getConfig();

    if (!connectionString) {
        // Local development fallback
        console.warn('[AzureBlob] No connection string — using mock URL');
        return `/mock-blob/${container}/${blobPath}`;
    }

    try {
        const { BlobServiceClient } = await import('@azure/storage-blob');
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient(container);

        // Ensure container exists (no-op if already present)
        await containerClient.createIfNotExists({ access: 'blob' });

        const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
        await blockBlobClient.uploadData(data, {
            blobHTTPHeaders: { blobContentType: contentType },
        });

        return blockBlobClient.url;
    } catch (err) {
        console.error('[AzureBlob] Upload failed:', err);
        return `/mock-blob/${container}/${blobPath}`;
    }
}

/**
 * Delete a blob from Azure Blob Storage by its full URL.
 * Silently skips if the URL is a local fallback.
 */
export async function deleteFromBlob(blobUrl: string): Promise<boolean> {
    const { connectionString, container } = getConfig();

    if (!connectionString || !blobUrl.includes('blob.core.windows.net')) {
        return false;
    }

    try {
        const { BlobServiceClient } = await import('@azure/storage-blob');
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient(container);

        // Extract blob name from the URL
        const url = new URL(blobUrl);
        const blobName = url.pathname.split(`/${container}/`)[1];

        if (blobName) {
            await containerClient.getBlockBlobClient(blobName).delete();
            return true;
        }
    } catch (err) {
        console.error('[AzureBlob] Delete failed:', err);
    }
    return false;
}

// ── Path helpers for organized blob storage ──

/**
 * HR Employee document path:
 * hr/employees/{employeeId}/{category}/{timestamp}-{filename}
 */
export function hrDocumentPath(employeeId: string, category: string, fileName: string): string {
    const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `hr/employees/${employeeId}/${category.toLowerCase()}/${Date.now()}-${safe}`;
}

/**
 * HR Recruitment candidate path:
 * hr/recruitment/candidates/{candidateId}/{type}/{timestamp}-{filename}
 */
export function recruitmentDocPath(candidateId: string, type: string, fileName: string): string {
    const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `hr/recruitment/candidates/${candidateId}/${type.toLowerCase()}/${Date.now()}-${safe}`;
}

/**
 * Accounting transaction receipt path:
 * accounting/transactions/{txnId}-{timestamp}-{filename}
 */
export function accountingDocPath(txnId: string, fileName: string): string {
    const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `accounting/transactions/${txnId}-${Date.now()}-${safe}`;
}

/**
 * Product registration document path:
 * products/registrations/{timestamp}-{filename}
 */
export function productRegistrationPath(fileName: string): string {
    const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `products/registrations/${Date.now()}-${safe}`;
}

/**
 * Letters / certificates path:
 * letters/{letterId}-{timestamp}-{filename}
 */
export function letterDocPath(letterId: string, fileName: string): string {
    const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `letters/${letterId}-${Date.now()}-${safe}`;
}

/**
 * Catalog image path (departments, services, doctors):
 * images/{type}/{id}/{timestamp}-{filename}
 */
export function catalogImagePath(type: string, id: string, fileName: string): string {
    const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `images/${type}/${id}/${Date.now()}-${safe}`;
}

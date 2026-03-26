import { NextResponse } from 'next/server';
import { BlobServiceClient } from '@azure/storage-blob';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    // Security verification for CRON (Vercel standard headers or a custom secret)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized CRON execution' }, { status: 401 });
    }

    try {
        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        if (!connectionString) {
            console.warn('[Checklist Cron] Azure connection string missing.');
            return NextResponse.json({ success: true, message: 'Skipped - No Azure connection defined.' });
        }

        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'fmc-documents';
        const containerClient = blobServiceClient.getContainerClient(containerName);

        const ageThresholdDays = 100;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - ageThresholdDays);

        let deletedCount = 0;

        // Iterate through all blobs with the checklist/ prefix
        for await (const blob of containerClient.listBlobsFlat({ prefix: 'checklists/' })) {
            const lastModified = blob.properties.lastModified;
            if (lastModified && lastModified < cutoffDate) {
                const blockBlobClient = containerClient.getBlockBlobClient(blob.name);
                await blockBlobClient.delete();
                deletedCount++;
                console.log(`[Checklist Cron] Auto-deleted expired checklist photo: ${blob.name}`);
            }
        }

        return NextResponse.json({
            success: true,
            deletedCount,
            cutoffDate: cutoffDate.toISOString(),
            message: `Successfully pruned ${deletedCount} photos older than 100 days.`
        });

    } catch (error) {
        console.error('[Checklist Cron] Auto-delete process failed:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

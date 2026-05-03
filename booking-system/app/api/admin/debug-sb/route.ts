export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { BlobServiceClient } from '@azure/storage-blob';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const connectionString = 'DefaultEndpointsProtocol=https;EndpointSuffix=core.windows.net;AccountName=stfmcbooking;AccountKey=iPSH3giG76MQjVIsbqbZAt2VuKeyRgFolm1hZz+yYTTfT9NGbP6xN7WhGQ5iyO8esH/9w0uwo6w9+AStxc+QPA==;BlobEndpoint=https://stfmcbooking.blob.core.windows.net/;FileEndpoint=https://stfmcbooking.file.core.windows.net/;QueueEndpoint=https://stfmcbooking.queue.core.windows.net/;TableEndpoint=https://stfmcbooking.table.core.windows.net/';
const containerName = 'fmc-data';

const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
const containerClient = blobServiceClient.getContainerClient(containerName);

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const keyParam = searchParams.get('key');

    const keys = [
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

    if (!keyParam) {
        return NextResponse.json({ 
            message: "Pass ?key=KEY_NAME to migrate a specific key to avoid 30s timeout.", 
            availableKeys: keys 
        });
    }

    if (!keys.includes(keyParam)) {
        return NextResponse.json({ error: "Invalid key." }, { status: 400 });
    }

    const results: Record<string, string> = {};
    try {
        const blobName = keyParam.endsWith('.json') ? keyParam : `${keyParam}.json`;
        const blobClient = containerClient.getBlobClient(blobName);
        const buffer = await blobClient.downloadToBuffer();
        const data = JSON.parse(buffer.toString('utf-8'));
        if (data) {
            await prisma.blobStore.upsert({
                where: { key: keyParam },
                update: { data },
                create: { key: keyParam, data }
            });
            results[keyParam] = 'Success';
        } else {
            results[keyParam] = 'No data found in Azure';
        }
    } catch (e: any) {
        results[keyParam] = `Error: ${e.message}`;
    }

    return NextResponse.json({ results });
}

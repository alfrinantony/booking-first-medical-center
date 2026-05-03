export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { BlobServiceClient } from '@azure/storage-blob';
import { Client } from 'pg';

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
        'category-order',
        'room-checklists',
        'hr-employees',
        'hr-shifts',
        'hr-recruitment',
        'hr-payslips',
        'hr-payslip',
        'hr-letters',
        'hr-leave',
        'hr-eos',
        'hr-documents',
        'hr-calendar',
        'hr-attendance',
        'users',
        'adminUsers',
        'clinician-schedules',
        'stock-transfers',
        'expired-stock',
        'stock-adjustments',
        'distributions'
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
    const dbClient = new Client({
        connectionString: "postgresql://postgres:vIa3LbgQItyl8efo@db.fqphlhchebygaevttmzd.supabase.co:5432/postgres"
    });

    try {
        await dbClient.connect();
        const blobName = keyParam.endsWith('.json') ? keyParam : `${keyParam}.json`;
        const blobClient = containerClient.getBlobClient(blobName);
        const buffer = await blobClient.downloadToBuffer();
        const data = JSON.parse(buffer.toString('utf-8'));
        
        if (data) {
            const query = `
                INSERT INTO "BlobStore" (key, data)
                VALUES ($1, $2::jsonb)
                ON CONFLICT (key) DO UPDATE
                SET data = EXCLUDED.data;
            `;
            // Strip null bytes
            const jsonStr = JSON.stringify(data).replace(/\u0000/g, '');
            await dbClient.query(query, [keyParam, jsonStr]);
            results[keyParam] = 'Success';
        } else {
            results[keyParam] = 'No data found in Azure';
        }
    } catch (e: any) {
        results[keyParam] = `Error: ${e.message}`;
    } finally {
        await dbClient.end().catch(() => {});
    }

    return NextResponse.json({ results });
}

// ─────────────────────────────────────────────────────────────
// Supabase PostgreSQL Blob Persistence
// ─────────────────────────────────────────────────────────────
// Replaces Azure Blob Storage with Supabase PostgreSQL BlobStore table.
// ─────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function loadFromBlob<T>(key: string, fallback: T): Promise<T> {
    try {
        const record = await prisma.blobStore.findUnique({
            where: { key }
        });
        
        if (!record || !record.data) {
            console.log(`[BlobPersist] Blob "${key}" not found — using fallback`);
            return fallback;
        }

        console.log(`[BlobPersist] Loaded "${key}" from Supabase BlobStore`);
        return record.data as unknown as T;
    } catch (err) {
        console.error(`[BlobPersist] Failed to load "${key}":`, err);
        return fallback;
    }
}

export async function saveToBlob<T>(key: string, data: T): Promise<void> {
    try {
        await prisma.blobStore.upsert({
            where: { key },
            update: { data: data as any },
            create: { key, data: data as any }
        });
        console.log(`[BlobPersist] Saved "${key}" to Supabase BlobStore`);
    } catch (err) {
        console.error(`[BlobPersist] Failed to save "${key}":`, err);
    }
}

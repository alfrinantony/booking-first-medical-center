import { NextResponse } from 'next/server';
import { uploadToBlob } from '@/lib/azure-blob';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow more time for large image uploads

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        
        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
            return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
        }

        // Limit size to ~5MB
        if (file.size > 5 * 1024 * 1024) {
             return NextResponse.json({ error: 'Image exceeds 5MB size limit' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        
        // Generate a clean filename for Azure Storage
        const ext = file.name.split('.').pop() || 'jpg';
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 30);
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${sanitizedName}`;
        
        const blobPath = `checklists/${fileName}`;

        console.log(`[Checklists Upload] Uploading ${file.type} (${file.size} bytes) to ${blobPath}`);
        
        const blobUrl = await uploadToBlob(blobPath, buffer, file.type);

        if (!blobUrl || blobUrl.startsWith('/mock-blob/')) {
            // Keep going if mock is used (for local dev), but log warning
            console.warn('[Checklists Upload] Azure URL not returned, using fallback path');
        }

        return NextResponse.json({ 
            success: true, 
            url: blobUrl,
            fileName: file.name
        });

    } catch (error) {
        console.error('[Checklists Upload] Upload error:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { uploadToBlob, catalogImagePath } from '@/lib/azure-blob';

/**
 * POST /api/admin/images/upload
 * Accepts multipart form data: file, type (department|service|doctor|category), id
 * Returns { url: string }
 */
export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const type = formData.get('type') as string | null;
        const id = formData.get('id') as string | null;

        if (!file || !type || !id) {
            return NextResponse.json(
                { error: 'Missing required fields: file, type, id' },
                { status: 400 }
            );
        }

        // Validate type
        const allowedTypes = ['department', 'service', 'doctor', 'category'];
        if (!allowedTypes.includes(type)) {
            return NextResponse.json(
                { error: `Invalid type. Must be one of: ${allowedTypes.join(', ')}` },
                { status: 400 }
            );
        }

        // Validate file type
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
        if (!allowedMimeTypes.includes(file.type)) {
            return NextResponse.json(
                { error: 'Invalid file type. Must be JPEG, PNG, WebP, GIF, or SVG' },
                { status: 400 }
            );
        }

        // Max 5MB
        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json(
                { error: 'File too large. Maximum size is 5MB' },
                { status: 400 }
            );
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const blobPath = catalogImagePath(type, id, file.name);
        const url = await uploadToBlob(blobPath, buffer, file.type);

        return NextResponse.json({ url });
    } catch (error) {
        console.error('[ImageUpload] Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}

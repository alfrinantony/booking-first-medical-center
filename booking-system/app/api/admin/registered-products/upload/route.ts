export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { uploadToBlob, productRegistrationPath } from '@/lib/azure-blob';

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: 'File must be less than 5MB' }, { status: 400 });
        }

        if (file.type !== 'application/pdf') {
            return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
        }

        // Upload to Azure Blob with organized path
        const blobPath = productRegistrationPath(file.name);
        const buffer = Buffer.from(await file.arrayBuffer());
        const blobUrl = await uploadToBlob(blobPath, buffer, file.type);

        return NextResponse.json({ fileName: file.name, blobUrl });
    } catch {
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}

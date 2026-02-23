import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const MAX_SIZE = 1 * 1024 * 1024; // 1MB

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: 'File must be less than 1MB' }, { status: 400 });
        }

        if (file.type !== 'application/pdf') {
            return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
        }

        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'registrations');
        await mkdir(uploadDir, { recursive: true });

        const uniqueName = `reg-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filePath = path.join(uploadDir, uniqueName);

        const bytes = await file.arrayBuffer();
        await writeFile(filePath, Buffer.from(bytes));

        return NextResponse.json({ fileName: uniqueName });
    } catch {
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}

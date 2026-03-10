import { NextResponse } from 'next/server';
import { HRDocumentsStore, getCategoryForDocType } from '@/lib/hr-documents-store';
import type { DocumentCategory } from '@/lib/hr-documents-store';
import { uploadToBlob, hrDocumentPath } from '@/lib/azure-blob';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');

    if (!employeeId) {
        return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
    }

    const docs = await HRDocumentsStore.getByEmployee(employeeId);
    return NextResponse.json(docs);
}

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const employeeId = formData.get('employeeId') as string;
        const documentType = formData.get('documentType') as string;
        const category = formData.get('category') as DocumentCategory | null;
        const expiryDate = formData.get('expiryDate') as string | null;
        const issueDate = formData.get('issueDate') as string | null;
        const notes = formData.get('notes') as string | null;

        if (!file || !employeeId || !documentType) {
            return NextResponse.json(
                { error: 'file, employeeId, and documentType are required' },
                { status: 400 }
            );
        }

        // Resolve category from doc type if not sent explicitly
        const resolvedCategory = category || getCategoryForDocType(documentType)?.key || 'RECRUITMENT';

        // ── Azure Blob Upload (organized path) ──
        const blobPath = hrDocumentPath(employeeId, resolvedCategory, file.name);
        const buffer = Buffer.from(await file.arrayBuffer());
        const blobUrl = await uploadToBlob(blobPath, buffer, file.type);

        const doc = await HRDocumentsStore.add({
            employeeId,
            category: resolvedCategory,
            documentType,
            fileName: file.name,
            blobUrl,
            fileSize: file.size,
            mimeType: file.type,
            uploadedAt: new Date().toISOString(),
            expiryDate: expiryDate || undefined,
            issueDate: issueDate || undefined,
            notes: notes || undefined,
        });

        return NextResponse.json(doc, { status: 201 });
    } catch (err) {
        console.error('[HR Documents] Upload error:', err);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}


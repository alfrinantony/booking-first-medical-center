export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { HRDocumentsStore } from '@/lib/hr-documents-store';
import { deleteFromBlob } from '@/lib/azure-blob';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const doc = await HRDocumentsStore.getById(id);
    if (!doc) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    return NextResponse.json(doc);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const doc = await HRDocumentsStore.getById(id);
    if (!doc) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Delete from Azure Blob if stored there
    await deleteFromBlob(doc.blobUrl);

    await HRDocumentsStore.delete(id);
    return NextResponse.json({ success: true });
}


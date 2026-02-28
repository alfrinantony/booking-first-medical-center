import { NextResponse } from 'next/server';
import { HRLettersStore } from '@/lib/hr-letters-store';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { action, approvedBy, rejectedReason } = body;

        if (action === 'approve') {
            const letter = HRLettersStore.approve(id, approvedBy || 'CEO');
            if (!letter) return NextResponse.json({ error: 'Letter not found or already approved' }, { status: 404 });
            return NextResponse.json(letter);
        }

        if (action === 'reject') {
            const letter = HRLettersStore.reject(id, rejectedReason || '');
            if (!letter) return NextResponse.json({ error: 'Letter not found' }, { status: 404 });
            return NextResponse.json(letter);
        }

        return NextResponse.json({ error: 'Invalid action. Use "approve" or "reject"' }, { status: 400 });
    } catch (err) {
        console.error('[HR Letters] Patch error:', err);
        return NextResponse.json({ error: 'Failed to update letter' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const deleted = HRLettersStore.delete(id);
    if (!deleted) return NextResponse.json({ error: 'Letter not found' }, { status: 404 });
    return NextResponse.json({ success: true });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const letter = HRLettersStore.getById(id);
    if (!letter) return NextResponse.json({ error: 'Letter not found' }, { status: 404 });
    return NextResponse.json(letter);
}

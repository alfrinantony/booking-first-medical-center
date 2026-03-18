import { NextResponse } from 'next/server';
import { DraftsStore } from '@/lib/drafts-store';

// We extract userId from search parameters, but in a real app this could also read from headers/auth.
// For now, tracking based on the userId passed by the hook.
function getUserId(request: Request): string | null {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    return userId || 'anonymous';
}

export async function GET(request: Request) {
    try {
        const userId = getUserId(request);
        const { searchParams } = new URL(request.url);
        const formId = searchParams.get('formId');

        if (!userId || !formId) {
            return NextResponse.json({ error: 'Missing userId or formId' }, { status: 400 });
        }

        const draft = await DraftsStore.getDraft(userId, formId);
        return NextResponse.json({ draft });
    } catch (error) {
        console.error('Failed to get draft:', error);
        return NextResponse.json({ error: 'Failed to fetch draft' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const userId = getUserId(request);
        const { searchParams } = new URL(request.url);
        const formId = searchParams.get('formId');
        const action = searchParams.get('action'); // 'save' | 'clear'

        if (!userId || !formId) {
            return NextResponse.json({ error: 'Missing userId or formId' }, { status: 400 });
        }

        if (action === 'clear') {
            await DraftsStore.clearDraft(userId, formId);
            return NextResponse.json({ success: true, message: 'Draft cleared' });
        }

        const data = await request.json();
        await DraftsStore.saveDraft(userId, formId, data);
        
        return NextResponse.json({ success: true, message: 'Draft saved' });
    } catch (error) {
        console.error('Failed to process draft POST:', error);
        return NextResponse.json({ error: 'Failed to save or clear draft' }, { status: 500 });
    }
}

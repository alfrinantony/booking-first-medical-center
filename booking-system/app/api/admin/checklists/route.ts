import { NextResponse } from 'next/server';
import { ChecklistStore } from '@/lib/checklist-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const branchId = searchParams.get('branchId');

    try {
        let checklists = await ChecklistStore.getAll();

        if (date) {
            checklists = checklists.filter(c => c.date === date);
        }
        if (branchId) {
            checklists = checklists.filter(c => c.branchId === branchId);
        }

        return NextResponse.json(checklists);
    } catch (error) {
        console.error('[Checklists] GET Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        if (!body.date || !body.branchId || !body.branchName || !body.supervisorName || !body.items) {
            return NextResponse.json({ error: 'Missing required checklist fields' }, { status: 400 });
        }

        const newChecklist = await ChecklistStore.add({
            date: body.date,
            branchId: body.branchId,
            branchName: body.branchName,
            supervisorName: body.supervisorName,
            items: body.items
        });

        return NextResponse.json({ success: true, checklist: newChecklist });
    } catch (error) {
        console.error('[Checklists] POST Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Missing checklist ID' }, { status: 400 });
        }

        const updated = await ChecklistStore.update(id, updates);
        
        if (updated) {
            return NextResponse.json({ success: true, checklist: updated });
        } else {
            return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
        }
    } catch (error) {
        console.error('[Checklists] PUT Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing checklist ID' }, { status: 400 });
        }

        const success = await ChecklistStore.remove(id);
        
        if (success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
        }
    } catch (error) {
        console.error('[Checklists] DELETE Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

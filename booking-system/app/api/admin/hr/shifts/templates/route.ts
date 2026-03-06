import { NextResponse } from 'next/server';
import { HRShiftStore } from '@/lib/hr-shift-store';

// GET /api/admin/hr/shifts/templates — List shift templates
export async function GET() {
    return NextResponse.json(HRShiftStore.getTemplates());
}

// POST /api/admin/hr/shifts/templates — Create, update, or delete a template
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, id, ...data } = body;

        if (action === 'delete' && id) {
            const deleted = HRShiftStore.deleteTemplate(id);
            if (!deleted) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
            return NextResponse.json({ success: true });
        }

        if (action === 'update' && id) {
            const updated = HRShiftStore.updateTemplate(id, data);
            if (!updated) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
            return NextResponse.json(updated);
        }

        // Create
        if (!data.name || !data.startTime || !data.endTime) {
            return NextResponse.json({ error: 'name, startTime, endTime are required' }, { status: 400 });
        }

        const template = HRShiftStore.addTemplate(data);
        return NextResponse.json(template, { status: 201 });
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}

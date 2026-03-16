import { NextRequest, NextResponse } from 'next/server';
import { NotificationStore } from '@/lib/notification-store';

/**
 * GET /api/admin/notifications — returns all notification configs
 * POST /api/admin/notifications — action: add | update | delete
 */

export async function GET() {
    const configs = await NotificationStore.getAll();
    return NextResponse.json(configs);
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action } = body;

        if (action === 'add') {
            const newConfig = await NotificationStore.add({
                type: body.type || 'email',
                timing: body.timing || 24,
                enabled: body.enabled ?? true,
                template: body.template || 'New reminder...',
            });
            return NextResponse.json(newConfig);
        }

        if (action === 'update') {
            const { id, ...updates } = body;
            delete updates.action;
            const updated = await NotificationStore.update(id, updates);
            if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
            return NextResponse.json(updated);
        }

        if (action === 'delete') {
            await NotificationStore.delete(body.id);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (error) {
        console.error('Notifications API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { CustomerAuthServerStore } from '@/lib/customer-auth-server-store';

// GET /api/admin/registered-users
export async function GET() {
    try {
        const users = await CustomerAuthServerStore.getAll();
        return NextResponse.json(users);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST /api/admin/registered-users
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, id } = body;

        switch (action) {
            case 'block': {
                const success = await CustomerAuthServerStore.blockUser(id);
                return NextResponse.json({ success });
            }
            case 'unblock': {
                const success = await CustomerAuthServerStore.unblockUser(id);
                return NextResponse.json({ success });
            }
            case 'remove': {
                const success = await CustomerAuthServerStore.removeUser(id);
                return NextResponse.json({ success });
            }
            case 'update': {
                const { updates } = body;
                const updated = await CustomerAuthServerStore.updateUser(id, updates);
                return NextResponse.json({ success: !!updated, user: updated });
            }
            case 'resetPassword': {
                const { newPassword } = body;
                const success = await CustomerAuthServerStore.adminResetPassword(id, newPassword);
                return NextResponse.json({ success });
            }
            case 'merge': {
                const { sourceId } = body;
                const success = await CustomerAuthServerStore.mergeUsers(id, sourceId);
                return NextResponse.json({ success });
            }
            default:
                return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
        }
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

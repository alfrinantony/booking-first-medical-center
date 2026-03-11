import { NextResponse } from 'next/server';
import { UsersStore } from '@/lib/users-store';

// GET /api/admin/users — List all users
export async function GET() {
    const users = await UsersStore.getUsers();
    return NextResponse.json(users);
}

// POST /api/admin/users — Add / Update / Delete / Permissions
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action } = body;

        if (action === 'add') {
            const user = await UsersStore.addUser(body.data);
            return NextResponse.json(user);
        }

        if (action === 'update') {
            const updated = await UsersStore.updateUser(body.id, body.data);
            if (!updated) return NextResponse.json({ error: 'User not found' }, { status: 404 });
            return NextResponse.json(updated);
        }

        if (action === 'delete') {
            const deleted = await UsersStore.deleteUser(body.id);
            return NextResponse.json({ success: deleted });
        }

        if (action === 'updatePermissions') {
            const updated = await UsersStore.updatePermissions(body.id, body.permissions);
            if (!updated) return NextResponse.json({ error: 'User not found' }, { status: 404 });
            return NextResponse.json(updated);
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
}

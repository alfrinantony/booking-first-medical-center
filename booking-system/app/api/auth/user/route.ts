export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { CustomerAuthServerStore } from '@/lib/customer-auth-server-store';

/**
 * GET /api/auth/user?email=...  or  ?phone=...
 * Looks up a single user by email or phone.
 */
export async function GET(request: NextRequest) {
    try {
        const email = request.nextUrl.searchParams.get('email');
        const phone = request.nextUrl.searchParams.get('phone');

        if (!email && !phone) {
            return NextResponse.json({ error: 'email or phone query param required.' }, { status: 400 });
        }

        const user = email
            ? await CustomerAuthServerStore.getByEmail(email)
            : await CustomerAuthServerStore.getByPhone(phone!);

        if (!user) {
            return NextResponse.json({ found: false }, { status: 404 });
        }

        const { passwordHash: _, ...safeUser } = user;
        return NextResponse.json({ found: true, user: safeUser });
    } catch (error) {
        console.error('[Auth/User GET] Error:', error);
        return NextResponse.json({ error: 'Failed to look up user.' }, { status: 500 });
    }
}

/**
 * PUT /api/auth/user
 * Body: { id, ...updates }
 * Supports: profile updates, block/unblock, verify email, admin password reset.
 */
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, action, ...updates } = body;

        if (!id && !body.email) {
            return NextResponse.json({ error: 'id or email is required.' }, { status: 400 });
        }

        // Handle verify-email by email
        if (action === 'verify-email' && body.email) {
            const ok = await CustomerAuthServerStore.verifyEmail(body.email);
            return NextResponse.json({ success: ok });
        }

        if (!id) {
            return NextResponse.json({ error: 'id is required for this action.' }, { status: 400 });
        }

        // Special actions
        if (action === 'block') {
            const ok = await CustomerAuthServerStore.blockUser(id);
            return NextResponse.json({ success: ok });
        }
        if (action === 'unblock') {
            const ok = await CustomerAuthServerStore.unblockUser(id);
            return NextResponse.json({ success: ok });
        }
        if (action === 'reset-password' && body.newPassword) {
            const ok = await CustomerAuthServerStore.adminResetPassword(id, body.newPassword);
            return NextResponse.json({ success: ok });
        }
        if (action === 'merge' && body.sourceId) {
            const ok = await CustomerAuthServerStore.mergeUsers(id, body.sourceId);
            return NextResponse.json({ success: ok });
        }

        // General profile update
        const user = await CustomerAuthServerStore.updateUser(id, updates);
        if (!user) {
            return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 });
        }
        const { passwordHash: _, ...safeUser } = user;
        return NextResponse.json({ success: true, user: safeUser });
    } catch (error) {
        console.error('[Auth/User PUT] Error:', error);
        return NextResponse.json({ error: 'Failed to update user.' }, { status: 500 });
    }
}

/**
 * DELETE /api/auth/user?id=...
 * Removes a registered customer.
 */
export async function DELETE(request: NextRequest) {
    try {
        const id = request.nextUrl.searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'id query param required.' }, { status: 400 });
        }
        const ok = await CustomerAuthServerStore.removeUser(id);
        return NextResponse.json({ success: ok });
    } catch (error) {
        console.error('[Auth/User DELETE] Error:', error);
        return NextResponse.json({ error: 'Failed to delete user.' }, { status: 500 });
    }
}

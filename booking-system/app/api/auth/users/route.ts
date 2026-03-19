export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { CustomerAuthServerStore } from '@/lib/customer-auth-server-store';

/**
 * GET /api/auth/users
 * Returns all registered customers (for admin pages).
 * Strips passwordHash from each user.
 */
export async function GET() {
    try {
        const all = await CustomerAuthServerStore.getAll();
        const safeUsers = all.map(({ passwordHash: _, ...rest }) => rest);
        return NextResponse.json({ users: safeUsers });
    } catch (error) {
        console.error('[Auth/Users GET] Error:', error);
        return NextResponse.json({ error: 'Failed to fetch users.' }, { status: 500 });
    }
}

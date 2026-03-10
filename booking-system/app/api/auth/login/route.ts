import { NextResponse } from 'next/server';
import { CustomerAuthServerStore } from '@/lib/customer-auth-server-store';

/**
 * POST /api/auth/login
 * Body: { identifier, password }   (identifier = email or phone)
 */
export async function POST(request: Request) {
    try {
        const { identifier, password } = await request.json();

        if (!identifier || !password) {
            return NextResponse.json(
                { success: false, message: 'identifier and password are required.' },
                { status: 400 }
            );
        }

        const result = await CustomerAuthServerStore.login(identifier, password);

        if (!result.success) {
            return NextResponse.json(result, { status: 401 });
        }

        // Return user without passwordHash
        const { passwordHash: _, ...safeUser } = result.user!;
        return NextResponse.json({ success: true, message: result.message, user: safeUser });
    } catch (error) {
        console.error('[Auth/Login] Error:', error);
        return NextResponse.json({ success: false, message: 'Login failed.' }, { status: 500 });
    }
}

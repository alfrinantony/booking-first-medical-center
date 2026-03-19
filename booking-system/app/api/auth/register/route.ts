export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { CustomerAuthServerStore } from '@/lib/customer-auth-server-store';

/**
 * POST /api/auth/register
 * Body: { name, email, phone, password, gender?, dateOfBirth? }
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, email, phone, password, gender, dateOfBirth } = body;

        if (!name || !email || !phone || !password) {
            return NextResponse.json(
                { success: false, message: 'name, email, phone, and password are required.' },
                { status: 400 }
            );
        }

        const result = await CustomerAuthServerStore.register({
            name, email, phone, password, gender, dateOfBirth,
        });

        if (!result.success) {
            return NextResponse.json(result, { status: 409 });
        }

        // Return user without passwordHash
        const { passwordHash: _, ...safeUser } = result.user!;
        return NextResponse.json({ success: true, message: result.message, user: safeUser });
    } catch (error) {
        console.error('[Auth/Register] Error:', error);
        return NextResponse.json({ success: false, message: 'Registration failed.' }, { status: 500 });
    }
}

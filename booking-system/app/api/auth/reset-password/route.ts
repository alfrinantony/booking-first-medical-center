import { NextResponse } from 'next/server';
import { CustomerAuthServerStore } from '@/lib/customer-auth-server-store';

/**
 * POST /api/auth/reset-password
 * Body: { identifier, newPassword }
 */
export async function POST(request: Request) {
    try {
        const { identifier, newPassword } = await request.json();

        if (!identifier || !newPassword) {
            return NextResponse.json(
                { success: false, message: 'identifier and newPassword are required.' },
                { status: 400 }
            );
        }

        const result = await CustomerAuthServerStore.resetPassword(identifier, newPassword);

        if (!result.success) {
            return NextResponse.json(result, { status: 404 });
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('[Auth/ResetPassword] Error:', error);
        return NextResponse.json({ success: false, message: 'Password reset failed.' }, { status: 500 });
    }
}

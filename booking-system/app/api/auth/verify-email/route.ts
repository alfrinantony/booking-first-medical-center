export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { CustomerAuthServerStore } from '@/lib/customer-auth-server-store';

/**
 * POST /api/auth/verify-email
 * Body: { email }
 */
export async function POST(request: Request) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json(
                { success: false, message: 'email is required.' },
                { status: 400 }
            );
        }

        const success = await CustomerAuthServerStore.verifyEmail(email);

        if (!success) {
            return NextResponse.json(
                { success: false, message: 'User not found or could not verify.' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, message: 'Email verified successfully.' });
    } catch (error) {
        console.error('[Auth/Verify-Email] Error:', error);
        return NextResponse.json({ success: false, message: 'Verification failed.' }, { status: 500 });
    }
}

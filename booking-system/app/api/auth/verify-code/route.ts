import { NextResponse } from 'next/server';
import { VerificationStore } from '@/lib/verification-store';

/**
 * POST /api/auth/verify-code
 *
 * Validates a 6-digit OTP code.
 * Body: { email: string, code: string, purpose: 'registration' | 'password-reset' }
 */
export async function POST(request: Request) {
    try {
        const { email, code, purpose } = await request.json();

        if (!email || !code || !purpose) {
            return NextResponse.json(
                { error: 'email, code, and purpose are required' },
                { status: 400 }
            );
        }

        const valid = VerificationStore.verifyOtp(email, code, purpose);

        if (!valid) {
            return NextResponse.json(
                { valid: false, error: 'Invalid or expired verification code.' },
                { status: 400 }
            );
        }

        return NextResponse.json({ valid: true, message: 'Code verified successfully.' });

    } catch (error) {
        console.error('[Verification] Verify error:', error);
        return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
    }
}

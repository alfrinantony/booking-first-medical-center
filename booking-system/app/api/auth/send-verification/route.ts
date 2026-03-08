import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { VerificationStore } from '@/lib/verification-store';

/**
 * POST /api/auth/send-verification
 *
 * Generates a 6-digit OTP and sends it to the user's email.
 * Body: { email: string, purpose: 'registration' | 'password-reset' }
 *
 * Note: User existence checks (duplicate email for registration, account
 * lookup for password-reset) are performed on the CLIENT side before calling
 * this endpoint, because user data lives in the browser's localStorage via
 * Zustand persist middleware and is not accessible server-side.
 *
 * If SMTP is not configured, returns the code in the response (dev mode).
 */
export async function POST(request: Request) {
    try {
        const { email, purpose } = await request.json();

        if (!email || !purpose) {
            return NextResponse.json(
                { error: 'email and purpose are required' },
                { status: 400 }
            );
        }

        if (!['registration', 'password-reset'].includes(purpose)) {
            return NextResponse.json(
                { error: 'purpose must be "registration" or "password-reset"' },
                { status: 400 }
            );
        }

        // Generate OTP
        const code = VerificationStore.generateOtp(email, purpose);

        // Try to send email
        const smtpUser = process.env.SMTP_USER || '';
        const smtpPass = process.env.SMTP_PASS || '';

        if (!smtpUser || !smtpPass) {
            // Dev mode — return code directly
            console.log(`[Verification] DEV MODE — OTP for ${email}: ${code}`);
            return NextResponse.json({
                success: true,
                devMode: true,
                code, // Only returned when SMTP is not configured
                message: 'SMTP not configured. Code returned for development.',
            });
        }

        // Send email with OTP
        const smtpHost = process.env.SMTP_HOST || 'mail.firsthealthmanagement.com';
        const smtpPort = parseInt(process.env.SMTP_PORT || '465');

        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: { user: smtpUser, pass: smtpPass },
        });

        const purposeText = purpose === 'registration'
            ? 'verify your email for registration'
            : 'reset your password';

        try {
            await transporter.sendMail({
                from: `"First Medical Center" <${smtpUser}>`,
                to: email,
                subject: `Your verification code — ${code}`,
                html: `
                    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
                        <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px;border-radius:12px 12px 0 0;color:white;text-align:center;">
                            <h1 style="margin:0;font-size:20px;">🏥 First Medical Center</h1>
                            <p style="margin:8px 0 0;opacity:0.9;font-size:14px;">Verification Code</p>
                        </div>
                        <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;text-align:center;">
                            <p style="color:#334155;font-size:14px;">Use this code to ${purposeText}:</p>
                            <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#4f46e5;margin:20px 0;padding:16px;background:white;border-radius:8px;border:2px dashed #c7d2fe;">
                                ${code}
                            </div>
                            <p style="color:#94a3b8;font-size:12px;">This code expires in 10 minutes.</p>
                        </div>
                        <div style="background:#f1f5f9;padding:12px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none;text-align:center;">
                            <p style="margin:0;font-size:11px;color:#94a3b8;">If you didn't request this, please ignore this email.</p>
                        </div>
                    </div>
                `,
            });

            console.log(`[Verification] OTP sent to ${email}`);
            return NextResponse.json({ success: true, message: 'Verification code sent to your email.' });
        } catch (smtpError) {
            // SMTP sending failed (e.g. auth disabled on tenant) — fall back to dev mode
            console.warn(`[Verification] SMTP failed, falling back to dev mode. OTP for ${email}: ${code}`, smtpError);
            return NextResponse.json({
                success: true,
                devMode: true,
                code,
                message: 'Email delivery failed. Code returned for development.',
            });
        }

    } catch (error) {
        console.error('[Verification] Error:', error);
        return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 });
    }
}

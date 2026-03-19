export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

/**
 * Simple hash function for OTP codes.
 * Uses a basic HMAC-like approach with a server-side salt so codes aren't
 * stored in plain text on the client, but can still be verified client-side.
 */
function hashCode(code: string, email: string): string {
    const salt = 'fmc-otp-2024';
    const raw = `${salt}:${email.toLowerCase()}:${code}`;
    // Simple hash: sum char codes with shifting
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
        const ch = raw.charCodeAt(i);
        hash = ((hash << 5) - hash) + ch;
        hash |= 0; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
}

/**
 * POST /api/auth/send-verification
 *
 * Generates a 6-digit OTP and sends it to the user's email.
 * Body: { email: string, purpose: 'registration' | 'password-reset' }
 *
 * Returns a `codeHash` in every response so the client can verify the OTP
 * locally. This is necessary because Azure SWA runs API routes as stateless
 * serverless functions — the in-memory OTP store does NOT persist between
 * invocations.
 *
 * If SMTP is not configured, also returns the plain code (dev mode).
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

        // Generate 6-digit OTP
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const codeHash = hashCode(code, email);

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
                codeHash,
                message: 'SMTP not configured. Code returned for development.',
            });
        }

        // Send email with OTP
        const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
        const smtpPort = parseInt(process.env.SMTP_PORT || '587');

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
            return NextResponse.json({
                success: true,
                codeHash,
                message: 'Verification code sent to your email.',
            });
        } catch (smtpError) {
            // SMTP sending failed — fall back to dev mode
            console.warn(`[Verification] SMTP failed, falling back to dev mode. OTP for ${email}: ${code}`, smtpError);
            return NextResponse.json({
                success: true,
                devMode: true,
                code,
                codeHash,
                message: 'Email delivery failed. Code returned for development.',
            });
        }

    } catch (error) {
        console.error('[Verification] Error:', error);
        return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

/**
 * POST /api/voice-agent/email-transcript
 *
 * Sends the voice conversation transcript to the clinic email
 * immediately after the patient's session ends.
 */
export async function POST(request: Request) {
    try {
        const { chatLog, patientName, patientPhone, timestamp } = await request.json();

        if (!chatLog || chatLog.length === 0) {
            return NextResponse.json({ ok: true, skipped: true });
        }

        // Format conversation for email
        const conversationHtml = chatLog.map((msg: { role: string; content: string }) => {
            const isUser = msg.role === 'user';
            const label = isUser ? `🗣️ Patient` : `🤖 Assistant`;
            const color = isUser ? '#2563eb' : '#059669';
            return `<div style="margin-bottom:12px;">
                <strong style="color:${color}">${label}:</strong>
                <span style="color:#334155">${msg.content}</span>
            </div>`;
        }).join('');

        const dateStr = new Date(timestamp || Date.now()).toLocaleString('en-AE', {
            timeZone: 'Asia/Dubai',
            dateStyle: 'full',
            timeStyle: 'short',
        });

        const emailHtml = `
            <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;">
                <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px;border-radius:12px 12px 0 0;color:white;">
                    <h1 style="margin:0;font-size:20px;">🏥 DubaiFMC — Voice Conversation Transcript</h1>
                    <p style="margin:8px 0 0;opacity:0.9;font-size:14px;">${dateStr} (Dubai Time)</p>
                </div>
                <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;">
                    <table style="margin-bottom:20px;font-size:14px;">
                        <tr><td style="padding:4px 12px 4px 0;color:#64748b;">Patient Name:</td><td style="font-weight:600;">${patientName || 'Unknown'}</td></tr>
                        <tr><td style="padding:4px 12px 4px 0;color:#64748b;">Phone:</td><td style="font-weight:600;">${patientPhone || 'N/A'}</td></tr>
                        <tr><td style="padding:4px 12px 4px 0;color:#64748b;">Messages:</td><td style="font-weight:600;">${chatLog.length}</td></tr>
                    </table>
                    <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;" />
                    <h2 style="font-size:16px;color:#1e293b;margin:0 0 16px;">Conversation</h2>
                    ${conversationHtml}
                </div>
                <div style="background:#f1f5f9;padding:16px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none;text-align:center;">
                    <p style="margin:0;font-size:12px;color:#94a3b8;">Sent automatically by DubaiFMC Booking System</p>
                </div>
            </div>
        `;

        // SMTP Configuration
        const smtpHost = process.env.SMTP_HOST || 'mail.firsthealthmanagement.com';
        const smtpPort = parseInt(process.env.SMTP_PORT || '587');
        const smtpUser = process.env.SMTP_USER || '';
        const smtpPass = process.env.SMTP_PASS || '';
        const recipientEmail = process.env.TRANSCRIPT_EMAIL || 'es@dubaifmc.com';

        if (!smtpUser || !smtpPass) {
            console.warn('[Email] SMTP credentials not configured (SMTP_USER / SMTP_PASS). Skipping email.');
            return NextResponse.json({ ok: true, skipped: true, reason: 'SMTP not configured' });
        }

        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
        });

        await transporter.sendMail({
            from: `"DubaiFMC AI Assistant" <${smtpUser}>`,
            to: recipientEmail,
            subject: `Voice Conversation — ${patientName || 'Patient'} — ${dateStr}`,
            html: emailHtml,
        });

        console.log(`[Email] Transcript sent to ${recipientEmail}`);
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[Email] Failed to send transcript:', error);
        return NextResponse.json(
            { error: 'Failed to send email' },
            { status: 500 }
        );
    }
}

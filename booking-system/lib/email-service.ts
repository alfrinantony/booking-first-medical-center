/**
 * lib/email-service.ts
 *
 * Shared transactional email utility.
 * Reads SMTP credentials from SettingsStore (configured via /admin/settings).
 * Falls back to process.env.EMAIL_* if SettingsStore values are empty.
 *
 * Exports:
 *   sendBookingConfirmation  — sent immediately after a new booking
 *   sendBookingCancellation  — sent when a patient cancels
 *   sendAppointmentReminder  — sent ~24h before the appointment
 *   sendPaymentReceipt       — sent after Stripe payment success
 */

import nodemailer from 'nodemailer';

interface BookingEmailData {
    patientName: string;
    email: string;
    whatsappNumber?: string;
    date: string;          // YYYY-MM-DD
    slot: string;          // e.g. "10:00 AM"
    serviceName: string;
    clinicName?: string;
    doctorName?: string;
    bookingId: string;
}

// ── Build a reusable transporter ──────────────────────────────
async function getTransporter() {
    const { SettingsStore } = await import('@/lib/settings-store');
    const s = await SettingsStore.getSettings();

    const host = s.emailHost || process.env.EMAIL_HOST || '';
    const port = s.emailPort || Number(process.env.EMAIL_PORT) || 587;
    const user = s.emailUser || process.env.EMAIL_USER || '';
    const pass = s.emailPass || process.env.EMAIL_PASS || '';

    if (!host || !user || !pass) {
        console.warn('[EmailService] SMTP credentials not configured — skipping email send.');
        return null;
    }

    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        tls: { rejectUnauthorized: false }, // Needed for some cPanel hosts
    });
}

// ── Format date nicely ────────────────────────────────────────
function formatDate(dateStr: string): string {
    try {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-AE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return dateStr; }
}

// ── Shared HTML wrapper ───────────────────────────────────────
function wrapEmail(title: string, body: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">First Medical Center</h1>
            <p style="margin:4px 0 0;color:#c7d2fe;font-size:13px;">Premium Aesthetic &amp; Laser Clinic · Dubai</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            ${body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">© ${new Date().getFullYear()} First Medical Center LLC · Dubai, UAE</p>
            <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">+971 4 250 6262 · <a href="https://ai.dubaifmc.com" style="color:#6366f1;">ai.dubaifmc.com</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Booking detail card HTML ──────────────────────────────────
function bookingCard(b: BookingEmailData): string {
    return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin:20px 0;">
      <tr><td style="padding:20px;">
        <table width="100%" cellpadding="4" cellspacing="0" style="font-size:14px;color:#374151;">
          ${b.clinicName ? `<tr><td style="color:#6b7280;width:140px;">Branch</td><td style="font-weight:600;">${b.clinicName}</td></tr>` : ''}
          ${b.doctorName ? `<tr><td style="color:#6b7280;">Doctor</td><td style="font-weight:600;">${b.doctorName}</td></tr>` : ''}
          <tr><td style="color:#6b7280;">Service</td><td style="font-weight:600;">${b.serviceName}</td></tr>
          <tr><td style="color:#6b7280;">Date</td><td style="font-weight:600;">${formatDate(b.date)}</td></tr>
          <tr><td style="color:#6b7280;">Time</td><td style="font-weight:600;">${b.slot}</td></tr>
        </table>
      </td></tr>
    </table>`;
}

// ─────────────────────────────────────────────────────────────
// 1. Booking Confirmation
// ─────────────────────────────────────────────────────────────
export async function sendBookingConfirmation(
    booking: BookingEmailData,
    cancelUrl: string,
): Promise<void> {
    const t = await getTransporter();
    if (!t || !booking.email) return;

    const body = `
    <h2 style="margin:0 0 4px;font-size:20px;color:#1e293b;">Appointment Confirmed ✅</h2>
    <p style="margin:0 0 16px;color:#64748b;font-size:14px;">Hi ${booking.patientName}, your appointment has been booked successfully.</p>
    ${bookingCard(booking)}
    <p style="font-size:13px;color:#64748b;margin:16px 0 8px;">Need to cancel? You can cancel up to <strong>12 hours before</strong> your appointment:</p>
    <a href="${cancelUrl}" style="display:inline-block;padding:12px 24px;background:#ef4444;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Cancel Appointment</a>
    <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;">Please arrive 10 minutes early. Bring a valid ID for your records.</p>`;

    await t.sendMail({
        from: `"First Medical Center" <${((t as any).options)?.auth?.user || 'noreply@firstmedicalcenter.ae'}>`,
        to: booking.email,
        subject: `✅ Appointment Confirmed — ${formatDate(booking.date)} at ${booking.slot}`,
        html: wrapEmail('Appointment Confirmed', body),
    });
    console.log(`[EmailService] Confirmation sent to ${booking.email}`);
}

// ─────────────────────────────────────────────────────────────
// 2. Booking Cancellation
// ─────────────────────────────────────────────────────────────
export async function sendBookingCancellation(booking: BookingEmailData): Promise<void> {
    const t = await getTransporter();
    if (!t || !booking.email) return;

    const body = `
    <h2 style="margin:0 0 4px;font-size:20px;color:#1e293b;">Appointment Cancelled</h2>
    <p style="margin:0 0 16px;color:#64748b;font-size:14px;">Hi ${booking.patientName}, your appointment has been successfully cancelled.</p>
    ${bookingCard(booking)}
    <p style="font-size:13px;color:#64748b;margin:16px 0 8px;">We hope to see you soon. Book a new appointment anytime:</p>
    <a href="https://ai.dubaifmc.com/booking" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Book New Appointment</a>`;

    await t.sendMail({
        from: `"First Medical Center" <noreply@firstmedicalcenter.ae>`,
        to: booking.email,
        subject: `Appointment Cancelled — ${formatDate(booking.date)}`,
        html: wrapEmail('Appointment Cancelled', body),
    });
    console.log(`[EmailService] Cancellation sent to ${booking.email}`);
}

// ─────────────────────────────────────────────────────────────
// 3. Appointment Reminder (24h before)
// ─────────────────────────────────────────────────────────────
export async function sendAppointmentReminder(booking: BookingEmailData): Promise<void> {
    const t = await getTransporter();
    if (!t || !booking.email) return;

    const body = `
    <h2 style="margin:0 0 4px;font-size:20px;color:#1e293b;">Appointment Reminder 🔔</h2>
    <p style="margin:0 0 16px;color:#64748b;font-size:14px;">Hi ${booking.patientName}, this is a friendly reminder about your appointment <strong>tomorrow</strong>.</p>
    ${bookingCard(booking)}
    <p style="font-size:13px;color:#64748b;margin:16px 0 0;">Please arrive 10 minutes early. Questions? Call us at <strong>+971 4 250 6262</strong>.</p>`;

    await t.sendMail({
        from: `"First Medical Center" <noreply@firstmedicalcenter.ae>`,
        to: booking.email,
        subject: `⏰ Reminder: Your appointment is tomorrow at ${booking.slot}`,
        html: wrapEmail('Appointment Reminder', body),
    });
    console.log(`[EmailService] Reminder sent to ${booking.email}`);
}

// ─────────────────────────────────────────────────────────────
// 4. Payment Receipt
// ─────────────────────────────────────────────────────────────
export async function sendPaymentReceipt(
    booking: BookingEmailData,
    amountAED: number,
    invoiceNumber?: string,
): Promise<void> {
    const t = await getTransporter();
    if (!t || !booking.email) return;

    const body = `
    <h2 style="margin:0 0 4px;font-size:20px;color:#1e293b;">Payment Received 💳</h2>
    <p style="margin:0 0 16px;color:#64748b;font-size:14px;">Hi ${booking.patientName}, we have received your payment. See you soon!</p>
    ${bookingCard(booking)}
    <table width="100%" cellpadding="4" cellspacing="0" style="font-size:14px;color:#374151;margin:12px 0;">
      <tr><td style="color:#6b7280;width:140px;">Amount Paid</td><td style="font-weight:700;color:#059669;">AED ${amountAED.toFixed(2)}</td></tr>
      ${invoiceNumber ? `<tr><td style="color:#6b7280;">Invoice #</td><td style="font-weight:600;">${invoiceNumber}</td></tr>` : ''}
      <tr><td style="color:#6b7280;">Payment Method</td><td style="font-weight:600;">Online (Card)</td></tr>
    </table>`;

    await t.sendMail({
        from: `"First Medical Center" <noreply@firstmedicalcenter.ae>`,
        to: booking.email,
        subject: `Payment Receipt — AED ${amountAED.toFixed(2)} · ${invoiceNumber || booking.bookingId}`,
        html: wrapEmail('Payment Receipt', body),
    });
    console.log(`[EmailService] Receipt sent to ${booking.email}`);
}

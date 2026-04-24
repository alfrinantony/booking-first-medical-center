/**
 * POST /api/cron/send-reminders
 *
 * Sends appointment reminders to all patients with bookings TOMORROW.
 * Channels: WhatsApp (Meta Cloud API) + Email (SMTP).
 *
 * Call this daily at 08:00 GST (04:00 UTC) via:
 *   - vercel.json cron job
 *   - Azure Function Timer Trigger
 *   - External cron service (e.g. cron-job.org)
 *
 * Protect with:  x-cron-secret: <CRON_SECRET env var>
 */
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { BookingsStore } from '@/lib/bookings-store';
import { sendAppointmentReminder } from '@/lib/email-service';
import { sendWhatsAppMessage } from '@/lib/whatsapp-bot';
import { ServicesStore } from '@/lib/services-store';

// ── Build tomorrow's date string ─────────────────────────────
function getTomorrowDate(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
}

// ── WhatsApp reminder message text ──────────────────────────
function buildWhatsAppReminder(
    patientName: string,
    date: string,
    slot: string,
    serviceName: string,
    clinicName: string,
): string {
    const firstName = patientName.split(' ')[0];
    return `🔔 *Appointment Reminder — First Medical Center*

Hi ${firstName}! This is a friendly reminder that you have an appointment *tomorrow*.

📅 *Date:* ${new Date(date + 'T00:00:00').toLocaleDateString('en-AE', { weekday: 'long', day: 'numeric', month: 'long' })}
⏰ *Time:* ${slot}
💆 *Service:* ${serviceName}
🏥 *Branch:* ${clinicName}

Please arrive *10 minutes early* and bring a valid ID.

Questions? Call us at +971 4 250 6262.
See you tomorrow! ✨`;
}

export async function POST(request: Request) {
    // ── Auth check ──────────────────────────────────────────
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
        const provided = request.headers.get('x-cron-secret');
        if (provided !== cronSecret) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    const tomorrow = getTomorrowDate();
    console.log(`[ReminderCron] Running for date: ${tomorrow}`);

    const results = {
        date: tomorrow,
        total: 0,
        whatsappSent: 0,
        emailSent: 0,
        skipped: 0,
        errors: [] as string[],
    };

    try {
        // ── Load all bookings + clinic data ─────────────────
        const [allBookings, clinics] = await Promise.all([
            BookingsStore.getAll(),
            ServicesStore.getClinics(),
        ]);

        // Build clinic name map
        const clinicMap = new Map<string, string>();
        for (const c of clinics as any[]) {
            clinicMap.set(c.id, c.name);
        }

        // Filter to tomorrow's active bookings
        const tomorrowBookings = allBookings.filter(b =>
            b.date === tomorrow &&
            ['booked', 'confirmed'].includes(b.status) &&
            (b.email || b.whatsappNumber)
        );

        results.total = tomorrowBookings.length;
        console.log(`[ReminderCron] Found ${tomorrowBookings.length} bookings to remind`);

        // ── Load WhatsApp phone number ID from settings ─────
        const { SettingsStore } = await import('@/lib/settings-store');
        const settings = await SettingsStore.getSettings();
        const phoneNumberId = settings.metaPhoneId || process.env.META_PHONE_NUMBER_ID || '';

        for (const booking of tomorrowBookings) {
            const clinicName = clinicMap.get(booking.clinicId) || 'our clinic';

            try {
                // ── WhatsApp reminder ────────────────────────
                if (booking.whatsappNumber && phoneNumberId) {
                    const msg = buildWhatsAppReminder(
                        booking.patientName,
                        booking.date,
                        booking.slot,
                        booking.serviceName || 'your appointment',
                        clinicName,
                    );
                    // Normalize phone: strip spaces/dashes, ensure + prefix
                    const phone = booking.whatsappNumber.replace(/[\s\-()]/g, '');
                    await sendWhatsAppMessage(phone, phoneNumberId, msg);
                    results.whatsappSent++;
                }

                // ── Email reminder ───────────────────────────
                if (booking.email) {
                    await sendAppointmentReminder({
                        patientName: booking.patientName,
                        email: booking.email,
                        whatsappNumber: booking.whatsappNumber,
                        date: booking.date,
                        slot: booking.slot,
                        serviceName: booking.serviceName || 'Appointment',
                        clinicName,
                        bookingId: booking.id,
                    });
                    results.emailSent++;
                }

                if (!booking.whatsappNumber && !booking.email) {
                    results.skipped++;
                }

            } catch (err) {
                const msg = `Failed reminder for booking ${booking.id} (${booking.patientName}): ${String(err).substring(0, 150)}`;
                console.error(`[ReminderCron] ${msg}`);
                results.errors.push(msg);
            }
        }

        console.log(`[ReminderCron] Done. WhatsApp: ${results.whatsappSent}, Email: ${results.emailSent}, Skipped: ${results.skipped}`);
        return NextResponse.json({ success: true, ...results });

    } catch (err) {
        console.error('[ReminderCron] Fatal error:', err);
        return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
    }
}

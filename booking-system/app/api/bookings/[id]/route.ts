import { NextRequest, NextResponse } from 'next/server';
import { BookingsStore } from '@/lib/bookings-store';
import { LoyaltyStore } from '@/lib/loyalty-store';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const booking = await BookingsStore.getById(id);
    if (!booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    return NextResponse.json(booking);
}

// Helper: parse "10:00 AM" style slot into comparable minutes-since-midnight
function slotToMinutes(slot: string): number {
    const match = slot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return 0;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const period = match[3].toUpperCase();
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return h * 60 + m;
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        // Get existing booking BEFORE update for penalty logic
        const existingBooking = await BookingsStore.getById(id);
        if (!existingBooking) {
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }

        const oldStatus = existingBooking.status;
        const newStatus = body.status;
        const customerPhone = existingBooking.whatsappNumber || existingBooking.email || '';

        const updatedBooking = await BookingsStore.update(id, body);
        if (!updatedBooking) {
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }

        // ── Auto-apply loyalty penalties ──
        if (customerPhone) {
            const meta = {
                branch: existingBooking.clinicId,
                date: existingBooking.date,
                slot: existingBooking.slot,
            };

            // 1. No-show penalty: -50 points
            if (newStatus === 'no_show' && oldStatus !== 'no_show') {
                await LoyaltyStore.penaltyNoShow(customerPhone, meta);
            }

            // 2. Same-day reschedule penalties
            if (newStatus === 'rescheduled' && oldStatus !== 'rescheduled') {
                const today = new Date().toISOString().split('T')[0];
                const isToday = existingBooking.date === today;

                if (isToday) {
                    const now = new Date();
                    const currentMinutes = now.getHours() * 60 + now.getMinutes();
                    const bookedMinutes = slotToMinutes(existingBooking.slot);

                    const rescheduleMeta = {
                        ...meta,
                        newSlot: body.slot || existingBooking.slot,
                        newDate: body.date || existingBooking.date,
                    };

                    if (currentMinutes < bookedMinutes) {
                        // Reschedule BEFORE the appointment time → -25
                        await LoyaltyStore.penaltyRescheduleBefore(customerPhone, rescheduleMeta);
                    } else {
                        // Reschedule AFTER (or at) the appointment time → -40
                        await LoyaltyStore.penaltyRescheduleAfter(customerPhone, rescheduleMeta);
                    }
                }
            }
        }

        return NextResponse.json(updatedBooking);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
    }
}

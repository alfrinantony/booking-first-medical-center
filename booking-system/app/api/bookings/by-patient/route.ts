export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { BookingsStore } from '@/lib/bookings-store';

/**
 * GET /api/bookings/by-patient?phone=...
 * Returns upcoming (today + future) bookings for a patient by phone/whatsapp number.
 *
 * DELETE /api/bookings/by-patient?id=...
 * Cancels a booking (sets status to 'cancelled'). Only works for future bookings.
 *
 * PATCH /api/bookings/by-patient
 * Reschedules a booking: { id, date, slot }
 */

const today = () => new Date().toISOString().split('T')[0];

export async function GET(request: NextRequest) {
    const phone = request.nextUrl.searchParams.get('phone');
    const name = request.nextUrl.searchParams.get('name');
    const includeAll = request.nextUrl.searchParams.get('includeAll') === 'true';

    const id = request.nextUrl.searchParams.get('id');
    if (id) {
        const booking = await BookingsStore.getById(id);
        if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        return NextResponse.json({ booking });
    }

    if (!phone && !name) {
        return NextResponse.json({ error: 'phone or name required' }, { status: 400 });
    }

    const all = await BookingsStore.getAll();
    const todayStr = today();

    const bookings = all.filter(b => {
        const matchPhone = phone && (b.whatsappNumber === phone || b.whatsappNumber === `+${phone}`);
        const matchName = name && b.patientName.toLowerCase().includes(name.toLowerCase());
        if (!(matchPhone || matchName)) return false;
        if (!includeAll && b.date < todayStr) return false; // Skip past bookings unless includeAll
        return b.status !== 'cancelled';
    });

    // Sort ascending by date
    bookings.sort((a, b) => a.date.localeCompare(b.date));

    // Deduplicate visited clinic IDs (for review eligibility)
    const visitedClinicIds = [...new Set(bookings.map(b => b.clinicId))];

    return NextResponse.json({ bookings, visitedClinicIds });
}

export async function DELETE(request: NextRequest) {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
        return NextResponse.json({ error: 'Booking id required' }, { status: 400 });
    }

    const booking = await BookingsStore.getById(id);
    if (!booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Only allow cancelling future bookings
    if (booking.date < today()) {
        return NextResponse.json({ error: 'Cannot cancel past bookings' }, { status: 400 });
    }

    const updated = await BookingsStore.update(id, { status: 'cancelled', confirmationStatus: 'cancelled' });
    return NextResponse.json({ booking: updated });
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, date, slot } = body;

        if (!id || !date || !slot) {
            return NextResponse.json({ error: 'id, date, and slot are required' }, { status: 400 });
        }

        const booking = await BookingsStore.getById(id);
        if (!booking) {
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }

        if (booking.date < today()) {
            return NextResponse.json({ error: 'Cannot reschedule past bookings' }, { status: 400 });
        }

        const updateData: any = { date, slot, status: 'rescheduled', confirmationStatus: 'rescheduled' };
        if (body.clinicId) updateData.clinicId = body.clinicId;
        if (body.deptId) updateData.deptId = body.deptId;
        if (body.doctorId) updateData.doctorId = body.doctorId;
        
        const updated = await BookingsStore.update(id, updateData);
        return NextResponse.json({ booking: updated });
    } catch {
        return NextResponse.json({ error: 'Failed to reschedule booking' }, { status: 500 });
    }
}

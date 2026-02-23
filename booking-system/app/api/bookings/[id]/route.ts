import { NextRequest, NextResponse } from 'next/server';
import { BookingsStore } from '@/lib/bookings-store';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const booking = BookingsStore.getById(id);
    if (!booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    return NextResponse.json(booking);
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const updatedBooking = BookingsStore.update(id, body);

        if (!updatedBooking) {
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }

        return NextResponse.json(updatedBooking);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
    }
}

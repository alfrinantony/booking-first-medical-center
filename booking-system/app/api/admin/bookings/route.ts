import { NextRequest, NextResponse } from 'next/server';
import { BookingsStore } from '@/lib/bookings-store';
import { Booking } from '@/lib/data';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const filters = {
        clinicId: searchParams.get('clinicId') || undefined,
        deptId: searchParams.get('deptId') || undefined,
        doctorId: searchParams.get('doctorId') || undefined,
        date: searchParams.get('date') || undefined,
        search: searchParams.get('search') || undefined,
    };

    const bookings = BookingsStore.getByFilters(filters);
    return NextResponse.json(bookings);
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        // Basic validation
        if (!body.clinicId || !body.deptId || !body.doctorId || !body.serviceId || !body.date || !body.slot || !body.patientName) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Check for duplicate: same patient, same date, same slot (non-cancelled)
        const existingBookings = BookingsStore.getAll();
        const duplicate = existingBookings.find(b =>
            b.patientName === body.patientName &&
            b.date === body.date &&
            b.slot === body.slot &&
            b.status !== 'cancelled'
        );
        if (duplicate) {
            return NextResponse.json(
                { error: 'You already have a booking at this date and time.' },
                { status: 409 }
            );
        }

        const newBooking = BookingsStore.add({
            ...body,
            status: 'booked'
        });

        return NextResponse.json(newBooking, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
    }
}

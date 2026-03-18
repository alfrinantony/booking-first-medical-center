import { NextRequest, NextResponse } from 'next/server';
import { BookingsStore } from '@/lib/bookings-store';
import { Booking } from '@/lib/data';
import { ServicesStore } from '@/lib/services-store';
import { PackagesStore } from '@/lib/packages-store';
import { BillingStore } from '@/lib/billing-store';

// ── Helper: parse "10:30 AM" → minutes from midnight ──
function parseSlotToMinutes(slot: string): number {
    const [time, period] = slot.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const filters = {
        clinicId: searchParams.get('clinicId') || undefined,
        deptId: searchParams.get('deptId') || undefined,
        doctorId: searchParams.get('doctorId') || undefined,
        date: searchParams.get('date') || undefined,
        search: searchParams.get('search') || undefined,
    };

    const bookings = await BookingsStore.getByFilters(filters);
    return NextResponse.json(bookings);
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        // Basic validation
        if (!body.clinicId || !body.deptId || !body.doctorId || !body.serviceId || !body.date || !body.slot || !body.patientName) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Auto-fetch duration from service module if not provided
        let duration = body.duration;
        if (!duration) {
            const service = await ServicesStore.getServiceById(body.serviceId);
            duration = service?.duration || 30;
        }

        // Duration-aware overlap check: same patient, same date, overlapping time range
        const existingBookings = await BookingsStore.getAll();
        const newStart = parseSlotToMinutes(body.slot);
        const newEnd = newStart + duration;

        const duplicate = existingBookings.find(b =>
            b.patientName === body.patientName &&
            b.date === body.date &&
            b.status !== 'cancelled' &&
            (() => {
                const bStart = parseSlotToMinutes(b.slot);
                const bEnd = bStart + (b.duration || 30);
                return newStart < bEnd && bStart < newEnd; // ranges overlap
            })()
        );
        if (duplicate) {
            return NextResponse.json(
                { error: 'You already have a booking that overlaps with this time slot.' },
                { status: 409 }
            );
        }

        const newBooking = await BookingsStore.add({
            ...body,
            duration,
            status: 'booked'
        });

        // ── Handle Package Payment Flow ──
        if (body.paymentMethod === 'package' && body.packageId) {
            try {
                // 1. Deduct session
                const useRes = await PackagesStore.useSession(body.packageId, body.serviceId);
                if (useRes.success) {
                    // Fetch package details for the invoice
                    const pkgData = await PackagesStore.getAllCustomerPackages();
                    const activePkg = pkgData.find(p => p.id === body.packageId);

                    // 2. Generate a zero-dollar invoice for record-keeping
                    const service = await ServicesStore.getServiceById(body.serviceId);
                    await BillingStore.createInvoice({
                        clientName: body.patientName,
                        clientPhone: body.whatsappNumber || body.patientName, // Fallback
                        items: [{
                            description: `Package Redemption: ${activePkg?.packageName || 'Service'} - ${service?.name || 'Session'}`,
                            quantity: 1,
                            unitPrice: 0,
                            total: 0,
                        }],
                        packageDetails: activePkg?.packageName,
                        subtotal: 0,
                        taxPercentage: 0,
                        taxAmount: 0,
                        totalAmount: 0,
                        paymentMethod: 'online', // Or 'package' if enum allows
                        paymentConfirmed: true,
                        paymentReceptionStatus: 'received',
                        generatedBy: 'System (Online Booking)',
                        date: new Date().toISOString().split('T')[0],
                        notes: `Session deducted from package: ${activePkg?.packageName}. Booking ID: ${newBooking.id}`
                    });
                }
            } catch (error) {
                console.error("Failed to process package deduction or invoice:", error);
            }
        }

        return NextResponse.json(newBooking, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
    }
}

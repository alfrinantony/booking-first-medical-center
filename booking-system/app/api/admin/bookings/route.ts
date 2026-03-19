import { NextRequest, NextResponse } from 'next/server';
import { BookingsStore } from '@/lib/bookings-store';
import { Booking } from '@/lib/data';
import { ServicesStore } from '@/lib/services-store';
import { PackagesStore } from '@/lib/packages-store';
import { BillingStore } from '@/lib/billing-store';
import { HRStore } from '@/lib/hr-store';
import { isEmployeeOnApprovedLeave } from '@/lib/hr-leave-store';
import { WalletStore } from '@/lib/wallet-store';

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
        const service = await ServicesStore.getServiceById(body.serviceId);
        if (!duration) {
            duration = service?.duration || 30;
        }

        // ── HR Leave Validation ──
        const hrEmployees = await HRStore.getAll();
        let employee = hrEmployees.find(e => e.id === body.doctorId);
        if (!employee) {
            // Attempt to resolve by doctor name
            const allClinics = await ServicesStore.getClinics();
            let doctorObjResult = null;
            for (const c of allClinics) {
                for (const dept of c.departments) {
                    const d = dept.doctors.find(x => x.id === body.doctorId);
                    if (d) { doctorObjResult = d; break; }
                }
                if (doctorObjResult) break;
            }
            if (doctorObjResult) {
                const docName = doctorObjResult.name.replace(/^Dr\.\s+/i, '').toLowerCase().trim();
                employee = hrEmployees.find(e => 
                    `${e.firstName} ${e.lastName}`.toLowerCase().includes(docName) || 
                    docName.includes(`${e.firstName} ${e.lastName}`.toLowerCase())
                );
            }
        }

        if (employee) {
            const onLeave = await isEmployeeOnApprovedLeave(employee.id, body.date);
            if (onLeave) {
                return NextResponse.json(
                    { error: 'Cannot book appointment. The selected clinician is on approved leave today.' },
                    { status: 400 }
                );
            }
        }

        // Duration-aware overlap check: same patient, same date, overlapping time range
        const existingBookings = await BookingsStore.getAll();

        // ── Service Interval and Follow-Up Validation ──
        let isFollowUp = false;
        if (service) {
            // Find past bookings for this same service and patient
            // Find ANY non-cancelled booking for this service and patient to enforce intervals against their nearest scheduled date
            const pastBookings = existingBookings.filter(b => 
                b.patientName === body.patientName && 
                b.serviceId === body.serviceId && 
                b.status !== 'cancelled'
            );

            // Sort by date descending to find the most recent one (could be past or future)
            pastBookings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            const lastBooking = pastBookings[0];

            if (lastBooking) {
                const diffTime = Math.abs(new Date(body.date).getTime() - new Date(lastBooking.date).getTime());
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                const followUpLimit = service.followUpDuration || 0;
                const minInterval = service.minimumIntervalDays || 0;

                if (followUpLimit > 0 && diffDays <= followUpLimit) {
                    // Cap duration to 30 mins for follow-ups
                    duration = Math.min(duration, 30);
                    isFollowUp = true;
                    body.amount = 0; // Follow-up appointments are free
                } else if (minInterval > 0 && diffDays < minInterval) {
                    return NextResponse.json(
                        { error: `This service requires a minimum interval of ${minInterval} days between appointments.` },
                        { status: 400 }
                    );
                }
            }
        }

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
            isFollowUp,
            status: 'booked'
        });

        // ── Handle Restricted Wallet Deduction ──
        if (body.restrictedDeducted && body.restrictedDeducted > 0) {
            const customerPhone = body.patientPhone || body.whatsappNumber;
            if (customerPhone) {
                try {
                    await WalletStore.deductRestrictedBalance(
                        customerPhone,
                        body.patientName || 'Guest',
                        body.restrictedDeducted,
                        `Applied to booking for ${service?.name || body.serviceId}`,
                        'System (Online Booking)'
                    );

                    // Generate a record invoice for the wallet deduction
                    await BillingStore.createInvoice({
                        invoiceCategory: 'online_single', // or wallet_deduction if added
                        clientName: body.patientName || 'Guest',
                        clientPhone: customerPhone,
                        items: [{
                            description: `Service: ${service?.name || 'Session'} (Wallet Deduction)`,
                            quantity: 1,
                            unitPrice: body.restrictedDeducted,
                            total: body.restrictedDeducted,
                        }],
                        subtotal: body.restrictedDeducted,
                        taxPercentage: 0,
                        taxAmount: 0,
                        totalAmount: body.restrictedDeducted,
                        paymentMethod: 'online',
                        paymentConfirmed: true,
                        paymentReceptionStatus: 'received',
                        generatedBy: 'System (Wallet Deduction)',
                        date: new Date().toISOString().split('T')[0],
                        notes: `Restricted balance deducted for Booking ID: ${newBooking.id}.`
                    });
                } catch (err) {
                    console.error('Failed to deduct restricted balance:', err);
                    // Decide whether to fail the booking or continue. Continuing for now to avoid blocking booking.
                }
            }
        }

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
                        invoiceCategory: 'package_session',
                        clientName: body.patientName,
                        clientPhone: body.whatsappNumber || body.patientName, // Fallback
                        items: [{
                            description: `Package Redemption: ${activePkg?.packageName || 'Service'} - ${service?.name || 'Session'}`,
                            quantity: 1,
                            unitPrice: useRes.deductedValue || 0,
                            total: useRes.deductedValue || 0,
                        }],
                        packageDetails: activePkg?.packageName,
                        subtotal: useRes.deductedValue || 0,
                        taxPercentage: 0,
                        taxAmount: 0,
                        totalAmount: useRes.deductedValue || 0,
                        paymentMethod: 'online', // Or 'package' if enum allows
                        paymentConfirmed: true,
                        paymentReceptionStatus: 'received',
                        generatedBy: 'System (Online Booking)',
                        date: new Date().toISOString().split('T')[0],
                        notes: `Session deducted from package: ${activePkg?.packageName}. Booking ID: ${newBooking.id}. Payable by customer: 0 AED.`
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

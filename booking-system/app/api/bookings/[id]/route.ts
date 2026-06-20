export const dynamic = 'force-dynamic';
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

        // If the ID is a SimplyBook import ID and not yet in our database, we migrate it.
        if (id.startsWith('sb-') && !existingBooking) {
            const sbId = id.replace('sb-', '');
            const { SimplybookStore } = await import('@/lib/simplybook-store');
            const sbRecord = await SimplybookStore.getById(sbId);
            
            if (!sbRecord) {
                return NextResponse.json({ error: 'SimplyBook record not found' }, { status: 404 });
            }

            const newBooking = await BookingsStore.add({
                id: id, // Retain the sb- ID in our DB
                doctorId: body.doctorId || sbRecord.matchedDoctorId || 'sb-unmatched',
                clinicId: body.clinicId || sbRecord.matchedClinicId || 'simplybook-import',
                deptId: body.deptId || sbRecord.matchedDeptId || 'dept-unknown',
                serviceId: body.serviceId || 'srv-unknown',
                date: body.date || sbRecord.date,
                slot: body.slot || sbRecord.time,
                duration: body.duration || 30,
                status: body.status || 'booked',
                patientName: body.patientName || sbRecord.clientName || 'Unknown Patient',
                whatsappNumber: body.whatsappNumber || sbRecord.clientPhone || '',
                email: body.email || sbRecord.clientEmail || '',
                source: 'simplybook',
                sbId: sbId
            } as any);

            // We skip synchronous SimplybookStore.upsert here because writing to the 50MB Blob 
            // inside a Next.js API route blocks the response and causes a 504 Gateway Timeout.
            // The SimplyBook sync batch job will eventually catch up, and the UI already filters
            // out migrated bookings from the unmatched list via migratedSbIds.
            
            return NextResponse.json(newBooking);
        }

        if (!existingBooking) {
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }

        const oldStatus = existingBooking.status;
        const newStatus = body.status;
        const customerPhone = existingBooking.whatsappNumber || existingBooking.email || '';

        // --- DOCTOR OVERLAP & BUMPING LOGIC (only if time or doctor changes) ---
        const targetDoctorId = body.doctorId || existingBooking.doctorId;
        const targetDate = body.date || existingBooking.date;
        const targetSlot = body.slot || existingBooking.slot;
        const targetDuration = body.duration || existingBooking.duration || 30;
        
        if ((body.doctorId && body.doctorId !== existingBooking.doctorId) || 
            (body.date && body.date !== existingBooking.date) || 
            (body.slot && body.slot !== existingBooking.slot)) {
            
            const existingBookings = await BookingsStore.getAll();
            const newStart = slotToMinutes(targetSlot);
            const newEnd = newStart + targetDuration;

            const doctorOverlaps = existingBookings.filter(b => 
                b.id !== id && // Don't match self
                b.doctorId === targetDoctorId &&
                b.date === targetDate &&
                b.status !== 'cancelled' &&
                (() => {
                    const bStart = slotToMinutes(b.slot);
                    const bEnd = bStart + (b.duration || 30);
                    return newStart < bEnd && bStart < newEnd;
                })()
            );

            if (doctorOverlaps.length > 0) {
                const allCanBeBumped = doctorOverlaps.every(b => b.anyDoctor === true);
                if (!allCanBeBumped) {
                    return NextResponse.json(
                        { error: 'The selected doctor is already booked at this time.' },
                        { status: 409 }
                    );
                }

                // Bump them!
                const { DoctorsStore } = await import('@/lib/doctors-store');
                const clinics = await DoctorsStore.getClinics();
                const allDocs = clinics.flatMap(c => c.departments.map(d => ({ ...d, clinicId: c.id })).flatMap(d => d.doctors.map(doc => ({ ...doc, clinicId: d.clinicId, deptId: d.id }))));
                
                for (const overlappingBooking of doctorOverlaps) {
                    const sameClinicDocs = allDocs.filter(d => d.clinicId === overlappingBooking.clinicId && d.id !== targetDoctorId && d.id !== overlappingBooking.doctorId);
                    
                    let alternativeDoc = null;
                    for (const candidate of sameClinicDocs) {
                        const candidateOverlaps = existingBookings.some(b => 
                            b.id !== id && // ignore self
                            b.doctorId === candidate.id &&
                            b.date === overlappingBooking.date &&
                            b.status !== 'cancelled' &&
                            (() => {
                                const bStart = slotToMinutes(b.slot);
                                const bEnd = bStart + (b.duration || 30);
                                const oStart = slotToMinutes(overlappingBooking.slot);
                                const oEnd = oStart + (overlappingBooking.duration || 30);
                                return oStart < bEnd && bStart < oEnd;
                            })()
                        );
                        if (!candidateOverlaps) {
                            alternativeDoc = candidate;
                            break;
                        }
                    }

                    if (alternativeDoc) {
                        await BookingsStore.update(overlappingBooking.id, {
                            doctorId: alternativeDoc.id,
                            deptId: alternativeDoc.deptId,
                            staffName: 'System (Auto-Reassigned)'
                        });
                        overlappingBooking.doctorId = alternativeDoc.id;
                    } else {
                        return NextResponse.json(
                            { error: 'The selected doctor is booked, and no other doctors are available to take the floating Any Available appointments.' },
                            { status: 409 }
                        );
                    }
                }
            }
        }
        // --- END DOCTOR OVERLAP LOGIC ---

        // Append a flag to statusHistory indicating it was locally modified
        let history = existingBooking.statusHistory as any;
        if (typeof history === 'string') {
            try { history = JSON.parse(history); } catch { history = []; }
        }
        if (!Array.isArray(history)) history = [];
        history.push({ isLocalModified: true, timestamp: new Date().toISOString() });

        const updatedBooking = await BookingsStore.update(id, { ...body, statusHistory: history });
        if (!updatedBooking) {
            try {
                await (await import('@/lib/logs-store')).LogsStore.add({
                    userId: 'system',
                    userName: 'System API Error',
                    action: 'ERROR_BOOKING_UPDATE',
                    details: `BookingsStore.update returned null for id: ${id}`,
                    entityId: String(id),
                    entityType: 'Booking'
                });
            } catch (logErr) { /* ignore */ }
            return NextResponse.json({ error: 'Failed to update booking', details: `BookingsStore.update returned null for id: ${id}` }, { status: 500 });
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
    } catch (error: any) {
        console.error('Update failed:', error);
        try {
            await (await import('@/lib/logs-store')).LogsStore.add({
                userId: 'system',
                userName: 'System API Error',
                action: 'ERROR_BOOKING_UPDATE',
                details: error.message || String(error),
                entityId: String(id),
                entityType: 'Booking'
            });
        } catch (logErr) { /* ignore */ }
        return NextResponse.json({ error: 'Failed to update booking', details: error.message || String(error) }, { status: 500 });
    }
}

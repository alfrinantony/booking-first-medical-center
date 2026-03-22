import { NextResponse } from 'next/server';
import { BookingsStore } from '@/lib/bookings-store';
import { ServicesStore } from '@/lib/services-store';

export const dynamic = 'force-dynamic';

function findBestMatch(query: string, items: { id: string, name: string }[]): { id: string, name: string } | null {
    if (!query) return null;
    const q = query.toLowerCase().replace(/[^a-z0-9]/g, '');
    let bestMatch = null;
    let maxScore = 0;
    
    for (const item of items) {
        const iName = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        // Exact match
        if (iName === q) return item;
        // Contains
        if (iName.includes(q) || q.includes(iName)) {
            const score = Math.min(iName.length, q.length) / Math.max(iName.length, q.length);
            if (score > maxScore) {
                maxScore = score;
                bestMatch = item;
            }
        }
    }
    return bestMatch || items[0]; // fallback to first if absolutely needed, or null
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { tool, args, customerName, customerPhone, customerEmail, customerGender } = body;
        
        console.log('[CallCenter Tools] Executing:', tool, args);

        const allClinics = await ServicesStore.getClinics();
        const clinicsList = allClinics.map((c: any) => ({ id: c.id, name: c.name }));
        
        // Match clinic
        const clinicMatch = findBestMatch(args.branch || args.clinic || '', clinicsList);
        if (!clinicMatch && (tool === 'check_availability' || tool === 'create_booking')) {
            return NextResponse.json({ success: false, message: 'Could not identify the clinic branch. Please ask the user to clarify if they mean Muraqabat, Qiyadah, or Silicon Oasis.' });
        }
        
        const clinicData = allClinics.find((c: any) => c.id === clinicMatch?.id);
        
        // Extract all services and doctors for this clinic
        const servicesList: any[] = [];
        const doctorsList: any[] = [];
        let deptId = '';
        
        if (clinicData) {
            clinicData.departments.forEach((dept: any) => {
                dept.services.forEach((s: any) => servicesList.push({ id: s.id, name: s.name, deptId: dept.id, duration: s.duration }));
                dept.doctors.forEach((d: any) => doctorsList.push({ id: d.id, name: d.name, deptId: dept.id }));
            });
        }
        
        // Match service
        const serviceMatch: any = findBestMatch(args.service || '', servicesList);
        if (!serviceMatch && (tool === 'check_availability' || tool === 'create_booking')) {
            return NextResponse.json({ success: false, message: 'Could not identify the specified service. Please ask the user to clarify.' });
        }
        deptId = serviceMatch?.deptId;

        // Date normalization
        let dateStr = args.date;
        if (!dateStr || dateStr.toLowerCase() === 'today') {
            dateStr = new Date().toISOString().split('T')[0];
        } else if (dateStr.toLowerCase() === 'tomorrow') {
            const d = new Date();
            d.setDate(d.getDate() + 1);
            dateStr = d.toISOString().split('T')[0];
        }

        /* ──── CHECK AVAILABILITY ──── */
        if (tool === 'check_availability') {
            let docToSearch = doctorsList[0];
            if (args.doctor) {
                const docMatch = findBestMatch(args.doctor, doctorsList);
                if (docMatch) docToSearch = docMatch;
            }

            // Call schedule API internally equivalent logic
            const baseUrl = request.url.split('/api/')[0];
            const scheduleUrl = `${baseUrl}/api/admin/schedule?doctorId=${docToSearch.id}&date=${dateStr}&clinicId=${clinicMatch?.id}&serviceId=${serviceMatch?.id}`;
            
            try {
                const schedRes = await fetch(scheduleUrl);
                const schedData = await schedRes.json();
                
                if (schedData.unavailable) {
                    return NextResponse.json({ 
                        success: false, 
                        message: schedData.reason || `No slots available on ${dateStr} at ${clinicMatch?.name}.` 
                    });
                }
                
                let slots = schedData.slots || [];
                // If fuzzy time provided, we could filter, but let's just return all and let LLM pick
                if (slots.length === 0) {
                    return NextResponse.json({ success: true, message: `Fully booked on ${dateStr}. Please suggest another day.` });
                }

                // If they asked for Morning/Afternoon
                if (args.time) {
                    const t = args.time.toLowerCase();
                    if (t.includes('morning')) slots = slots.filter((s: string) => s.includes('AM'));
                    if (t.includes('afternoon') || t.includes('evening')) slots = slots.filter((s: string) => s.includes('PM'));
                }
                
                // Limit to 5 slots to prevent overwhelming the AI speech
                const suggestedSlots = slots.slice(0, 5);
                
                return NextResponse.json({
                    success: true,
                    available_slots: suggestedSlots,
                    message: `Found ${slots.length} slots. Suggested: ${suggestedSlots.join(', ')}. Doctor: ${docToSearch.name}.`
                });
            } catch (e) {
                return NextResponse.json({ success: false, message: 'Internal scheduling error.' });
            }
        }
        
        /* ──── CREATE BOOKING ──── */
        if (tool === 'create_booking') {
            if (!args.time) return NextResponse.json({ success: false, message: 'Time slot is missing.' });
            
            let docToSearch = doctorsList[0];
            if (args.doctor) {
                const docMatch = findBestMatch(args.doctor, doctorsList);
                if (docMatch) docToSearch = docMatch;
            }

            const newBooking = await BookingsStore.add({
                clinicId: clinicMatch!.id,
                deptId: deptId,
                doctorId: docToSearch.id,
                serviceId: serviceMatch!.id,
                date: dateStr,
                slot: args.time,
                duration: serviceMatch!.duration || 30,
                patientName: customerName || args.customerName || 'Walk-in (Voice)',
                whatsappNumber: customerPhone || args.customerPhone || '',
                email: customerEmail || '',
                status: 'booked',
                anyDoctor: !args.doctor
            });
            
            return NextResponse.json({
                success: true,
                message: `Booking confirmed successfully for ${serviceMatch?.name} at ${args.time} on ${dateStr}. Booking ID: ${newBooking.id}`
            });
        }

        return NextResponse.json({ success: false, message: 'Unknown tool' });
    } catch (err: any) {
        console.error('[CallCenter Tools Error]:', err);
        return NextResponse.json({ success: false, message: 'Server error processing tool: ' + err.message }, { status: 500 });
    }
}

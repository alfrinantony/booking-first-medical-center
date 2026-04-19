/**
 * Admin API: SimplyBook Bookings
 *
 * GET  /api/admin/simplybook                    – list bookings from blob (with filters)
 * GET  /api/admin/simplybook?sync=true&from=&to= – pull from SimplyBook → match doctors → save
 * GET  /api/admin/simplybook?stats=1&date=       – daily stats
 *
 * Doctor Matching Logic:
 *   During sync each SimplyBook booking's providerName is fuzzy-matched against all
 *   doctors in the app (across all clinics & departments).
 *   - MATCHED   → a Booking record is upserted in BookingsStore assigned to that doctor
 *   - UNMATCHED → stored in SimplybookStore only; shown for review on /admin/simplybook
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { SimplybookStore, SimplybookRecord } from '@/lib/simplybook-store';
import { BookingsStore } from '@/lib/bookings-store';
import { ServicesStore } from '@/lib/services-store';
import {
    getAdminBookings,
    getServiceList,
    getProviderList,
    getAdminClientList,
    SimplyBookAdminBooking,
} from '@/lib/simplybook-client';
import { Clinic, Doctor } from '@/lib/data';

// ── Normalise a name for fuzzy comparison ──
function normName(s: string): string {
    return s
        .toLowerCase()
        .replace(/^dr\.?\s*/i, '')     // strip "Dr." prefix
        .replace(/[^a-z0-9 ]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// ── Levenshtein distance ──
function levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    return dp[m][n];
}

interface DoctorEntry {
    doctorId: string;
    doctorName: string;
    normalised: string;
    clinicId: string;
    deptId: string;
    clinicName: string;
}

// ── Build a flat list of all doctors from all clinics ──
function buildDoctorIndex(clinics: Clinic[]): DoctorEntry[] {
    const entries: DoctorEntry[] = [];
    for (const clinic of clinics) {
        for (const dept of clinic.departments) {
            for (const doc of dept.doctors) {
                entries.push({
                    doctorId: doc.id,
                    doctorName: doc.name,
                    normalised: normName(doc.name),
                    clinicId: clinic.id,
                    deptId: dept.id,
                    clinicName: clinic.name,
                });
            }
        }
    }
    return entries;
}

// ── Match a SimplyBook provider name to a doctor ─────────────────────────────
// Returns the best match if score is good enough, otherwise null
function matchDoctor(providerName: string, index: DoctorEntry[]): DoctorEntry | null {
    const target = normName(providerName);
    if (!target) return null;

    let bestEntry: DoctorEntry | null = null;
    let bestScore = Infinity;

    for (const entry of index) {
        // Exact match wins immediately
        if (entry.normalised === target) return entry;

        // Substring match
        if (entry.normalised.includes(target) || target.includes(entry.normalised)) {
            const dist = levenshtein(entry.normalised, target);
            if (dist < bestScore) { bestScore = dist; bestEntry = entry; }
            continue;
        }

        // Levenshtein distance
        const dist = levenshtein(entry.normalised, target);
        if (dist < bestScore) { bestScore = dist; bestEntry = entry; }
    }

    // Accept if distance is ≤ 3 characters or within 30% of name length
    const threshold = Math.max(3, Math.floor(target.length * 0.3));
    return bestScore <= threshold ? bestEntry : null;
}

// ── Convert SimplyBook time "10:00" to app slot format "10:00 AM" ──
function toSlot(timeStr: string): string {
    const [hStr = '10', mStr = '00'] = timeStr.split(':');
    const h = parseInt(hStr, 10);
    const m = mStr;
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${String(displayH).padStart(2, '0')}:${m} ${period}`;
}

// ── Map SimplyBook status → Booking status ──
function toBookingStatus(sbStatus: string): 'booked' | 'confirmed' | 'cancelled' | 'no_show' {
    const s = sbStatus.toLowerCase();
    if (s.includes('cancel')) return 'cancelled';
    if (s.includes('no') && s.includes('show')) return 'no_show';
    if (s === 'confirmed') return 'confirmed';
    return 'booked';
}

// ── Map a SimplyBook admin booking to our stored record ──
function mapAdminBooking(
    b: SimplyBookAdminBooking,
    serviceMap: Map<string, string>,
    providerMap: Map<string, string>,
    clientMap: Map<string, { name: string; email: string; phone: string }>,
    matchResult: DoctorEntry | null
): SimplybookRecord {
    const startDT: string = b.start_date_time || '';
    const endDT: string = b.end_date_time || '';
    const [dateStr = '', timeStr = ''] = startDT.split(' ');

    const clientFromMap = clientMap.get(String(b.client_id || ''));
    const clientObj = b.client || {};
    const clientName =
        clientObj.name ||
        (clientObj.fname ? `${clientObj.fname} ${clientObj.lname || ''}`.trim() : '') ||
        clientFromMap?.name ||
        b.client_name ||
        (b.client_id ? `Client #${b.client_id}` : 'Unknown Client');
    const clientEmail = clientObj.email || clientFromMap?.email || b.client_email || '';
    const clientPhone = clientObj.phone || clientFromMap?.phone || b.client_phone || '';

    const serviceName =
        b.event_name ||
        serviceMap.get(String(b.event_id || '')) ||
        (b.event_id ? `Service #${b.event_id}` : 'Unknown Service');
    const providerName =
        b.unit_name ||
        providerMap.get(String(b.unit_id || '')) ||
        (b.unit_id ? `Provider #${b.unit_id}` : 'Unknown Provider');

    const rawStatus = String(b.status || '').toLowerCase();
    let status: SimplybookRecord['status'] = 'confirmed';
    if (rawStatus.includes('cancel')) status = 'cancelled';
    else if (rawStatus.includes('pending') || rawStatus.includes('new')) status = 'pending';
    else if (rawStatus.includes('no') && rawStatus.includes('show')) status = 'noshow';

    return {
        sbId: String(b.id),
        sbHash: String(b.booking_hash || ''),
        company: 'firstmedicalcenter',
        startDateTime: startDT,
        endDateTime: endDT,
        date: dateStr,
        time: timeStr.substring(0, 5),
        eventId: String(b.event_id),
        unitId: String(b.unit_id),
        serviceName,
        providerName,
        clientId: String(b.client_id || ''),
        clientName,
        clientEmail,
        clientPhone,
        status,
        notificationType: 'sync',
        matchStatus: matchResult ? 'matched' : 'unmatched',
        matchedDoctorId: matchResult?.doctorId,
        matchedClinicId: matchResult?.clinicId,
        matchedDeptId: matchResult?.deptId,
        receivedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        raw: b as Record<string, unknown>,
    };
}

export async function GET(request: NextRequest) {
    const sp = request.nextUrl.searchParams;

    // ── Stats mode ──
    if (sp.get('stats') === '1') {
        const date = sp.get('date') || new Date().toISOString().split('T')[0];
        const stats = await SimplybookStore.getStats(date);
        return NextResponse.json(stats);
    }

    // ── Sync mode ──
    if (sp.get('sync') === 'true') {
        const today = new Date().toISOString().split('T')[0];
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const dateFrom = sp.get('from') || sevenDaysAgo;
        const dateTo = sp.get('to') || today;

        try {
            // 1. Fetch SimplyBook data + app clinics in parallel
            const [sbBookings, services, providers, clients, clinics] = await Promise.all([
                getAdminBookings(dateFrom, dateTo),
                getServiceList(),
                getProviderList(),
                getAdminClientList(),
                ServicesStore.getClinics() as Promise<Clinic[]>,
            ]);

            // 2. Build lookup maps
            const serviceMap = new Map<string, string>(services.map(s => [String(s.id), s.name]));
            const providerMap = new Map<string, string>(providers.map(p => [String(p.id), p.name]));
            const clientMap = new Map<string, { name: string; email: string; phone: string }>(
                clients.map(c => {
                    const name = c.name || (c.fname ? `${c.fname} ${c.lname || ''}`.trim() : '');
                    return [String(c.id), { name, email: c.email || '', phone: c.phone || '' }];
                })
            );

            // 3. Build doctor index from all app clinics
            const doctorIndex = buildDoctorIndex(clinics);

            let synced = 0, matched = 0, unmatched = 0;

            for (const booking of sbBookings) {
                // Resolve provider name from map
                const rawProviderName =
                    booking.unit_name ||
                    providerMap.get(String(booking.unit_id || '')) ||
                    '';

                // Match doctor
                const matchResult = rawProviderName ? matchDoctor(rawProviderName, doctorIndex) : null;

                // Map to SimplybookRecord
                const record = mapAdminBooking(booking, serviceMap, providerMap, clientMap, matchResult);

                // 4a. If matched → upsert into BookingsStore
                if (matchResult && record.status !== 'cancelled' && record.status !== 'noshow') {
                    const slot = toSlot(record.time);
                    const bookingStatus = toBookingStatus(String(booking.status || ''));

                    // Find if this SB booking already has a linked booking record
                    const existing = await SimplybookStore.getById(record.sbId);
                    const existingBookingId = existing?.syncedToBookingsId;

                    let linkedId = existingBookingId;
                    if (existingBookingId) {
                        // Update existing booking
                        await BookingsStore.update(existingBookingId, {
                            status: bookingStatus,
                            date: record.date,
                            slot,
                            patientName: record.clientName,
                            email: record.clientEmail,
                            whatsappNumber: record.clientPhone,
                            serviceName: record.serviceName,
                        } as any);
                    } else {
                        // Create new booking
                        const newBooking = await BookingsStore.addSimplyBook({
                            clinicId: matchResult.clinicId,
                            deptId: matchResult.deptId,
                            doctorId: matchResult.doctorId,
                            serviceId: `sb-${record.eventId}`,
                            serviceName: record.serviceName,
                            date: record.date,
                            slot,
                            duration: 30,
                            patientName: record.clientName,
                            email: record.clientEmail,
                            whatsappNumber: record.clientPhone,
                            status: bookingStatus,
                            source: 'simplybook',
                            sbId: record.sbId,
                        });
                        linkedId = newBooking.id;
                    }

                    record.syncedToBookingsId = linkedId;
                    matched++;
                } else if (!matchResult) {
                    unmatched++;
                }

                await SimplybookStore.upsert(record);
                synced++;
            }

            return NextResponse.json({
                ok: true,
                synced,
                matched,
                unmatched,
                dateFrom,
                dateTo,
                syncedAt: new Date().toISOString(),
                lookups: {
                    services: services.length,
                    providers: providers.length,
                    clients: clients.length,
                    doctors: doctorIndex.length,
                },
            });
        } catch (err) {
            console.error('[SimplyBook sync] failed:', err);
            return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
        }
    }

    // ── List mode ──
    const dateFrom = sp.get('from');
    const dateTo = sp.get('to');
    const status = sp.get('status') || '';
    const search = (sp.get('search') || '').toLowerCase();
    const matchFilter = sp.get('match') || ''; // 'matched' | 'unmatched'

    let bookings = dateFrom && dateTo
        ? await SimplybookStore.getByDateRange(dateFrom, dateTo)
        : sp.get('date')
            ? await SimplybookStore.getByDate(sp.get('date')!)
            : await SimplybookStore.getAll();

    if (status) bookings = bookings.filter(b => b.status === status);
    if (matchFilter) bookings = bookings.filter(b => b.matchStatus === matchFilter);

    if (search) {
        bookings = bookings.filter(b =>
            b.clientName.toLowerCase().includes(search) ||
            b.clientEmail.toLowerCase().includes(search) ||
            b.clientPhone.includes(search) ||
            b.serviceName.toLowerCase().includes(search) ||
            b.providerName.toLowerCase().includes(search) ||
            b.sbId.includes(search)
        );
    }

    return NextResponse.json(bookings);
}

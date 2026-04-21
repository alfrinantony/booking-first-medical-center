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
    getInvoiceList,
    getInvoiceListDebug,
    SimplyBookAdminBooking,
} from '@/lib/simplybook-client';

import { Booking, Clinic } from '@/lib/data';



// Extend the SimplyBook booking type with fields returned by getBookings
// (SimplyBook getBookings returns client/event/unit as plain strings, not nested objects)
// Use Omit to remove conflicting fields from the parent type before redefining them.
type SBBooking = Omit<SimplyBookAdminBooking, 'client' | 'client_name' | 'event_name' | 'unit_name'> & {
    client:      string | { name?: string; fname?: string; lname?: string; email?: string; phone?: string };
    client_name?: string;
    event_name?:  string;
    unit_name?:   string;
    event?:       string;   // service name as plain string
    unit?:        string;   // provider name as plain string
    text?:        string;   // client name (duplicate field SimplyBook sends)
    start_date?:  string;   // alternative date field
    end_date?:    string;
    code?:        string;   // booking hash / short code
    location?:    string;
    event_category?: string;
};


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
    b: SBBooking,
    serviceMap: Map<string, string>,
    providerMap: Map<string, string>,
    clientMap: Map<string, { name: string; email: string; phone: string }>,
    matchResult: DoctorEntry | null
): SimplybookRecord {
    const startDT: string = b.start_date_time || b.start_date || '';
    const endDT: string   = b.end_date_time   || b.end_date   || '';
    const [dateStr = '', timeStr = ''] = startDT.split(' ');

    // SimplyBook getBookings returns client/event/unit as plain STRINGS
    // (not nested objects like the admin detail endpoint)
    const clientNameDirect =
        typeof b.client === 'string'
            ? b.client
            : b.client?.name ||
              (b.client?.fname ? `${b.client.fname} ${b.client.lname || ''}`.trim() : '');

    const clientFromMap = clientMap.get(String(b.client_id || ''));
    const clientName =
        clientNameDirect ||
        b.text ||                              // SimplyBook also sends name in "text" field
        clientFromMap?.name ||
        b.client_name ||
        (b.client_id ? `Client #${b.client_id}` : 'Unknown Client');

    const clientEmail =
        (typeof b.client !== 'string' ? b.client?.email : undefined) ||
        clientFromMap?.email || b.client_email || '';
    const clientPhone =
        (typeof b.client !== 'string' ? b.client?.phone : undefined) ||
        clientFromMap?.phone || b.client_phone || '';

    // getBookings returns event & unit as plain strings
    const serviceName =
        b.event || b.event_name ||
        serviceMap.get(String(b.event_id || '')) ||
        (b.event_id ? `Service #${b.event_id}` : 'Unknown Service');

    const providerName =
        b.unit || b.unit_name ||
        providerMap.get(String(b.unit_id || '')) ||
        (b.unit_id ? `Provider #${b.unit_id}` : 'Unknown Provider');

    const rawStatus = String(b.status || '').toLowerCase();
    let status: SimplybookRecord['status'] = 'confirmed';
    if (rawStatus.includes('cancel')) status = 'cancelled';
    else if (rawStatus.includes('pending') || rawStatus.includes('new')) status = 'pending';
    else if (rawStatus.includes('no') && rawStatus.includes('show')) status = 'noshow';

    return {
        sbId: String(b.id),
        sbHash: String(b.booking_hash || b.code || ''),
        company: 'firstmedicalcenter',
        startDateTime: startDT,
        endDateTime: endDT,
        date: dateStr,
        time: timeStr.substring(0, 5),
        eventId: String(b.event_id || ''),
        unitId: String(b.unit_id || ''),
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

// ── Helper: extract invoice fields trying all SimplyBook field name variants ──
function extractInvoiceFields(inv: Record<string, unknown>) {
    // Invoice number: SimplyBook uses "number", "code", "invoice_number", or "num" depending on plan/version
    const invoiceNumber =
        typeof inv.number === 'string'         ? inv.number :
        typeof inv.code === 'string'           ? inv.code :
        typeof inv.invoice_number === 'string' ? inv.invoice_number as string :
        typeof inv.num === 'string'            ? inv.num as string :
        undefined;

    // Payment processor: "payment_system" (most common), "payment_processor", "payment_method", or "processor"
    const paymentProcessor =
        typeof inv.payment_system === 'string'    ? inv.payment_system as string :
        typeof inv.payment_processor === 'string' ? inv.payment_processor as string :
        typeof inv.payment_method === 'string'    ? inv.payment_method as string :
        typeof inv.processor === 'string'         ? inv.processor as string :
        undefined;

    const invoiceId       = String(inv.id || '');
    const invoiceAmount   = typeof inv.amount === 'number' ? inv.amount : undefined;
    const paidAmount      = typeof inv.paid_amount === 'number' ? inv.paid_amount : undefined;
    const invoiceCurrency = typeof inv.currency === 'string' ? inv.currency : 'AED';
    const paymentType     = inv.type === 'online' ? 'online' as const : inv.type === 'offline' ? 'offline' as const : undefined;
    const paymentDate     = typeof inv.payment_datetime === 'string' ? inv.payment_datetime : undefined;

    const rawStatus = String(inv.status || '').toLowerCase();
    const paymentStatus =
        rawStatus === 'paid'    ? 'paid'    as const :
        rawStatus === 'partial' ? 'partial' as const :
        rawStatus === 'new'     ? 'new'     as const :
        rawStatus === 'pending' ? 'pending' as const :
        rawStatus               ? 'unpaid'  as const :
        undefined;

    return { invoiceId, invoiceNumber, invoiceAmount, paidAmount, invoiceCurrency,
             paymentStatus, paymentType, paymentProcessor, paymentDate };
}

export async function GET(request: NextRequest) {
    const sp = request.nextUrl.searchParams;

    // ── Stats mode ──
    if (sp.get('stats') === '1') {
        const date = sp.get('date') || new Date().toISOString().split('T')[0];
        const stats = await SimplybookStore.getStats(date);
        return NextResponse.json(stats);
    }

    // ── Debug invoices — tries invoice API + dumps raw booking fields ──
    // GET /api/admin/simplybook?debug_invoices=true&from=YYYY-MM-DD&to=YYYY-MM-DD
    if (sp.get('debug_invoices') === 'true') {
        const today = new Date().toISOString().split('T')[0];\n        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];\n        const dateFrom = sp.get('from') || weekAgo;
        const dateTo   = sp.get('to')   || today;
        try {
            // 1) Try all invoice API methods
            const attempts = await getInvoiceListDebug(dateFrom, dateTo);

            // 2) Also dump raw booking fields — payment info often embedded in bookings
            const rawBookings = await getAdminBookings(dateFrom, dateTo, 5, 0);
            const bookingSample = rawBookings.slice(0, 3).map((b: any) => {
                // Extract every key that might relate to payment/invoice
                const allKeys = Object.keys(b);
                const paymentKeys = allKeys.filter(k =>
                    /invoice|payment|paid|amount|price|total|transaction|stripe|card|finance/i.test(k)
                );
                return {
                    id: b.id,
                    all_keys: allKeys,
                    payment_related_keys: paymentKeys,
                    payment_values: Object.fromEntries(paymentKeys.map(k => [k, b[k]])),
                };
            });

            return NextResponse.json({
                dateFrom,
                dateTo,
                invoice_api_attempts: attempts,
                invoice_winner: attempts.find(a => a.status === 'ok') ?? null,
                booking_payment_fields: bookingSample,
            });
        } catch (err) {
            return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
        }
    }

    // ── Sync mode ──
    if (sp.get('sync') === 'true') {
        const today = new Date().toISOString().split('T')[0];
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        // Default to 7-day window to avoid Azure 504 timeouts
        const dateFrom = sp.get('from') || sevenDaysAgo;
        const dateTo   = sp.get('to')   || today;
        // Cap at 45-day window per request to prevent timeouts
        const fromDate = new Date(dateFrom);
        const toDate   = new Date(dateTo);
        const diffDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
        const effectiveTo = diffDays > 45
            ? new Date(fromDate.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            : dateTo;

        try {
            // Fetch SimplyBook data + app config in parallel
            const [sbBookings, services, providers, clinics, existingRecords] = await Promise.all([
                getAdminBookings(dateFrom, effectiveTo),
                getServiceList(),
                getProviderList(),
                ServicesStore.getClinics() as Promise<Clinic[]>,
                // Only load records for this date range (not ALL history)
                SimplybookStore.getByDateRange(dateFrom, effectiveTo),
            ]);

            console.log(`[SimplyBook sync] ${sbBookings.length} bookings from ${dateFrom} to ${effectiveTo}`);

            // Fetch invoices in parallel (one extra call, not N calls)
            const invoices = await getInvoiceList(dateFrom, effectiveTo);
            const invoiceMap = new Map<string, typeof invoices[0]>();
            for (const inv of invoices) {
                if (inv.booking_id) invoiceMap.set(String(inv.booking_id), inv);
            }
            console.log(`[SimplyBook sync] ${invoices.length} invoices fetched`);

            // Build lookup maps
            const serviceMap  = new Map<string, string>(services.map(s  => [String(s.id),  s.name]));
            const providerMap = new Map<string, string>(providers.map(p => [String(p.id),  p.name]));

            // Pre-index existing records by sbId (avoids N individual blob reads)
            const existingMap = new Map<string, SimplybookRecord>(
                existingRecords.map(r => [r.sbId, r])
            );

            // Build doctor index
            const doctorIndex = buildDoctorIndex(clinics);

            let synced = 0, matched = 0, unmatched = 0;
            const upsertBatch: SimplybookRecord[] = [];

            for (const booking of sbBookings as SBBooking[]) {
                const rawProviderName =
                    booking.unit || booking.unit_name ||
                    providerMap.get(String(booking.unit_id || '')) || '';

                const matchResult = rawProviderName ? matchDoctor(rawProviderName, doctorIndex) : null;

            // Build empty clientMap (we already have names directly from booking)
            const emptyClientMap = new Map<string, { name: string; email: string; phone: string }>();
                const record = mapAdminBooking(booking as SBBooking, serviceMap, providerMap, emptyClientMap, matchResult);

                // Carry over syncedToBookingsId from existing record if present
                const existing = existingMap.get(record.sbId);
                if (existing?.syncedToBookingsId) {
                    record.syncedToBookingsId = existing.syncedToBookingsId;
                }

                // Attach payment/invoice data using the multi-variant helper
                const inv = invoiceMap.get(record.sbId);
                if (inv) {
                    const f = extractInvoiceFields(inv as Record<string, unknown>);
                    record.invoiceId        = f.invoiceId;
                    record.invoiceNumber    = f.invoiceNumber;
                    record.invoiceAmount    = f.invoiceAmount;
                    record.paidAmount       = f.paidAmount;
                    record.invoiceCurrency  = f.invoiceCurrency;
                    record.paymentStatus    = f.paymentStatus;
                    record.paymentType      = f.paymentType;
                    record.paymentProcessor = f.paymentProcessor;
                    record.paymentDate      = f.paymentDate;
                } else {
                    // Fallback: try raw booking fields
                    const raw = booking as Record<string, unknown>;
                    if (raw.invoice_amount) record.invoiceAmount = typeof raw.invoice_amount === 'number' ? raw.invoice_amount : undefined;
                    if (raw.payment_status) record.paymentStatus = String(raw.payment_status) as typeof record.paymentStatus;
                    if (raw.invoice_currency) record.invoiceCurrency = String(raw.invoice_currency);
                }

                if (matchResult && record.status !== 'cancelled' && record.status !== 'noshow') {
                    matched++;
                } else if (!matchResult) {
                    unmatched++;
                }

                upsertBatch.push(record);
                synced++;
            }

            // Save ALL records in ONE blob write (upsertMany)
            await SimplybookStore.upsertMany(upsertBatch);

            return NextResponse.json({
                ok: true,
                synced,
                matched,
                unmatched,
                dateFrom,
                dateTo: effectiveTo,
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

    // ── Migrate mode — import ALL SB bookings into BookingsStore ──
    // GET /api/admin/simplybook?migrate=true&from=&to=
    // Option A: unmatched providers → clinicId='simplybook-import', doctorId='sb-unmatched'
    if (sp.get('migrate') === 'true') {
        const today = new Date().toISOString().split('T')[0];
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const dateFrom = sp.get('from') || sevenDaysAgo;
        const dateTo   = sp.get('to')   || today;
        // Cap at 45-day window
        const fromDate = new Date(dateFrom);
        const toDate   = new Date(dateTo);
        const diffDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
        const effectiveTo = diffDays > 45
            ? new Date(fromDate.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            : dateTo;

        try {
            const [sbBookings, services, providers, clinics, invoices] = await Promise.all([
                getAdminBookings(dateFrom, effectiveTo),
                getServiceList(),
                getProviderList(),
                ServicesStore.getClinics() as Promise<Clinic[]>,
                getInvoiceList(dateFrom, effectiveTo),
            ]);

            // Build invoice map: booking_id → invoice
            const invoiceMap = new Map<string, typeof invoices[0]>();
            for (const inv of invoices) {
                if (inv.booking_id) invoiceMap.set(String(inv.booking_id), inv);
            }
            console.log(`[SimplyBook migrate] ${sbBookings.length} bookings, ${invoices.length} invoices`);

            const serviceMap  = new Map<string, string>(services.map(s  => [String(s.id), s.name]));
            const providerMap = new Map<string, string>(providers.map(p => [String(p.id), p.name]));
            const doctorIndex = buildDoctorIndex(clinics);

            const batchForBookings: Array<Omit<Booking, 'id' | 'createdAt'> & { sbId?: string }> = [];
            const sbUpsertBatch: SimplybookRecord[] = [];
            let matchedCount = 0, unmatchedCount = 0;

            for (const booking of sbBookings as SBBooking[]) {
                const rawProviderName =
                    booking.unit || booking.unit_name ||
                    providerMap.get(String(booking.unit_id || '')) || '';

                const matchResult = rawProviderName ? matchDoctor(rawProviderName, doctorIndex) : null;

                const emptyClientMap = new Map<string, { name: string; email: string; phone: string }>();
                const sbRecord = mapAdminBooking(booking as SBBooking, serviceMap, providerMap, emptyClientMap, matchResult);
                sbUpsertBatch.push(sbRecord);

                // Extract billing info using multi-variant helper
                const raw = booking as Record<string, unknown>;
                const inv = invoiceMap.get(String((booking as any).id || ''));
                const f = inv ? extractInvoiceFields(inv as Record<string, unknown>) : null;
                const invoiceId        = f?.invoiceId ?? (raw.invoice_id ? String(raw.invoice_id) : undefined);
                const invoiceNumber    = f?.invoiceNumber;
                const invoiceAmount    = f?.invoiceAmount ?? (typeof raw.invoice_amount === 'number' ? raw.invoice_amount : undefined);
                const invoiceCurrency  = f?.invoiceCurrency ?? (typeof raw.invoice_currency === 'string' ? raw.invoice_currency : 'AED');
                const paidAmount       = f?.paidAmount;
                const paymentStatus    = f?.paymentStatus ?? (raw.payment_status ? String(raw.payment_status) as any : undefined);
                const paymentType      = f?.paymentType;
                const paymentProcessor = f?.paymentProcessor;
                const paymentDate      = f?.paymentDate;

                // Also enrich the SB record with payment info
                sbRecord.invoiceId        = invoiceId;
                sbRecord.invoiceNumber    = invoiceNumber;
                sbRecord.invoiceAmount    = invoiceAmount;
                sbRecord.paidAmount       = paidAmount;
                sbRecord.invoiceCurrency  = invoiceCurrency;
                sbRecord.paymentStatus    = paymentStatus;
                sbRecord.paymentType      = paymentType;
                sbRecord.paymentDate      = paymentDate;
                sbRecord.paymentProcessor = paymentProcessor;

                // Map SB status to Booking status
                const bookingStatus = toBookingStatus(String(booking.status || ''));

                // Resolve clinic/dept/doctor — use placeholder for unmatched
                const clinicId  = matchResult?.clinicId  ?? 'simplybook-import';
                const deptId    = matchResult?.deptId    ?? 'simplybook-import';
                const doctorId  = matchResult?.doctorId  ?? 'sb-unmatched';

                if (matchResult) matchedCount++; else unmatchedCount++;

                batchForBookings.push({
                    clinicId,
                    deptId,
                    doctorId,
                    serviceId:          `sb-${sbRecord.eventId}`,
                    serviceName:        sbRecord.serviceName,
                    date:               sbRecord.date,
                    slot:               toSlot(sbRecord.time),
                    duration:           30,
                    patientName:        sbRecord.clientName,
                    email:              sbRecord.clientEmail,
                    whatsappNumber:     sbRecord.clientPhone,
                    status:             bookingStatus,
                    source:             'simplybook',
                    sbId:               sbRecord.sbId,
                    sbHash:             sbRecord.sbHash,
                    sbProviderName:     rawProviderName || undefined,
                    sbServiceName:      sbRecord.serviceName,
                    sbInvoiceId:        invoiceId,
                    sbInvoiceNumber:    invoiceNumber,
                    sbInvoiceAmount:    invoiceAmount,
                    sbInvoiceCurrency:  invoiceCurrency,
                    sbPaymentStatus:    paymentStatus,
                    sbPaymentProcessor: paymentProcessor,
                    paymentMethod:      paymentType === 'online' ? 'online' : undefined,
                } as any);
            }

            // Save SB tracking records (one blob write)
            await SimplybookStore.upsertMany(sbUpsertBatch);

            // Import into BookingsStore (one blob write)
            const { added, skipped } = await BookingsStore.addSimplyBookBatch(batchForBookings as any);

            return NextResponse.json({
                ok: true,
                total: sbBookings.length,
                migrated: added,
                skipped,
                matched: matchedCount,
                unmatched: unmatchedCount,
                dateFrom,
                dateTo: effectiveTo,
                migratedAt: new Date().toISOString(),
            });
        } catch (err) {
            console.error('[SimplyBook migrate] failed:', err);
            return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
        }
    }

    // ── Refresh Payments mode — update payment status on existing migrated bookings ──
    // GET /api/admin/simplybook?refresh_payments=true&from=&to=
    if (sp.get('refresh_payments') === 'true') {
        const today = new Date().toISOString().split('T')[0];
        const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const dateFrom = sp.get('from') || thirtyAgo;
        const dateTo   = sp.get('to')   || today;
        try {
            const invoices = await getInvoiceList(dateFrom, dateTo);
            let updated = 0;

            for (const inv of invoices) {
                if (!inv.booking_id) continue;
                const bookingId = String(inv.booking_id);
                const f = extractInvoiceFields(inv as Record<string, unknown>);

                // Update SB store
                const sbRecord = await SimplybookStore.getById(bookingId);
                if (sbRecord) {
                    await SimplybookStore.upsert({
                        ...sbRecord,
                        invoiceId:        f.invoiceId,
                        invoiceNumber:    f.invoiceNumber    ?? sbRecord.invoiceNumber,
                        invoiceAmount:    f.invoiceAmount    ?? sbRecord.invoiceAmount,
                        paidAmount:       f.paidAmount       ?? sbRecord.paidAmount,
                        invoiceCurrency:  f.invoiceCurrency,
                        paymentStatus:    f.paymentStatus,
                        paymentType:      f.paymentType      ?? sbRecord.paymentType,
                        paymentProcessor: f.paymentProcessor ?? sbRecord.paymentProcessor,
                        paymentDate:      f.paymentDate      ?? sbRecord.paymentDate,
                    });
                }

                // Update BookingsStore via sbId
                const appBookings = await BookingsStore.getAll();
                const appBooking = appBookings.find((b: any) => b.sbId === bookingId);
                if (appBooking) {
                    await BookingsStore.update(appBooking.id, {
                        sbPaymentStatus:    f.paymentStatus,
                        sbInvoiceId:        f.invoiceId,
                        sbInvoiceNumber:    f.invoiceNumber,
                        sbInvoiceAmount:    f.invoiceAmount,
                        sbInvoiceCurrency:  f.invoiceCurrency,
                        sbPaymentProcessor: f.paymentProcessor,
                        paymentMethod:      f.paymentType === 'online' ? 'online' : undefined,
                    } as any);
                    updated++;
                }
            }

            return NextResponse.json({
                ok: true,
                invoicesFetched: invoices.length,
                bookingsUpdated: updated,
                dateFrom,
                dateTo,
                refreshedAt: new Date().toISOString(),
            });
        } catch (err) {
            console.error('[SimplyBook refresh_payments] failed:', err);
            return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
        }
    }

    // ── Enrich mode — re-fetch real names via public API for stored bookings ──
    // GET /api/admin/simplybook?enrich=true
    // Uses getBookingDetailsByHash (public API, no admin auth) to fill in real names.
    if (sp.get('enrich') === 'true') {
        try {
            const { getBookingDetailsByHash, getServiceList, getProviderList } = await import('@/lib/simplybook-client');

            // Load all stored bookings + public catalogues
            const [allBookings, services, providers] = await Promise.all([
                SimplybookStore.getAll(),
                getServiceList(),
                getProviderList(),
            ]);

            const serviceMap = new Map<string, string>(services.map(s => [String(s.id), s.name]));
            const providerMap = new Map<string, string>(providers.map(p => [String(p.id), p.name]));

            // Only process bookings that still have placeholder names
            const toEnrich = allBookings.filter(b =>
                !b.clientName ||
                b.clientName === 'Client' ||
                b.clientName.startsWith('Client #') ||
                b.providerName === 'Staff' ||
                b.providerName.startsWith('Provider #') ||
                b.serviceName.startsWith('Booking #') ||
                b.serviceName.startsWith('Service #')
            );

            console.log(`[SimplyBook enrich] ${toEnrich.length} bookings need enrichment out of ${allBookings.length}`);

            let enriched = 0, failed = 0;

            // Process in batches of 5 (avoid rate limiting)
            for (let i = 0; i < toEnrich.length; i += 5) {
                const batch = toEnrich.slice(i, i + 5);
                await Promise.all(batch.map(async (record) => {
                    if (!record.sbHash) { failed++; return; }
                    try {
                        const detail = await getBookingDetailsByHash(record.sbId, record.sbHash);
                        if (!detail) { failed++; return; }

                        const dc = (detail.client as Record<string, string>) || {};
                        const resolvedEventId = String(detail.event_id || record.eventId);
                        const resolvedUnitId  = String(detail.unit_id  || record.unitId);

                        const updatedRecord: SimplybookRecord = {
                            ...record,
                            eventId: resolvedEventId,
                            unitId:  resolvedUnitId,
                            startDateTime: String(detail.start_date_time || record.startDateTime),
                            endDateTime:   String(detail.end_date_time   || record.endDateTime),
                            serviceName:
                                (detail as Record<string, unknown>).event_name as string ||
                                serviceMap.get(resolvedEventId) ||
                                record.serviceName,
                            providerName:
                                (detail as Record<string, unknown>).unit_name as string ||
                                providerMap.get(resolvedUnitId) ||
                                record.providerName,
                            clientId:    String(detail.client_id || record.clientId),
                            clientName:  dc.name || (dc.fname ? `${dc.fname} ${dc.lname || ''}`.trim() : record.clientName),
                            clientEmail: dc.email || record.clientEmail,
                            clientPhone: dc.phone || record.clientPhone,
                            updatedAt:   new Date().toISOString(),
                        };

                        await SimplybookStore.upsert(updatedRecord);
                        enriched++;
                        console.log(`[enrich] ${record.sbId} → ${updatedRecord.clientName} / ${updatedRecord.serviceName} / ${updatedRecord.providerName}`);
                    } catch (e) {
                        failed++;
                        console.warn(`[enrich] Failed ${record.sbId}:`, e);
                    }
                }));

                // Small delay between batches to avoid rate limiting
                if (i + 5 < toEnrich.length) await new Promise(r => setTimeout(r, 300));
            }

            return NextResponse.json({
                ok: true,
                total: allBookings.length,
                needEnrichment: toEnrich.length,
                enriched,
                failed,
                enrichedAt: new Date().toISOString(),
            });
        } catch (err) {
            console.error('[SimplyBook enrich] failed:', err);
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

/**
 * SimplyBook.me API Client
 *
 * Auth strategy (best-effort cascade):
 *   1. getUserToken(company, login, userApiKey) → full admin access
 *   2. getToken(company, apiKey)               → public access only (fallback)
 *
 * Admin methods fall back to public equivalents when only a public token is available.
 */

// ── Endpoints ──
const JSONRPC_LOGIN  = 'https://user-api.simplybook.it/login';
const JSONRPC_PUBLIC = 'https://user-api.simplybook.it/';
const JSONRPC_ADMIN  = 'https://user-api.simplybook.it/admin/';

// ── Credentials ──
const COMPANY        = process.env.SIMPLYBOOK_COMPANY_LOGIN  || 'firstmedicalcenter';
const API_KEY        = process.env.SIMPLYBOOK_API_KEY        || '';
const ADMIN_LOGIN    = process.env.SIMPLYBOOK_ADMIN_LOGIN    || '';
const ADMIN_PASSWORD = process.env.SIMPLYBOOK_ADMIN_PASSWORD || '';

// ── Token caches ──
let adminToken: string | null = null;
let adminTokenExpiresAt = 0;
let adminIsFullAccess = false;   // true when obtained via getUserToken

let publicToken: string | null = null;
let publicTokenExpiresAt = 0;

// ── Core JSON-RPC helper ──
async function rpcCall(
    endpoint: string,
    method: string,
    params: unknown[],
    headers: Record<string, string> = {}
): Promise<unknown> {
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        cache: 'no-store',
    });
    if (!res.ok) throw new Error(`SimplyBook HTTP ${res.status}: ${await res.text()}`);
    const json = await res.json() as { result?: unknown; error?: { message: string; code: number } };
    if (json.error) throw new Error(`SimplyBook RPC [${json.error.code}]: ${json.error.message}`);
    return json.result;
}

// ── Public token (getToken) – no 2FA, no IP check ──
export async function getPublicToken(): Promise<string> {
    const now = Date.now();
    if (publicToken && now < publicTokenExpiresAt) return publicToken;
    publicToken = await rpcCall(JSONRPC_LOGIN, 'getToken', [COMPANY, API_KEY]) as string;
    publicTokenExpiresAt = now + 55 * 60 * 1000;
    return publicToken;
}

// ── Best available token ──
// Returns admin token if possible, public token as fallback.
// Sets adminIsFullAccess so callers know which endpoint to hit.
async function getBestToken(): Promise<string> {
    const now = Date.now();
    if (adminToken && now < adminTokenExpiresAt) return adminToken;

    // Try getUserToken with User API Key
    if (ADMIN_LOGIN && ADMIN_PASSWORD) {
        try {
            const token = await rpcCall(
                JSONRPC_LOGIN, 'getUserToken', [COMPANY, ADMIN_LOGIN, ADMIN_PASSWORD]
            ) as string;
            adminToken = token;
            adminTokenExpiresAt = now + 55 * 60 * 1000;
            adminIsFullAccess = true;
            console.log('[SimplyBook] ✅ Admin token via getUserToken');
            return adminToken;
        } catch (err) {
            console.warn('[SimplyBook] ⚠️ getUserToken failed:', String(err).substring(0, 150));
        }
    }

    // Fallback: public token
    const token = await getPublicToken();
    adminToken = token;
    adminTokenExpiresAt = publicTokenExpiresAt;
    adminIsFullAccess = false;
    console.warn('[SimplyBook] ⚠️ Using public token as fallback — admin methods limited');
    return adminToken;
}

// ── Authenticated call to ADMIN endpoint (falls back to public) ──
export async function callAdmin(method: string, params: unknown[] = []): Promise<unknown> {
    const token = await getBestToken();
    const endpoint = adminIsFullAccess ? JSONRPC_ADMIN : JSONRPC_PUBLIC;
    try {
        return await rpcCall(endpoint, method, params, {
            'X-Company-Login': COMPANY,
            'X-User-Token': token,
        });
    } catch (err) {
        if (adminIsFullAccess) {
            // Admin call failed — try public fallback
            console.warn(`[SimplyBook] Admin ${method} failed, trying public`);
            const pubToken = await getPublicToken();
            return await rpcCall(JSONRPC_PUBLIC, method, params, {
                'X-Company-Login': COMPANY,
                'X-User-Token': pubToken,
            });
        }
        throw err;
    }
}

// ── Authenticated call to PUBLIC endpoint ──
export async function callPublic(method: string, params: unknown[] = []): Promise<unknown> {
    const token = await getPublicToken();
    return rpcCall(JSONRPC_PUBLIC, method, params, {
        'X-Company-Login': COMPANY,
        'X-User-Token': token,
    });
}

// KEPT for backward compat
export async function getAdminToken(): Promise<string> {
    return getBestToken();
}

// ── Typed interfaces ──
export interface SimplyBookAdminBooking {
    id: string | number;
    start_date_time: string;
    end_date_time: string;
    event_id?: string | number;
    event_name?: string;
    unit_id?: string | number;
    unit_name?: string;
    client_id?: string | number;
    client?: {
        name?: string;
        fname?: string;
        lname?: string;
        email?: string;
        phone?: string;
        id?: string | number;
    };
    client_name?: string;
    client_email?: string;
    client_phone?: string;
    status?: string;
    booking_hash?: string;
    record_date?: string;
    [key: string]: unknown;
}

export interface SimplyBookBookingDetail {
    id: string | number;
    record_date?: string;
    start_date_time: string;
    end_date_time: string;
    event_id: string | number;
    unit_id: string | number;
    client_id?: string | number;
    client?: Record<string, string>;
    status?: string;
    booking_hash?: string;
    [key: string]: unknown;
}

export interface SimplyBookClient {
    id: string | number;
    name?: string;
    fname?: string;
    lname?: string;
    email?: string;
    phone?: string;
    [key: string]: unknown;
}

export interface SimplyBookEvent {
    id: string | number;
    name: string;
    duration: number;
    price?: string | number;
}

export interface SimplyBookUnit {
    id: string | number;
    name: string;
}

export interface SimplyBookInvoice {
    id: string | number;          // invoice numeric ID
    number?: string;              // formatted invoice number, e.g. "SI-2026000362"
    booking_id?: string | number; // linked booking ID
    amount?: number;              // total invoice amount
    paid_amount?: number;         // how much was paid
    rest?: number;                // outstanding balance
    status?: string;              // "new", "pending", "paid", "unpaid", "partial"
    type?: string;                // "online", "offline"
    currency?: string;            // e.g. "AED"
    payment_processor?: string;   // e.g. "Stripe", "PayPal", "manual"
    payment_method?: string;      // alias field some SB versions return
    payment_datetime?: string;    // when payment was made
    [key: string]: unknown;
}

// ── Admin: fetch bookings by date range ──
export async function getAdminBookings(
    dateFrom: string,
    dateTo: string,
    limit = 500,
    skip = 0
): Promise<SimplyBookAdminBooking[]> {
    // SimplyBook API may behave differently for future vs past bookings.
    // Try multiple filter formats to maximise coverage.
    const filtersToTry = [
        { date_from: dateFrom, date_to: dateTo },               // basic
        { date_from: dateFrom, date_to: dateTo, status: 'all' }, // explicit all statuses
        { date_from: dateFrom, date_to: dateTo, upcoming: true },// upcoming flag
    ];

    for (const filter of filtersToTry) {
        try {
            const result = await callAdmin('getBookings', [filter, limit, skip]);
            let arr: SimplyBookAdminBooking[] = [];
            if (Array.isArray(result)) arr = result as SimplyBookAdminBooking[];
            else if (result && typeof result === 'object') arr = Object.values(result) as SimplyBookAdminBooking[];
            if (arr.length > 0) {
                console.log(`[SimplyBook] getAdminBookings (${JSON.stringify(filter)}) → ${arr.length} records`);
                return arr;
            }
        } catch (err) {
            console.warn(`[SimplyBook] getBookings filter ${JSON.stringify(filter)} failed:`, String(err).substring(0, 120));
        }
    }
    console.warn('[SimplyBook] getAdminBookings: all filter attempts returned 0 results');
    return [];
}

// ── Admin: single booking ──
export async function getAdminBooking(bookingId: string | number): Promise<SimplyBookAdminBooking | null> {
    try {
        const result = await callAdmin('getBooking', [bookingId]);
        return result as SimplyBookAdminBooking | null;
    } catch (err) {
        console.error(`[SimplyBook] getBooking(${bookingId}) failed:`, err);
        return null;
    }
}

// ── Admin: client list ──
export async function getAdminClientList(): Promise<SimplyBookClient[]> {
    try {
        const result = await callAdmin('getClientList', [{}]) as unknown;
        if (Array.isArray(result)) return result as SimplyBookClient[];
        if (result && typeof result === 'object') return Object.values(result) as SimplyBookClient[];
        return [];
    } catch (err) {
        console.error('[SimplyBook] getClientList failed:', err);
        return [];
    }
}

// ── Public: booking detail by hash (for webhooks) ──
export async function getBookingDetailsByHash(
    bookingId: string,
    bookingHash: string
): Promise<SimplyBookBookingDetail | null> {
    try {
        return await callPublic('getBookingDetails', [bookingId, bookingHash]) as SimplyBookBookingDetail;
    } catch (err) {
        console.error('[SimplyBook] getBookingDetails failed:', err);
        return null;
    }
}

// ── Service list ──
export async function getServiceList(): Promise<SimplyBookEvent[]> {
    try {
        const result = await callAdmin('getEventList', []) as unknown;
        if (Array.isArray(result)) return result as SimplyBookEvent[];
        if (result && typeof result === 'object') return Object.values(result) as SimplyBookEvent[];
        return [];
    } catch {
        try {
            const result = await callPublic('getEventList', [false, true]) as unknown;
            if (Array.isArray(result)) return result as SimplyBookEvent[];
            if (result && typeof result === 'object') return Object.values(result) as SimplyBookEvent[];
            return [];
        } catch (err) {
            console.error('[SimplyBook] getEventList failed:', err);
            return [];
        }
    }
}

// ── Provider list ──
export async function getProviderList(): Promise<SimplyBookUnit[]> {
    try {
        const result = await callAdmin('getUnitList', []) as unknown;
        if (Array.isArray(result)) return result as SimplyBookUnit[];
        if (result && typeof result === 'object') return Object.values(result) as SimplyBookUnit[];
        return [];
    } catch {
        try {
            const result = await callPublic('getUnitList', [false, true]) as unknown;
            if (Array.isArray(result)) return result as SimplyBookUnit[];
            if (result && typeof result === 'object') return Object.values(result) as SimplyBookUnit[];
            return [];
        } catch (err) {
            console.error('[SimplyBook] getUnitList failed:', err);
            return [];
        }
    }
}
// ── Invoice list (payment data per booking) ──
export async function getInvoiceList(
    dateFrom: string,
    dateTo: string
): Promise<SimplyBookInvoice[]> {
    // SimplyBook uses different method names and filter formats depending on plan/plugin version.
    // Try each combination until one returns data.
    const attempts: Array<{ method: string; params: unknown[] }> = [
        // Most common: Invoice plugin with status filter
        { method: 'getInvoiceList',        params: [{ date_from: dateFrom, date_to: dateTo, status: 'all' }, 1000, 0] },
        // Without status (some versions don't support 'all')
        { method: 'getInvoiceList',        params: [{ date_from: dateFrom, date_to: dateTo }, 1000, 0] },
        // Alternate method name seen in some SB accounts
        { method: 'getBookingInvoices',    params: [{ date_from: dateFrom, date_to: dateTo }, 1000, 0] },
        // Payment-based report
        { method: 'getPaymentList',        params: [{ date_from: dateFrom, date_to: dateTo }, 1000, 0] },
        // No filter — just count (diagnostic)
        { method: 'getInvoiceList',        params: [{}, 100, 0] },
    ];

    for (const attempt of attempts) {
        try {
            console.log(`[SimplyBook] Trying ${attempt.method} with params:`, JSON.stringify(attempt.params));
            const result = await callAdmin(attempt.method, attempt.params);
            if (Array.isArray(result) && result.length > 0) {
                console.log(`[SimplyBook] ✅ ${attempt.method} returned ${result.length} invoices`);
                return result as SimplyBookInvoice[];
            }
            if (result && typeof result === 'object' && !Array.isArray(result)) {
                const vals = Object.values(result);
                if (vals.length > 0) {
                    console.log(`[SimplyBook] ✅ ${attempt.method} returned ${vals.length} invoices (object form)`);
                    return vals as SimplyBookInvoice[];
                }
            }
            console.log(`[SimplyBook] ${attempt.method} returned empty`);
        } catch (err) {
            console.warn(`[SimplyBook] ${attempt.method} failed:`, String(err).substring(0, 200));
        }
    }

    console.warn('[SimplyBook] All invoice methods returned empty — invoice plugin may not be enabled or no invoices in range');
    return [];
}

// ── Verbose invoice debug (used by debug_invoices endpoint) ──
export async function getInvoiceListDebug(
    dateFrom: string,
    dateTo: string
): Promise<{ method: string; params: unknown; status: 'ok' | 'empty' | 'error'; count: number; sample: unknown[]; error?: string }[]> {
    const attempts: Array<{ method: string; params: unknown[] }> = [
        { method: 'getInvoiceList',     params: [{ date_from: dateFrom, date_to: dateTo, status: 'all' }, 100, 0] },
        { method: 'getInvoiceList',     params: [{ date_from: dateFrom, date_to: dateTo }, 100, 0] },
        { method: 'getInvoiceList',     params: [{}, 10, 0] },
        { method: 'getBookingInvoices', params: [{ date_from: dateFrom, date_to: dateTo }, 100, 0] },
        { method: 'getPaymentList',     params: [{ date_from: dateFrom, date_to: dateTo }, 100, 0] },
    ];

    const results = [];
    for (const attempt of attempts) {
        try {
            const result = await callAdmin(attempt.method, attempt.params);
            const arr: unknown[] = Array.isArray(result) ? result
                : (result && typeof result === 'object') ? Object.values(result) : [];
            results.push({
                method: attempt.method,
                params: attempt.params,
                status: arr.length > 0 ? 'ok' : 'empty',
                count: arr.length,
                sample: arr.slice(0, 2),
            });
        } catch (err) {
            results.push({
                method: attempt.method,
                params: attempt.params,
                status: 'error',
                count: 0,
                sample: [],
                error: String(err).substring(0, 300),
            });
        }
    }
    return results as any;
}

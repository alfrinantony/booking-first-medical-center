/**
 * SimplyBook.me API Client
 *
 * Public JSON-RPC:  https://user-api.simplybook.it/
 * Admin JSON-RPC:   https://user-api.simplybook.it/admin/
 *
 * Auth:
 *   Public → getToken(company, apiKey)
 *   Admin  → getUserToken(company, login, password)  [requires HIPAA to be OFF]
 */

// ── Endpoints ──
const LOGIN_ENDPOINT  = 'https://user-api.simplybook.it/login';
const PUBLIC_ENDPOINT = 'https://user-api.simplybook.it/';
const ADMIN_ENDPOINT  = 'https://user-api.simplybook.it/admin/';

// ── Credentials ──
const COMPANY        = process.env.SIMPLYBOOK_COMPANY_LOGIN  || 'firstmedicalcenter';
const API_KEY        = process.env.SIMPLYBOOK_API_KEY        || '';
const ADMIN_LOGIN    = process.env.SIMPLYBOOK_ADMIN_LOGIN    || '';
const ADMIN_PASSWORD = process.env.SIMPLYBOOK_ADMIN_PASSWORD || '';

// ── Token cache ──
let publicToken: string | null = null;
let publicTokenExpiresAt = 0;

let adminToken: string | null = null;
let adminTokenExpiresAt = 0;

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

// ── Public token ──
export async function getPublicToken(): Promise<string> {
    const now = Date.now();
    if (publicToken && now < publicTokenExpiresAt) return publicToken;
    publicToken = await rpcCall(LOGIN_ENDPOINT, 'getToken', [COMPANY, API_KEY]) as string;
    publicTokenExpiresAt = now + 55 * 60 * 1000;
    return publicToken;
}

// ── Admin token (getUserToken — requires HIPAA off) ──
export async function getAdminToken(): Promise<string> {
    const now = Date.now();
    if (adminToken && now < adminTokenExpiresAt) return adminToken;
    adminToken = await rpcCall(LOGIN_ENDPOINT, 'getUserToken', [COMPANY, ADMIN_LOGIN, ADMIN_PASSWORD]) as string;
    adminTokenExpiresAt = now + 55 * 60 * 1000;
    return adminToken;
}

// ── Authenticated callers ──
export async function callPublic(method: string, params: unknown[] = []): Promise<unknown> {
    const token = await getPublicToken();
    return rpcCall(PUBLIC_ENDPOINT, method, params, {
        'X-Company-Login': COMPANY,
        'X-User-Token': token,
    });
}

export async function callAdmin(method: string, params: unknown[] = []): Promise<unknown> {
    const token = await getAdminToken();
    return rpcCall(ADMIN_ENDPOINT, method, params, {
        'X-Company-Login': COMPANY,
        'X-User-Token': token,
    });
}

// ── Typed interfaces ──
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
        email?: string;
        phone?: string;
        id?: string | number;
    };
    client_name?: string;
    client_email?: string;
    client_phone?: string;
    status?: string;        // "confirmed", "canceled", "pending", etc.
    booking_hash?: string;
    record_date?: string;
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

// ── Admin: fetch bookings by date range ──
export async function getAdminBookings(
    dateFrom: string,   // "YYYY-MM-DD"
    dateTo: string,
    limit = 200,
    skip = 0
): Promise<SimplyBookAdminBooking[]> {
    const filter = { date_from: dateFrom, date_to: dateTo };
    const result = await callAdmin('getBookings', [filter, limit, skip]);
    if (Array.isArray(result)) return result as SimplyBookAdminBooking[];
    if (result && typeof result === 'object') return Object.values(result) as SimplyBookAdminBooking[];
    return [];
}

// ── Public: single booking by hash (for webhook) ──
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

// ── Service & Provider lists (public) ──
export async function getServiceList(): Promise<SimplyBookEvent[]> {
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

export async function getProviderList(): Promise<SimplyBookUnit[]> {
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

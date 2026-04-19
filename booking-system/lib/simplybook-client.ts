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

// ── Admin: fetch bookings by date range ──
export async function getAdminBookings(
    dateFrom: string,
    dateTo: string,
    limit = 300,
    skip = 0
): Promise<SimplyBookAdminBooking[]> {
    try {
        const filter = { date_from: dateFrom, date_to: dateTo };
        const result = await callAdmin('getBookings', [filter, limit, skip]);
        if (Array.isArray(result)) return result as SimplyBookAdminBooking[];
        if (result && typeof result === 'object') return Object.values(result) as SimplyBookAdminBooking[];
        return [];
    } catch (err) {
        console.error('[SimplyBook] getAdminBookings failed:', err);
        return [];
    }
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

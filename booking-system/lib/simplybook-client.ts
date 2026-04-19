/**
 * SimplyBook.me API Client
 *
 * Auth strategy:
 *   We use getToken(company, apiKey) — NOT getUserToken — because getUserToken
 *   is blocked when the Google Authenticator plugin is active on the account.
 *   getToken works with the API key alone and grants access to both public
 *   and admin API methods without triggering the 2FA restriction.
 *
 * Endpoints:
 *   Login:  https://user-api.simplybook.it/login
 *   Public: https://user-api.simplybook.it/
 *   Admin:  https://user-api.simplybook.it/admin/
 */

// ── Endpoints ──
const LOGIN_ENDPOINT  = 'https://user-api.simplybook.it/login';
const PUBLIC_ENDPOINT = 'https://user-api.simplybook.it/';
const ADMIN_ENDPOINT  = 'https://user-api.simplybook.it/admin/';

// ── Credentials ──
const COMPANY = process.env.SIMPLYBOOK_COMPANY_LOGIN || 'firstmedicalcenter';
const API_KEY = process.env.SIMPLYBOOK_API_KEY       || '';

// ── Token cache (single token used for both public & admin calls) ──
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

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

// ── Get API token via getToken(company, apiKey) — no 2FA required ──
export async function getApiToken(): Promise<string> {
    const now = Date.now();
    if (cachedToken && now < tokenExpiresAt) return cachedToken;
    cachedToken = await rpcCall(LOGIN_ENDPOINT, 'getToken', [COMPANY, API_KEY]) as string;
    tokenExpiresAt = now + 55 * 60 * 1000; // 55-minute cache
    return cachedToken;
}

// ── Keep backward-compat exports ──
export const getPublicToken = getApiToken;
export const getAdminToken  = getApiToken;

// ── Authenticated call to PUBLIC endpoint ──
export async function callPublic(method: string, params: unknown[] = []): Promise<unknown> {
    const token = await getApiToken();
    return rpcCall(PUBLIC_ENDPOINT, method, params, {
        'X-Company-Login': COMPANY,
        'X-User-Token':    token,
    });
}

// ── Authenticated call to ADMIN endpoint ──
export async function callAdmin(method: string, params: unknown[] = []): Promise<unknown> {
    const token = await getApiToken();
    return rpcCall(ADMIN_ENDPOINT, method, params, {
        'X-Company-Login': COMPANY,
        'X-User-Token':    token,
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
    const filter = { date_from: dateFrom, date_to: dateTo };
    const result = await callAdmin('getBookings', [filter, limit, skip]);
    if (Array.isArray(result)) return result as SimplyBookAdminBooking[];
    if (result && typeof result === 'object') return Object.values(result) as SimplyBookAdminBooking[];
    return [];
}

// ── Admin: fetch a single booking with full details ──
export async function getAdminBooking(
    bookingId: string | number
): Promise<SimplyBookAdminBooking | null> {
    try {
        const result = await callAdmin('getBooking', [bookingId]);
        return result as SimplyBookAdminBooking | null;
    } catch (err) {
        console.error(`[SimplyBook] getBooking(${bookingId}) failed:`, err);
        return null;
    }
}

// ── Admin: fetch all clients ──
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

// ── Service & Provider lists ──
export async function getServiceList(): Promise<SimplyBookEvent[]> {
    try {
        // Try admin first (returns all services), fall back to public
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

export async function getProviderList(): Promise<SimplyBookUnit[]> {
    try {
        // Try admin first (returns all providers), fall back to public
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

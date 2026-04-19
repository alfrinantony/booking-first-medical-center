/**
 * SimplyBook.me API Client
 *
 * Auth strategy:
 *   Admin calls use getUserToken(company, login, userApiKey) where the "password"
 *   is the User API Key generated in SimplyBook → Account Info → User Api Keys.
 *   User API Keys bypass the Google Authenticator 2FA restriction and email
 *   verification, while still granting full admin API access.
 *
 *   Public calls use getToken(company, apiKey) for catalogue/booking widget methods.
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
const COMPANY        = process.env.SIMPLYBOOK_COMPANY_LOGIN  || 'firstmedicalcenter';
const API_KEY        = process.env.SIMPLYBOOK_API_KEY        || '';
const ADMIN_LOGIN    = process.env.SIMPLYBOOK_ADMIN_LOGIN    || '';
const ADMIN_PASSWORD = process.env.SIMPLYBOOK_ADMIN_PASSWORD || ''; // Use User API Key here

// ── Token caches ──
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

// ── Public token via getToken(company, apiKey) ──
export async function getPublicToken(): Promise<string> {
    const now = Date.now();
    if (publicToken && now < publicTokenExpiresAt) return publicToken;
    publicToken = await rpcCall(LOGIN_ENDPOINT, 'getToken', [COMPANY, API_KEY]) as string;
    publicTokenExpiresAt = now + 55 * 60 * 1000;
    return publicToken;
}

// ── Admin token via getUserToken(company, login, userApiKey) ──
// Uses User API Key as "password" — bypasses Google Authenticator 2FA
export async function getAdminToken(): Promise<string> {
    const now = Date.now();
    if (adminToken && now < adminTokenExpiresAt) return adminToken;
    adminToken = await rpcCall(LOGIN_ENDPOINT, 'getUserToken', [COMPANY, ADMIN_LOGIN, ADMIN_PASSWORD]) as string;
    adminTokenExpiresAt = now + 55 * 60 * 1000;
    return adminToken;
}

// ── Authenticated call to PUBLIC endpoint ──
export async function callPublic(method: string, params: unknown[] = []): Promise<unknown> {
    const token = await getPublicToken();
    return rpcCall(PUBLIC_ENDPOINT, method, params, {
        'X-Company-Login': COMPANY,
        'X-User-Token':    token,
    });
}

// ── Authenticated call to ADMIN endpoint ──
export async function callAdmin(method: string, params: unknown[] = []): Promise<unknown> {
    const token = await getAdminToken();
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

// ── Service list (try admin first for all services, fallback to public) ──
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

// ── Provider list (try admin first, fallback to public) ──
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

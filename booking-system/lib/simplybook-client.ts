/**
 * SimplyBook.me API Client
 *
 * Public JSON-RPC:  https://user-api.simplybook.it/
 * Admin REST API v2: https://user-api-v2.simplybook.it/admin/
 *
 * Note: HIPAA plugin blocks JSON-RPC getUserToken.
 *       We use the REST v2 API for all admin operations instead.
 */

// ── Endpoints ──
const LOGIN_ENDPOINT   = 'https://user-api.simplybook.it/login';
const PUBLIC_ENDPOINT  = 'https://user-api.simplybook.it/';
const REST_ADMIN_BASE  = 'https://user-api-v2.simplybook.it/admin';

// ── Credentials ──
const COMPANY        = process.env.SIMPLYBOOK_COMPANY_LOGIN   || 'firstmedicalcenter';
const API_KEY        = process.env.SIMPLYBOOK_API_KEY         || '';
const ADMIN_LOGIN    = process.env.SIMPLYBOOK_ADMIN_LOGIN     || '';
const ADMIN_PASSWORD = process.env.SIMPLYBOOK_ADMIN_PASSWORD  || '';

// ── Token cache ──
let publicToken: string | null = null;
let publicTokenExpiresAt = 0;

let adminRestToken: string | null = null;
let adminRestRefreshToken: string | null = null;
let adminRestTokenExpiresAt = 0;

// ── JSON-RPC helper (public API only) ──
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

// ── Public token (JSON-RPC with API key) ──
export async function getPublicToken(): Promise<string> {
    const now = Date.now();
    if (publicToken && now < publicTokenExpiresAt) return publicToken;
    publicToken = await rpcCall(LOGIN_ENDPOINT, 'getToken', [COMPANY, API_KEY]) as string;
    publicTokenExpiresAt = now + 55 * 60 * 1000;
    return publicToken;
}

// ── Admin REST token (POST /admin/auth — bypasses HIPAA restriction) ──
async function refreshAdminRestToken(): Promise<void> {
    const res = await fetch(`${REST_ADMIN_BASE}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            company: COMPANY,
            login:   ADMIN_LOGIN,
            password: ADMIN_PASSWORD,
        }),
        cache: 'no-store',
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`SimplyBook REST auth failed ${res.status}: ${text}`);
    }

    const data = await res.json() as { token?: string; refresh_token?: string };
    if (!data.token) throw new Error('SimplyBook REST auth: no token in response');

    adminRestToken = data.token;
    adminRestRefreshToken = data.refresh_token || null;
    adminRestTokenExpiresAt = Date.now() + 55 * 60 * 1000;
}

export async function getAdminRestToken(): Promise<string> {
    const now = Date.now();
    if (adminRestToken && now < adminRestTokenExpiresAt) return adminRestToken;
    await refreshAdminRestToken();
    return adminRestToken!;
}

// ── REST Admin API helper ──
async function restAdminGet(path: string, params: Record<string, string> = {}): Promise<unknown> {
    const token = await getAdminRestToken();
    const url = new URL(`${REST_ADMIN_BASE}${path}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString(), {
        headers: {
            'X-Company-Login': COMPANY,
            'X-User-Token':    token,
            'Content-Type':    'application/json',
        },
        cache: 'no-store',
    });

    if (!res.ok) {
        // Token might be expired — retry once
        if (res.status === 401) {
            adminRestToken = null;
            await refreshAdminRestToken();
            const retry = await fetch(url.toString(), {
                headers: { 'X-Company-Login': COMPANY, 'X-User-Token': adminRestToken!, 'Content-Type': 'application/json' },
                cache: 'no-store',
            });
            if (!retry.ok) throw new Error(`SimplyBook REST ${retry.status}: ${await retry.text()}`);
            return await retry.json();
        }
        throw new Error(`SimplyBook REST ${res.status}: ${await res.text()}`);
    }

    return await res.json();
}

// ── Public JSON-RPC caller ──
export async function callPublic(method: string, params: unknown[] = []): Promise<unknown> {
    const token = await getPublicToken();
    return rpcCall(PUBLIC_ENDPOINT, method, params, {
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
    status?: string;
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

// ── Admin REST: fetch bookings by date range ──
export async function getAdminBookings(
    dateFrom: string,  // "YYYY-MM-DD"
    dateTo: string,
    limit = 200,
    skip = 0
): Promise<SimplyBookAdminBooking[]> {
    // REST v2 uses query params like filter[date_from]
    const params: Record<string, string> = {
        'filter[date_from]': dateFrom,
        'filter[date_to]':   dateTo,
        'limit':             String(limit),
        'skip':              String(skip),
    };

    const result = await restAdminGet('/bookings', params);

    // v2 returns { data: [...], total: N }  OR  just an array
    if (result && typeof result === 'object' && 'data' in (result as object)) {
        return (result as { data: SimplyBookAdminBooking[] }).data;
    }
    if (Array.isArray(result)) return result as SimplyBookAdminBooking[];
    if (result && typeof result === 'object') return Object.values(result) as SimplyBookAdminBooking[];
    return [];
}

// ── Public: single booking by hash (webhook fallback) ──
export async function getBookingDetailsByHash(
    bookingId: string,
    bookingHash: string
): Promise<SimplyBookBookingDetail | null> {
    try {
        return await callPublic('getBookingDetails', [bookingId, bookingHash]) as SimplyBookBookingDetail;
    } catch {
        console.error('[SimplyBook] getBookingDetails via public failed, skipping');
        return null;
    }
}

// ── Service & Provider lists ──
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

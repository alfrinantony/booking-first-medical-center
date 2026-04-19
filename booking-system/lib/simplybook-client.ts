/**
 * SimplyBook.me API Client — REST Admin API v2 + JSON-RPC Public
 *
 * Auth strategy:
 *   ADMIN  → REST API v2 (https://user-api-v2.simplybook.it/admin/)
 *            Authenticates with API Key + Secret Key via POST /admin/auth
 *            ✅ Does NOT trigger Google Authenticator
 *            ✅ Full access to bookings, clients, services, providers
 *
 *   PUBLIC → JSON-RPC (https://user-api.simplybook.it/)
 *            getToken(company, apiKey) for catalogue/widget methods
 */

// ── Endpoints ──
const REST_BASE      = 'https://user-api-v2.simplybook.it';
const JSONRPC_LOGIN  = 'https://user-api.simplybook.it/login';
const JSONRPC_PUBLIC = 'https://user-api.simplybook.it/';
const JSONRPC_ADMIN  = 'https://user-api.simplybook.it/admin/';

// ── Credentials ──
const COMPANY     = process.env.SIMPLYBOOK_COMPANY_LOGIN || 'firstmedicalcenter';
const API_KEY     = process.env.SIMPLYBOOK_API_KEY       || '';
const SECRET_KEY  = process.env.SIMPLYBOOK_SECRET_KEY    || '';
// Still used for JSON-RPC fallback admin auth
const ADMIN_LOGIN    = process.env.SIMPLYBOOK_ADMIN_LOGIN    || '';
const ADMIN_PASSWORD = process.env.SIMPLYBOOK_ADMIN_PASSWORD || '';

// ── REST v2 Admin Token Cache ──
let restAdminToken: string | null = null;
let restRefreshToken: string | null = null;
let restTokenExpiresAt = 0;

// ── JSON-RPC Public Token Cache ──
let publicToken: string | null = null;
let publicTokenExpiresAt = 0;

// ─────────────────────────────────────────────────────────────
// REST Admin API v2 – Authentication
// POST /admin/auth  { company, login, password, secret }
// Returns { token, refresh_token }
// ─────────────────────────────────────────────────────────────
async function getRestAdminToken(): Promise<string> {
    const now = Date.now();
    if (restAdminToken && now < restTokenExpiresAt) return restAdminToken;

    // Try refresh token if available
    if (restRefreshToken) {
        try {
            const res = await fetch(`${REST_BASE}/admin/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ company: COMPANY, refresh_token: restRefreshToken }),
                cache: 'no-store',
            });
            if (res.ok) {
                const data = await res.json() as { token: string; refresh_token?: string };
                restAdminToken = data.token;
                if (data.refresh_token) restRefreshToken = data.refresh_token;
                restTokenExpiresAt = now + 55 * 60 * 1000;
                return restAdminToken;
            }
        } catch { /* fall through */ }
    }

    // Attempt 1: REST v2 with API Key + Secret Key
    try {
        const res = await fetch(`${REST_BASE}/admin/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ company: COMPANY, login: API_KEY, password: SECRET_KEY }),
            cache: 'no-store',
        });
        if (res.ok) {
            const data = await res.json() as { token: string; refresh_token?: string };
            restAdminToken = data.token;
            if (data.refresh_token) restRefreshToken = data.refresh_token;
            restTokenExpiresAt = now + 55 * 60 * 1000;
            console.log('[SimplyBook REST] Token via API Key + Secret Key');
            return restAdminToken;
        }
        console.warn('[SimplyBook REST] API Key auth failed, status:', res.status, await res.text());
    } catch (e) {
        console.warn('[SimplyBook REST] API Key auth exception:', e);
    }

    // Attempt 2: REST v2 with User API Key (admin login)
    if (ADMIN_LOGIN && ADMIN_PASSWORD) {
        try {
            const res = await fetch(`${REST_BASE}/admin/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ company: COMPANY, login: ADMIN_LOGIN, password: ADMIN_PASSWORD }),
                cache: 'no-store',
            });
            if (res.ok) {
                const data = await res.json() as { token: string; refresh_token?: string };
                restAdminToken = data.token;
                if (data.refresh_token) restRefreshToken = data.refresh_token;
                restTokenExpiresAt = now + 55 * 60 * 1000;
                console.log('[SimplyBook REST] Token via Admin Login + API User Key');
                return restAdminToken;
            }
            console.warn('[SimplyBook REST] Admin login failed, status:', res.status, await res.text());
        } catch (e) {
            console.warn('[SimplyBook REST] Admin login exception:', e);
        }
    }

    // Attempt 3: JSON-RPC getToken (public, limited admin access)
    try {
        const token = await rpcCall(JSONRPC_LOGIN, 'getToken', [COMPANY, API_KEY]) as string;
        restAdminToken = token;
        restTokenExpiresAt = now + 55 * 60 * 1000;
        console.warn('[SimplyBook] Fell back to public getToken — admin methods may be limited');
        return restAdminToken;
    } catch (e) {
        console.error('[SimplyBook] All auth methods failed:', e);
        throw new Error(`SimplyBook: all authentication methods failed. Last error: ${e}`);
    }
}


// ─────────────────────────────────────────────────────────────
// REST Admin API v2 – Generic GET
// ─────────────────────────────────────────────────────────────
async function restGet<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
    const token = await getRestAdminToken();
    const url = new URL(`${REST_BASE}${path}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

    const res = await fetch(url.toString(), {
        headers: {
            'X-Company-Login': COMPANY,
            'X-Token': token,
            'Content-Type': 'application/json',
        },
        cache: 'no-store',
    });

    if (!res.ok) {
        // If 401, clear token and retry once
        if (res.status === 401) {
            restAdminToken = null;
            restTokenExpiresAt = 0;
            const newToken = await getRestAdminToken();
            const retry = await fetch(url.toString(), {
                headers: { 'X-Company-Login': COMPANY, 'X-Token': newToken },
                cache: 'no-store',
            });
            if (!retry.ok) throw new Error(`SimplyBook REST ${path} failed (${retry.status})`);
            return retry.json() as Promise<T>;
        }
        throw new Error(`SimplyBook REST ${path} failed (${res.status}): ${await res.text()}`);
    }
    return res.json() as Promise<T>;
}

// ─────────────────────────────────────────────────────────────
// JSON-RPC helpers (for public methods only)
// ─────────────────────────────────────────────────────────────
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

export async function getPublicToken(): Promise<string> {
    const now = Date.now();
    if (publicToken && now < publicTokenExpiresAt) return publicToken;
    publicToken = await rpcCall(JSONRPC_LOGIN, 'getToken', [COMPANY, API_KEY]) as string;
    publicTokenExpiresAt = now + 55 * 60 * 1000;
    return publicToken;
}

async function callPublicRPC(method: string, params: unknown[] = []): Promise<unknown> {
    const token = await getPublicToken();
    return rpcCall(JSONRPC_PUBLIC, method, params, {
        'X-Company-Login': COMPANY,
        'X-User-Token': token,
    });
}

// ─────────────────────────────────────────────────────────────
// Typed interfaces
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// REST Admin API – Bookings
// GET /admin/bookings?filter[date_from]=&filter[date_to]=&count=300
// ─────────────────────────────────────────────────────────────
interface RestBookingsResponse {
    data: SimplyBookAdminBooking[];
    total?: number;
    page?: number;
}

export async function getAdminBookings(
    dateFrom: string,
    dateTo: string,
    limit = 300,
    skip = 0
): Promise<SimplyBookAdminBooking[]> {
    try {
        const response = await restGet<RestBookingsResponse | SimplyBookAdminBooking[]>(
            '/admin/bookings',
            {
                'filter[date_from]': dateFrom,
                'filter[date_to]': dateTo,
                count: limit,
                page: Math.floor(skip / limit) + 1,
            }
        );
        // REST v2 wraps in { data: [...] }
        if (response && typeof response === 'object' && 'data' in response) {
            return (response as RestBookingsResponse).data || [];
        }
        if (Array.isArray(response)) return response;
        if (response && typeof response === 'object') return Object.values(response) as SimplyBookAdminBooking[];
        return [];
    } catch (err) {
        console.error('[SimplyBook] getAdminBookings REST failed:', err);
        return [];
    }
}

// ─────────────────────────────────────────────────────────────
// REST Admin API – Services (events)
// GET /admin/services   OR   GET /admin/events
// ─────────────────────────────────────────────────────────────
export async function getServiceList(): Promise<SimplyBookEvent[]> {
    try {
        // Try REST v2 first
        const res = await restGet<{ data: SimplyBookEvent[] } | SimplyBookEvent[]>('/admin/services');
        const arr = Array.isArray(res) ? res : (res as any).data || Object.values(res);
        if (arr.length > 0) return arr as SimplyBookEvent[];
    } catch { /* fall through */ }

    // Fallback to public JSON-RPC
    try {
        const result = await callPublicRPC('getEventList', [false, true]) as unknown;
        if (Array.isArray(result)) return result as SimplyBookEvent[];
        if (result && typeof result === 'object') return Object.values(result) as SimplyBookEvent[];
    } catch (err) {
        console.error('[SimplyBook] getServiceList failed:', err);
    }
    return [];
}

// ─────────────────────────────────────────────────────────────
// REST Admin API – Providers (performers/units)
// GET /admin/performers   OR   GET /admin/units
// ─────────────────────────────────────────────────────────────
export async function getProviderList(): Promise<SimplyBookUnit[]> {
    try {
        const res = await restGet<{ data: SimplyBookUnit[] } | SimplyBookUnit[]>('/admin/performers');
        const arr = Array.isArray(res) ? res : (res as any).data || Object.values(res);
        if (arr.length > 0) return arr as SimplyBookUnit[];
    } catch { /* fall through */ }

    // Fallback to public JSON-RPC
    try {
        const result = await callPublicRPC('getUnitList', [false, true]) as unknown;
        if (Array.isArray(result)) return result as SimplyBookUnit[];
        if (result && typeof result === 'object') return Object.values(result) as SimplyBookUnit[];
    } catch (err) {
        console.error('[SimplyBook] getProviderList failed:', err);
    }
    return [];
}

// ─────────────────────────────────────────────────────────────
// REST Admin API – Clients
// GET /admin/clients?count=500
// ─────────────────────────────────────────────────────────────
export async function getAdminClientList(): Promise<SimplyBookClient[]> {
    try {
        const res = await restGet<{ data: SimplyBookClient[] } | SimplyBookClient[]>(
            '/admin/clients', { count: 500 }
        );
        const arr = Array.isArray(res) ? res : (res as any).data || Object.values(res);
        return arr as SimplyBookClient[];
    } catch (err) {
        console.error('[SimplyBook] getAdminClientList REST failed:', err);
        return [];
    }
}

// ─────────────────────────────────────────────────────────────
// Public JSON-RPC – Booking detail by hash (for webhooks)
// ─────────────────────────────────────────────────────────────
export async function getBookingDetailsByHash(
    bookingId: string,
    bookingHash: string
): Promise<SimplyBookBookingDetail | null> {
    try {
        return await callPublicRPC('getBookingDetails', [bookingId, bookingHash]) as SimplyBookBookingDetail;
    } catch (err) {
        console.error('[SimplyBook] getBookingDetails failed:', err);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────
// getAdminToken – kept for backward compat with any callers
// ─────────────────────────────────────────────────────────────
export async function getAdminToken(): Promise<string> {
    return getRestAdminToken();
}

export async function callAdmin(method: string, params: unknown[] = []): Promise<unknown> {
    // Legacy JSON-RPC admin path — only used if called explicitly
    const token = await getRestAdminToken();
    return rpcCall(JSONRPC_ADMIN, method, params, {
        'X-Company-Login': COMPANY,
        'X-User-Token': token,
    });
}

export async function callPublic(method: string, params: unknown[] = []): Promise<unknown> {
    return callPublicRPC(method, params);
}

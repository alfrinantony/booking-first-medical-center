/**
 * SimplyBook.me JSON-RPC Public API Client
 * Docs: https://user-api.simplybook.it/
 *
 * Authentication flow:
 *   1. POST /login → getToken(company, apiKey) → returns token (valid ~1 hour)
 *   2. All subsequent calls use headers: X-Company-Login + X-User-Token
 */

const LOGIN_ENDPOINT = 'https://user-api.simplybook.it/login';
const API_ENDPOINT = 'https://user-api.simplybook.it/';

const COMPANY = process.env.SIMPLYBOOK_COMPANY_LOGIN || 'firstmedicalcenter';
const API_KEY = process.env.SIMPLYBOOK_API_KEY || '';

// ── In-memory token cache (per cold-start) ──
let cachedToken: string | null = null;
let tokenExpiresAt = 0; // epoch ms

async function rpcCall(endpoint: string, method: string, params: unknown[], headers: Record<string, string> = {}): Promise<unknown> {
    const body = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params,
    });

    const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        body,
        cache: 'no-store',
    });

    if (!res.ok) {
        throw new Error(`SimplyBook HTTP error ${res.status}: ${await res.text()}`);
    }

    const json = await res.json() as { result?: unknown; error?: { message: string; code: number } };

    if (json.error) {
        throw new Error(`SimplyBook RPC error [${json.error.code}]: ${json.error.message}`);
    }

    return json.result;
}

/**
 * Get (or refresh) the public user token.
 * Tokens are cached for 55 minutes to avoid repeated auth calls.
 */
export async function getToken(): Promise<string> {
    const now = Date.now();
    if (cachedToken && now < tokenExpiresAt) {
        return cachedToken;
    }

    const token = await rpcCall(LOGIN_ENDPOINT, 'getToken', [COMPANY, API_KEY]) as string;
    cachedToken = token;
    tokenExpiresAt = now + 55 * 60 * 1000; // 55 minutes
    return token;
}

/**
 * Make an authenticated call to the public SimplyBook API.
 */
export async function callPublic(method: string, params: unknown[] = []): Promise<unknown> {
    const token = await getToken();
    return rpcCall(API_ENDPOINT, method, params, {
        'X-Company-Login': COMPANY,
        'X-User-Token': token,
    });
}

// ── Typed helper interfaces ──

export interface SimplyBookBookingDetail {
    id: string | number;
    record_date: string;        // "2026-04-18"
    start_date_time: string;    // "2026-04-18 10:00:00"
    end_date_time: string;
    event_id: string | number;
    unit_id: string | number;
    client_id: string | number;
    // Client info
    client?: {
        name?: string;
        email?: string;
        phone?: string;
    };
    // Service / provider resolved names (populated by us)
    serviceName?: string;
    providerName?: string;
    // Status from SimplyBook
    status?: string;
    // Raw additional fields
    [key: string]: unknown;
}

export interface SimplyBookEvent {
    id: string | number;
    name: string;
    duration: number;
    price: string | number;
    category_id?: string | number;
}

export interface SimplyBookUnit {
    id: string | number;
    name: string;
}

/**
 * Get booking details using booking_id and booking_hash (provided by webhook).
 * Uses the public getBookingDetails method.
 */
export async function getBookingDetailsByHash(
    bookingId: string,
    bookingHash: string
): Promise<SimplyBookBookingDetail | null> {
    try {
        const result = await callPublic('getBookingDetails', [bookingId, bookingHash]);
        return result as SimplyBookBookingDetail;
    } catch (err) {
        console.error('[SimplyBook] getBookingDetails failed:', err);
        return null;
    }
}

/**
 * Get list of all services (events).
 */
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

/**
 * Get list of all providers (units / practitioners).
 */
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

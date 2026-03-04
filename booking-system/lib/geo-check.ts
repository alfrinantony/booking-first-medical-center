/**
 * Server-side geo-check utility.
 * Determines whether a request originates from UAE using various header sources.
 */

const UAE_COUNTRY_CODES = ['AE'];

export function isFromUAE(headers: Headers): boolean {
    // 1. Vercel deployment header
    const vercelCountry = headers.get('x-vercel-ip-country');
    if (vercelCountry) return UAE_COUNTRY_CODES.includes(vercelCountry.toUpperCase());

    // 2. Cloudflare header
    const cfCountry = headers.get('cf-ipcountry');
    if (cfCountry) return UAE_COUNTRY_CODES.includes(cfCountry.toUpperCase());

    // 3. For local development, always allow (no geo headers present)
    const forwardedFor = headers.get('x-forwarded-for');
    const realIp = headers.get('x-real-ip');

    // If no geo headers and running locally (127.0.0.1 / ::1), allow
    if (!vercelCountry && !cfCountry) {
        const ip = realIp || forwardedFor?.split(',')[0]?.trim() || '';
        if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
            return true; // Local dev — allow
        }
    }

    // 4. Default: block (no recognizable geo header found in production)
    return false;
}

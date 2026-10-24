import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/image-proxy?url=...
 * Proxies Instagram and Meta CDN images securely to bypass Referer blocks,
 * private browser restrictions, and cross-origin CORS limitations.
 */
export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get('url');
    if (!url) {
        return new NextResponse('Missing url parameter', { status: 400 });
    }

    try {
        const parsed = new URL(url);
        // Security check: Only allow known Meta CDN hostnames
        const allowedHosts = [
            'lookaside.fbsbx.com',
            'cdninstagram.com',
            'fbcdn.net',
            'facebook.com',
            'instagram.com',
        ];
        const isAllowed = allowedHosts.some(host => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
        if (!isAllowed) {
            return new NextResponse('Forbidden domain', { status: 403 });
        }

        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            },
        });

        if (!res.ok) {
            return new NextResponse('Failed to fetch upstream image', { status: res.status });
        }

        const contentType = res.headers.get('content-type') || 'image/jpeg';
        const buffer = await res.arrayBuffer();

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200',
            },
        });
    } catch (err) {
        console.error('[ImageProxy] Error fetching image:', err);
        return new NextResponse('Error proxying image', { status: 500 });
    }
}

import { NextRequest, NextResponse } from 'next/server';

const METRICOOL_BASE = 'https://app.metricool.com/api';
const TOKEN = process.env.METRICOOL_API_TOKEN || '';
const USER_ID = process.env.METRICOOL_USER_ID || '';

// Branch locations with their Metricool blog IDs
const BRANCHES = [
    { blogId: '5866679', name: 'FMC Muraqabat', locationId: '8510691425982086713' },
    { blogId: '5866682', name: 'FMC Qiyadah', locationId: '12697611866219754809' },
    { blogId: '5866690', name: 'FMC Silicon Oasis', locationId: '7703842496663260843' },
];

async function metricoolFetch(path: string, blogId: string, extra: Record<string, string> = {}) {
    const params = new URLSearchParams({ blogId, userId: USER_ID, ...extra });
    const res = await fetch(`${METRICOOL_BASE}${path}?${params}`, {
        headers: { 'X-Mc-Auth': TOKEN },
        cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Metricool ${path}: ${res.status}`);
    return res.json();
}

// GET — fetch all Google reviews from all branches
export async function GET() {
    try {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 90);
        const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
        const dateParams = { start: fmt(start), end: fmt(end), sortcolumn: 'created' };

        const allReviews = await Promise.all(
            BRANCHES.map(async (branch) => {
                try {
                    const reviews = await metricoolFetch('/stats/gmb/review', branch.blogId, dateParams);
                    return (Array.isArray(reviews) ? reviews : []).map((r: any) => ({
                        id: r.name,
                        branch: branch.name,
                        branchBlogId: branch.blogId,
                        locationId: r.locationId || branch.locationId,
                        reviewerName: r.reviewerName || 'Anonymous',
                        reviewerPhoto: r.reviewerPhoto || '',
                        text: r.text || '',
                        starRating: r.starRating || 0,
                        created: r.created,
                        replied: r.replied === 1,
                        replyComment: r.replyComment || null,
                    }));
                } catch {
                    return [];
                }
            })
        );

        const reviews = allReviews.flat().sort((a, b) => b.created - a.created);

        return NextResponse.json({
            status: 'live',
            total: reviews.length,
            unreplied: reviews.filter(r => !r.replied).length,
            reviews,
        });
    } catch (error: any) {
        console.error('Google reviews error:', error);
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }
}

// POST — reply to a Google review via Metricool
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { reviewName, replyText, blogId } = body;

        if (!reviewName || !replyText || !blogId) {
            return NextResponse.json({ error: 'Missing reviewName, replyText, or blogId' }, { status: 400 });
        }

        const params = new URLSearchParams({
            blogId,
            userId: USER_ID,
            reviewname: reviewName,
            end: replyText,
        });

        const res = await fetch(`${METRICOOL_BASE}/stats/gmb/review/reply?${params}`, {
            headers: { 'X-Mc-Auth': TOKEN },
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error('Reply error:', errText);
            return NextResponse.json({ error: 'Failed to post reply', details: errText }, { status: res.status });
        }

        const result = await res.json();
        return NextResponse.json({ status: 'success', result });
    } catch (error: any) {
        console.error('Reply error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

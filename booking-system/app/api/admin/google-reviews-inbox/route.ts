import { NextRequest, NextResponse } from 'next/server';
import { GoogleReviewsInboxStore } from '@/lib/google-reviews-inbox-store';

/**
 * GET /api/admin/google-reviews-inbox
 * Returns all Google review conversations for the inbox.
 * Refreshes from Google Places API on each call (cached internally).
 */
export async function GET() {
    try {
        // Refresh reviews from Google (or mocks if no API key)
        await GoogleReviewsInboxStore.refresh();

        // Convert to inbox format
        const { conversations, messages } = await GoogleReviewsInboxStore.toInboxFormat();

        return NextResponse.json({ conversations, messages });
    } catch (error) {
        console.error('[GoogleReviewsInbox] GET error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch Google review conversations' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/admin/google-reviews-inbox
 * Body: { reviewId: string, content: string, repliedByUserId?: string, repliedByUserName?: string }
 * Submit a manual reply to a Google review.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { reviewId, content, repliedByUserId, repliedByUserName } = body;

        if (!reviewId || !content) {
            return NextResponse.json(
                { error: 'Missing required fields: reviewId, content' },
                { status: 400 }
            );
        }

        const reply = await GoogleReviewsInboxStore.addReply(reviewId, content, false, repliedByUserId, repliedByUserName);
        if (!reply) {
            return NextResponse.json(
                { error: 'Review not found' },
                { status: 404 }
            );
        }

        // Post the reply to Google via Metricool's GMB reply API
        const METRICOOL_BASE = 'https://app.metricool.com/api';
        const TOKEN = process.env.METRICOOL_API_TOKEN || '';
        const USER_ID = process.env.METRICOOL_USER_ID || '';

        // Look up the review in Metricool to find its blogId
        const BRANCHES = [
            { blogId: '5866679', name: 'FMC Muraqabat' },
            { blogId: '5866682', name: 'FMC Qiyadah' },
            { blogId: '5866690', name: 'FMC Silicon Oasis' },
        ];

        if (TOKEN && USER_ID) {
            let replyPosted = false;
            for (const branch of BRANCHES) {
                try {
                    const params = new URLSearchParams({
                        blogId: branch.blogId,
                        userId: USER_ID,
                        reviewname: reviewId,
                        end: content,
                    });
                    const res = await fetch(`${METRICOOL_BASE}/stats/gmb/review/reply?${params}`, {
                        headers: { 'X-Mc-Auth': TOKEN },
                    });
                    if (res.ok) {
                        replyPosted = true;
                        console.log(`[GoogleReviewsInbox] Reply posted to Google via Metricool (${branch.name})`);
                        break;
                    }
                } catch (err) {
                    console.error(`[GoogleReviewsInbox] Metricool reply error (${branch.name}):`, err);
                }
            }
            if (!replyPosted) {
                console.warn('[GoogleReviewsInbox] Could not post reply to Google via Metricool — saved locally only');
            }
        }

        return NextResponse.json({ success: true, reply }, { status: 201 });
    } catch (error) {
        console.error('[GoogleReviewsInbox] POST error:', error);
        return NextResponse.json(
            { error: 'Failed to submit reply' },
            { status: 500 }
        );
    }
}

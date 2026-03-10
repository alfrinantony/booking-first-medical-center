import { NextRequest, NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────
// Social Inbox API — Fetches real comments & reviews from Metricool
// Supports: Instagram comments, Facebook comments, Google Reviews
// ─────────────────────────────────────────────────────────────

const METRICOOL_BASE = 'https://app.metricool.com/api';
const TOKEN = process.env.METRICOOL_API_TOKEN || '';
const USER_ID = process.env.METRICOOL_USER_ID || '';
const BLOG_ID = process.env.METRICOOL_BLOG_ID || '';

// Branch-specific blog IDs for GMB (Google My Business) reviews
const GMB_BRANCHES = [
    { blogId: '5866679', name: 'FMC Muraqabat' },
    { blogId: '5866682', name: 'FMC Qiyadah' },
    { blogId: '5866690', name: 'FMC Silicon Oasis' },
];

async function metricoolFetch(path: string, extra: Record<string, string> = {}, blogIdOverride?: string) {
    const params = new URLSearchParams({
        blogId: blogIdOverride || BLOG_ID,
        userId: USER_ID,
        ...extra,
    });
    const res = await fetch(`${METRICOOL_BASE}${path}?${params}`, {
        headers: { 'X-Mc-Auth': TOKEN },
    });
    if (!res.ok) {
        console.error(`[SocialInbox] Metricool ${path}: ${res.status}`);
        return null;
    }
    return res.json();
}

// Date helpers
function formatDate(d: Date): string {
    return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function getDates30d() {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    return { start: formatDate(start), end: formatDate(end) };
}

interface InboxConversation {
    id: string;
    platform: 'instagram' | 'facebook' | 'google_reviews';
    participantName: string;
    participantAvatar?: string;
    lastMessageContent: string;
    lastMessageTimestamp: string;
    unreadCount: number;
    // Google Reviews specific
    starRating?: number;
    reviewText?: string;
    clinicName?: string;
    clinicId?: string;
    replyStatus?: 'unreplied' | 'replied' | 'auto_replied';
    googleReviewId?: string;
    // Post-based (IG/FB)
    postContent?: string;
    postImageUrl?: string;
    postUrl?: string;
    commentCount?: number;
    metricoolPostId?: string;
}

interface InboxMessage {
    id: string;
    conversationId: string;
    senderName: string;
    content: string;
    timestamp: string;
    platform: string;
    isFromStaff: boolean;
    status: 'sent' | 'delivered' | 'read';
}

/**
 * GET /api/admin/social-inbox
 * Fetches Instagram comments, Facebook comments, and Google Reviews from Metricool.
 */
export async function GET() {
    if (!TOKEN || !USER_ID || !BLOG_ID) {
        return NextResponse.json({ error: 'Metricool credentials not configured' }, { status: 500 });
    }

    const { start, end } = getDates30d();
    const conversations: InboxConversation[] = [];
    const messages: Record<string, InboxMessage[]> = {};

    // ── 1. Instagram Posts (with comments) ──
    try {
        const igPosts = await metricoolFetch('/stats/instagram/posts', {
            start,
            end,
            sortcolumn: 'comments',
        });
        if (Array.isArray(igPosts)) {
            for (const post of igPosts) {
                if ((post.comments || 0) > 0) {
                    const convId = `ig-post-${post.postId || post.id}`;
                    const timestamp = post.created
                        ? new Date(post.created).toISOString()
                        : new Date().toISOString();
                    const content = post.content || post.text || '';
                    const commentCount = post.comments || 0;

                    conversations.push({
                        id: convId,
                        platform: 'instagram',
                        participantName: `${commentCount} comment${commentCount !== 1 ? 's' : ''}`,
                        participantAvatar: post.imageUrl,
                        lastMessageContent: content.slice(0, 120) + (content.length > 120 ? '…' : ''),
                        lastMessageTimestamp: timestamp,
                        unreadCount: 0,
                        postContent: content,
                        postImageUrl: post.imageUrl,
                        postUrl: post.url,
                        commentCount,
                        metricoolPostId: post.postId || post.id,
                    });

                    messages[convId] = [{
                        id: `${convId}-post`,
                        conversationId: convId,
                        senderName: 'Your Post',
                        content: content || '[Image post]',
                        timestamp,
                        platform: 'instagram',
                        isFromStaff: true,
                        status: 'read',
                    }];
                }
            }
        }
    } catch (err) {
        console.error('[SocialInbox] Instagram posts error:', err);
    }

    // ── Also fetch Instagram Reels ──
    try {
        const igReels = await metricoolFetch('/stats/instagram/reels', {
            start,
            end,
            sortcolumn: 'comments',
        });
        if (Array.isArray(igReels)) {
            for (const reel of igReels) {
                if ((reel.comments || 0) > 0) {
                    const convId = `ig-reel-${reel.postId || reel.id}`;
                    const timestamp = reel.created
                        ? new Date(reel.created).toISOString()
                        : new Date().toISOString();
                    const content = reel.content || reel.text || '';
                    const commentCount = reel.comments || 0;

                    conversations.push({
                        id: convId,
                        platform: 'instagram',
                        participantName: `${commentCount} comment${commentCount !== 1 ? 's' : ''} (Reel)`,
                        participantAvatar: reel.imageUrl,
                        lastMessageContent: content.slice(0, 120) + (content.length > 120 ? '…' : ''),
                        lastMessageTimestamp: timestamp,
                        unreadCount: 0,
                        postContent: content,
                        postImageUrl: reel.imageUrl,
                        postUrl: reel.url,
                        commentCount,
                        metricoolPostId: reel.postId || reel.id,
                    });

                    messages[convId] = [{
                        id: `${convId}-reel`,
                        conversationId: convId,
                        senderName: 'Your Reel',
                        content: content || '[Reel]',
                        timestamp,
                        platform: 'instagram',
                        isFromStaff: true,
                        status: 'read',
                    }];
                }
            }
        }
    } catch (err) {
        console.error('[SocialInbox] Instagram reels error:', err);
    }

    // ── 2. Facebook Posts (with comments) ──
    try {
        const fbPosts = await metricoolFetch('/stats/facebook/posts', {
            start,
            end,
            sortcolumn: 'comments',
        });
        if (Array.isArray(fbPosts)) {
            for (const post of fbPosts) {
                if ((post.comments || 0) > 0) {
                    const convId = `fb-post-${post.postId || post.id}`;
                    const timestamp = post.created
                        ? new Date(post.created).toISOString()
                        : new Date().toISOString();
                    const content = post.text || post.content || '';
                    const commentCount = post.comments || 0;

                    conversations.push({
                        id: convId,
                        platform: 'facebook',
                        participantName: `${commentCount} comment${commentCount !== 1 ? 's' : ''}`,
                        participantAvatar: post.picture,
                        lastMessageContent: content.slice(0, 120) + (content.length > 120 ? '…' : ''),
                        lastMessageTimestamp: timestamp,
                        unreadCount: 0,
                        postContent: content,
                        postImageUrl: post.picture,
                        postUrl: post.link,
                        commentCount,
                        metricoolPostId: post.postId || post.id,
                    });

                    messages[convId] = [{
                        id: `${convId}-post`,
                        conversationId: convId,
                        senderName: 'Your Post',
                        content: content || '[Post]',
                        timestamp,
                        platform: 'facebook',
                        isFromStaff: true,
                        status: 'read',
                    }];
                }
            }
        }
    } catch (err) {
        console.error('[SocialInbox] Facebook posts error:', err);
    }

    // ── 3. Google Business Reviews (from all branches) ──
    try {
        for (const branch of GMB_BRANCHES) {
            const reviews = await metricoolFetch('/stats/gmb/review', {
                start,
                end,
                sortcolumn: 'created',
            }, branch.blogId);
            if (Array.isArray(reviews)) {
                for (const review of reviews) {
                    const convId = `gmb-${branch.blogId}-${review.reviewname || review.id || Date.now()}`;
                    const timestamp = review.createTime
                        ? new Date(review.createTime).toISOString()
                        : review.created
                            ? new Date(review.created).toISOString()
                            : new Date().toISOString();
                    const reviewText = review.comment || review.text || '';
                    const rating = review.starRating || review.rating || 0;
                    const starNum = typeof rating === 'string'
                        ? { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }[rating] || 0
                        : rating;
                    const hasReply = !!(review.replyComment || review.reply);

                    conversations.push({
                        id: convId,
                        platform: 'google_reviews',
                        participantName: review.reviewer?.displayName || review.authorName || 'Reviewer',
                        participantAvatar: review.reviewer?.profilePhotoUrl || review.photoUrl,
                        lastMessageContent: reviewText.slice(0, 120) + (reviewText.length > 120 ? '…' : ''),
                        lastMessageTimestamp: timestamp,
                        unreadCount: hasReply ? 0 : 1,
                        starRating: starNum,
                        reviewText,
                        clinicName: branch.name,
                        clinicId: branch.blogId,
                        replyStatus: hasReply ? 'replied' : 'unreplied',
                        googleReviewId: review.reviewname || review.name || review.id,
                    });

                    const msgs: InboxMessage[] = [{
                        id: `${convId}-review`,
                        conversationId: convId,
                        senderName: review.reviewer?.displayName || review.authorName || 'Reviewer',
                        content: reviewText || '(No text)',
                        timestamp,
                        platform: 'google_reviews',
                        isFromStaff: false,
                        status: 'read',
                    }];

                    // Include existing reply if present
                    if (review.replyComment || review.reply) {
                        const replyText = review.replyComment || review.reply;
                        const replyTime = review.replyUpdateTime
                            ? new Date(review.replyUpdateTime).toISOString()
                            : new Date(new Date(timestamp).getTime() + 3600000).toISOString();
                        msgs.push({
                            id: `${convId}-reply`,
                            conversationId: convId,
                            senderName: 'First Medical Center',
                            content: typeof replyText === 'string' ? replyText : JSON.stringify(replyText),
                            timestamp: replyTime,
                            platform: 'google_reviews',
                            isFromStaff: true,
                            status: 'sent',
                        });
                    }

                    messages[convId] = msgs;
                }
            }
        }
    } catch (err) {
        console.error('[SocialInbox] GMB reviews error:', err);
    }

    // Sort by most recent
    conversations.sort((a, b) =>
        new Date(b.lastMessageTimestamp).getTime() - new Date(a.lastMessageTimestamp).getTime()
    );

    return NextResponse.json({ conversations, messages });
}

/**
 * POST /api/admin/social-inbox
 * Body: { platform, conversationId, content, reviewname? }
 * Reply to a comment or review via Metricool.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { platform, conversationId, content, reviewname } = body;

        if (!content) {
            return NextResponse.json({ error: 'content is required' }, { status: 400 });
        }

        if (!TOKEN || !USER_ID) {
            return NextResponse.json({ error: 'Metricool credentials not configured' }, { status: 500 });
        }

        let replyPosted = false;

        if (platform === 'google_reviews') {
            // Reply to Google Business review via Metricool
            const reviewId = reviewname || conversationId;
            for (const branch of GMB_BRANCHES) {
                try {
                    const params = new URLSearchParams({
                        blogId: branch.blogId,
                        userId: USER_ID,
                        reviewname: reviewId,
                        end: content, // Metricool uses 'end' param for reply text
                    });
                    const res = await fetch(`${METRICOOL_BASE}/stats/gmb/review/reply?${params}`, {
                        headers: { 'X-Mc-Auth': TOKEN },
                    });
                    if (res.ok) {
                        replyPosted = true;
                        console.log(`[SocialInbox] GMB reply posted via Metricool (${branch.name})`);
                        break;
                    }
                } catch (err) {
                    console.error(`[SocialInbox] GMB reply error (${branch.name}):`, err);
                }
            }
        } else if (platform === 'instagram') {
            // Reply to Instagram comment via Metricool
            const params = new URLSearchParams({
                blogId: BLOG_ID,
                userId: USER_ID,
                conversationid: conversationId,
                text: content,
            });
            try {
                const res = await fetch(`${METRICOOL_BASE}/stats/postmessage/igComments?${params}`, {
                    headers: { 'X-Mc-Auth': TOKEN },
                });
                replyPosted = res.ok;
                if (replyPosted) console.log('[SocialInbox] IG comment reply posted');
            } catch (err) {
                console.error('[SocialInbox] IG reply error:', err);
            }
        } else if (platform === 'facebook') {
            // Reply to Facebook comment via Metricool
            const params = new URLSearchParams({
                blogId: BLOG_ID,
                userId: USER_ID,
                conversationid: conversationId,
                text: content,
            });
            try {
                const res = await fetch(`${METRICOOL_BASE}/stats/postmessage/fbComments?${params}`, {
                    headers: { 'X-Mc-Auth': TOKEN },
                });
                replyPosted = res.ok;
                if (replyPosted) console.log('[SocialInbox] FB comment reply posted');
            } catch (err) {
                console.error('[SocialInbox] FB reply error:', err);
            }
        }

        return NextResponse.json({
            success: true,
            replyPosted,
            message: replyPosted ? 'Reply posted to platform' : 'Reply saved locally (could not post to platform)',
        });
    } catch (error) {
        console.error('[SocialInbox] POST error:', error);
        return NextResponse.json({ error: 'Failed to submit reply' }, { status: 500 });
    }
}

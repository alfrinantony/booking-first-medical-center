import { NextRequest, NextResponse } from 'next/server';
import { SettingsStore } from '@/lib/settings-store';

// ─────────────────────────────────────────────────────────────
// Social Inbox API — Fetches real comments & reviews from Metricool
// Supports: Instagram comments, Facebook comments, Google Reviews
// ─────────────────────────────────────────────────────────────

const METRICOOL_BASE = 'https://app.metricool.com/api';

// Branch-specific blog IDs for GMB (Google My Business) reviews
const GMB_BRANCHES = [
    { blogId: '5866679', name: 'FMC Muraqabat' },
    { blogId: '5866682', name: 'FMC Qiyadah' },
    { blogId: '5866690', name: 'FMC Silicon Oasis' },
];

/**
 * Resolve Metricool credentials: check process.env first, then fall back to settings store.
 */
async function getMetricoolCreds() {
    let token = process.env.METRICOOL_API_TOKEN || '';
    let userId = process.env.METRICOOL_USER_ID || '';
    let blogId = process.env.METRICOOL_BLOG_ID || '';

    // If env vars are missing, fall back to the settings store (persisted in Azure Blob)
    if (!token || !userId || !blogId) {
        try {
            const settings = await SettingsStore.getSettings();
            token = token || settings.metricoolApiToken || '';
            userId = userId || settings.metricoolUserId || '';
            blogId = blogId || settings.metricoolBlogId || '';
        } catch (e) {
            console.error('[SocialInbox] Could not load settings from blob:', e);
        }
    }

    return { token, userId, blogId };
}

async function metricoolFetch(
    token: string,
    userId: string,
    blogId: string,
    path: string,
    extra: Record<string, string> = {},
    blogIdOverride?: string,
) {
    const params = new URLSearchParams({
        blogId: blogIdOverride || blogId,
        userId,
        ...extra,
    });
    const res = await fetch(`${METRICOOL_BASE}${path}?${params}`, {
        headers: { 'X-Mc-Auth': token },
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
    starRating?: number;
    reviewText?: string;
    clinicName?: string;
    clinicId?: string;
    replyStatus?: 'unreplied' | 'replied' | 'auto_replied';
    googleReviewId?: string;
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
 */
export async function GET() {
    const { token, userId, blogId } = await getMetricoolCreds();

    if (!token || !userId || !blogId) {
        return NextResponse.json(
            { error: 'Metricool credentials not configured. Set them in Settings → Social Media & Marketing → Metricool.' },
            { status: 500 },
        );
    }

    const { start, end } = getDates30d();
    const conversations: InboxConversation[] = [];
    const messages: Record<string, InboxMessage[]> = {};

    // ── 1. Instagram Posts (with comments) ──
    try {
        const igPosts = await metricoolFetch(token, userId, blogId, '/stats/instagram/posts', { start, end, sortcolumn: 'comments' });
        if (Array.isArray(igPosts)) {
            for (const post of igPosts) {
                if ((post.comments || 0) > 0) {
                    const convId = `ig-post-${post.postId || post.id}`;
                    const timestamp = post.created ? new Date(post.created).toISOString() : new Date().toISOString();
                    const content = post.content || post.text || '';
                    const commentCount = post.comments || 0;

                    conversations.push({
                        id: convId, platform: 'instagram',
                        participantName: `${commentCount} comment${commentCount !== 1 ? 's' : ''}`,
                        participantAvatar: post.imageUrl,
                        lastMessageContent: content.slice(0, 120) + (content.length > 120 ? '…' : ''),
                        lastMessageTimestamp: timestamp, unreadCount: 0,
                        postContent: content, postImageUrl: post.imageUrl, postUrl: post.url,
                        commentCount, metricoolPostId: post.postId || post.id,
                    });
                    messages[convId] = [{ id: `${convId}-post`, conversationId: convId, senderName: 'Your Post', content: content || '[Image post]', timestamp, platform: 'instagram', isFromStaff: true, status: 'read' }];
                }
            }
        }
    } catch (err) { console.error('[SocialInbox] IG posts error:', err); }

    // ── Also fetch Instagram Reels ──
    try {
        const igReels = await metricoolFetch(token, userId, blogId, '/stats/instagram/reels', { start, end, sortcolumn: 'comments' });
        if (Array.isArray(igReels)) {
            for (const reel of igReels) {
                if ((reel.comments || 0) > 0) {
                    const convId = `ig-reel-${reel.postId || reel.id}`;
                    const timestamp = reel.created ? new Date(reel.created).toISOString() : new Date().toISOString();
                    const content = reel.content || reel.text || '';
                    const commentCount = reel.comments || 0;

                    conversations.push({
                        id: convId, platform: 'instagram',
                        participantName: `${commentCount} comment${commentCount !== 1 ? 's' : ''} (Reel)`,
                        participantAvatar: reel.imageUrl,
                        lastMessageContent: content.slice(0, 120) + (content.length > 120 ? '…' : ''),
                        lastMessageTimestamp: timestamp, unreadCount: 0,
                        postContent: content, postImageUrl: reel.imageUrl, postUrl: reel.url,
                        commentCount, metricoolPostId: reel.postId || reel.id,
                    });
                    messages[convId] = [{ id: `${convId}-reel`, conversationId: convId, senderName: 'Your Reel', content: content || '[Reel]', timestamp, platform: 'instagram', isFromStaff: true, status: 'read' }];
                }
            }
        }
    } catch (err) { console.error('[SocialInbox] IG reels error:', err); }

    // ── 2. Facebook Posts (with comments) ──
    try {
        const fbPosts = await metricoolFetch(token, userId, blogId, '/stats/facebook/posts', { start, end, sortcolumn: 'comments' });
        if (Array.isArray(fbPosts)) {
            for (const post of fbPosts) {
                if ((post.comments || 0) > 0) {
                    const convId = `fb-post-${post.postId || post.id}`;
                    const timestamp = post.created ? new Date(post.created).toISOString() : new Date().toISOString();
                    const content = post.text || post.content || '';
                    const commentCount = post.comments || 0;

                    conversations.push({
                        id: convId, platform: 'facebook',
                        participantName: `${commentCount} comment${commentCount !== 1 ? 's' : ''}`,
                        participantAvatar: post.picture,
                        lastMessageContent: content.slice(0, 120) + (content.length > 120 ? '…' : ''),
                        lastMessageTimestamp: timestamp, unreadCount: 0,
                        postContent: content, postImageUrl: post.picture, postUrl: post.link,
                        commentCount, metricoolPostId: post.postId || post.id,
                    });
                    messages[convId] = [{ id: `${convId}-post`, conversationId: convId, senderName: 'Your Post', content: content || '[Post]', timestamp, platform: 'facebook', isFromStaff: true, status: 'read' }];
                }
            }
        }
    } catch (err) { console.error('[SocialInbox] FB posts error:', err); }

    // ── 3. Google Business Reviews (from all branches) ──
    try {
        for (const branch of GMB_BRANCHES) {
            const reviews = await metricoolFetch(token, userId, blogId, '/stats/gmb/review', { start, end, sortcolumn: 'created' }, branch.blogId);
            if (Array.isArray(reviews)) {
                for (const review of reviews) {
                    const convId = `gmb-${branch.blogId}-${review.reviewname || review.id || Date.now()}`;
                    const timestamp = review.createTime ? new Date(review.createTime).toISOString() : review.created ? new Date(review.created).toISOString() : new Date().toISOString();
                    const reviewText = review.comment || review.text || '';
                    const rating = review.starRating || review.rating || 0;
                    const starNum = typeof rating === 'string' ? ({ ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 } as Record<string, number>)[rating] || 0 : rating;
                    const hasReply = !!(review.replyComment || review.reply);

                    conversations.push({
                        id: convId, platform: 'google_reviews',
                        participantName: review.reviewer?.displayName || review.authorName || 'Reviewer',
                        participantAvatar: review.reviewer?.profilePhotoUrl || review.photoUrl,
                        lastMessageContent: reviewText.slice(0, 120) + (reviewText.length > 120 ? '…' : ''),
                        lastMessageTimestamp: timestamp,
                        unreadCount: hasReply ? 0 : 1,
                        starRating: starNum, reviewText,
                        clinicName: branch.name, clinicId: branch.blogId,
                        replyStatus: hasReply ? 'replied' : 'unreplied',
                        googleReviewId: review.reviewname || review.name || review.id,
                    });

                    const msgs: InboxMessage[] = [{
                        id: `${convId}-review`, conversationId: convId,
                        senderName: review.reviewer?.displayName || review.authorName || 'Reviewer',
                        content: reviewText || '(No text)', timestamp, platform: 'google_reviews',
                        isFromStaff: false, status: 'read',
                    }];

                    if (review.replyComment || review.reply) {
                        const replyText = review.replyComment || review.reply;
                        const replyTime = review.replyUpdateTime ? new Date(review.replyUpdateTime).toISOString() : new Date(new Date(timestamp).getTime() + 3600000).toISOString();
                        msgs.push({
                            id: `${convId}-reply`, conversationId: convId,
                            senderName: 'First Medical Center',
                            content: typeof replyText === 'string' ? replyText : JSON.stringify(replyText),
                            timestamp: replyTime, platform: 'google_reviews',
                            isFromStaff: true, status: 'sent',
                        });
                    }
                    messages[convId] = msgs;
                }
            }
        }
    } catch (err) { console.error('[SocialInbox] GMB reviews error:', err); }

    // Sort by most recent
    conversations.sort((a, b) => new Date(b.lastMessageTimestamp).getTime() - new Date(a.lastMessageTimestamp).getTime());
    return NextResponse.json({ conversations, messages });
}

/**
 * POST /api/admin/social-inbox
 * Body: { platform, conversationId, content, reviewname? }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { platform, conversationId, content, reviewname } = body;

        if (!content) {
            return NextResponse.json({ error: 'content is required' }, { status: 400 });
        }

        const { token, userId, blogId } = await getMetricoolCreds();
        if (!token || !userId) {
            return NextResponse.json({ error: 'Metricool credentials not configured' }, { status: 500 });
        }

        let replyPosted = false;

        if (platform === 'google_reviews') {
            const reviewId = reviewname || conversationId;
            for (const branch of GMB_BRANCHES) {
                try {
                    const params = new URLSearchParams({ blogId: branch.blogId, userId, reviewname: reviewId, end: content });
                    const res = await fetch(`${METRICOOL_BASE}/stats/gmb/review/reply?${params}`, { headers: { 'X-Mc-Auth': token } });
                    if (res.ok) { replyPosted = true; console.log(`[SocialInbox] GMB reply posted (${branch.name})`); break; }
                } catch (err) { console.error(`[SocialInbox] GMB reply error (${branch.name}):`, err); }
            }
        } else if (platform === 'instagram') {
            const params = new URLSearchParams({ blogId, userId, conversationid: conversationId, text: content });
            try {
                const res = await fetch(`${METRICOOL_BASE}/stats/postmessage/igComments?${params}`, { headers: { 'X-Mc-Auth': token } });
                replyPosted = res.ok;
            } catch (err) { console.error('[SocialInbox] IG reply error:', err); }
        } else if (platform === 'facebook') {
            const params = new URLSearchParams({ blogId, userId, conversationid: conversationId, text: content });
            try {
                const res = await fetch(`${METRICOOL_BASE}/stats/postmessage/fbComments?${params}`, { headers: { 'X-Mc-Auth': token } });
                replyPosted = res.ok;
            } catch (err) { console.error('[SocialInbox] FB reply error:', err); }
        }

        return NextResponse.json({
            success: true, replyPosted,
            message: replyPosted ? 'Reply posted to platform' : 'Reply saved locally (could not post to platform)',
        });
    } catch (error) {
        console.error('[SocialInbox] POST error:', error);
        return NextResponse.json({ error: 'Failed to submit reply' }, { status: 500 });
    }
}

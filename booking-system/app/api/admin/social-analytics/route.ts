import { NextRequest, NextResponse } from 'next/server';

const METRICOOL_BASE = 'https://app.metricool.com/api';
const TOKEN = process.env.METRICOOL_API_TOKEN || '';
const USER_ID = process.env.METRICOOL_USER_ID || '';
const BLOG_ID = process.env.METRICOOL_BLOG_ID || '';

async function metricoolFetch(path: string, extra: Record<string, string> = {}) {
    const params = new URLSearchParams({ blogId: BLOG_ID, userId: USER_ID, ...extra });
    const res = await fetch(`${METRICOOL_BASE}${path}?${params}`, {
        headers: { 'X-Mc-Auth': TOKEN },
        next: { revalidate: 300 }, // cache 5 min
    });
    if (!res.ok) throw new Error(`Metricool ${path}: ${res.status}`);
    return res.json();
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const range = searchParams.get('range') || '30d';

        // Calculate date range
        const end = new Date();
        const start = new Date();
        if (range === '7d') start.setDate(end.getDate() - 7);
        else if (range === '90d') start.setDate(end.getDate() - 90);
        else start.setDate(end.getDate() - 30);

        const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
        const startStr = fmt(start);
        const endStr = fmt(end);
        const dateParams = { start: startStr, end: endStr };

        // Fetch all data in parallel
        const [
            igAggregations,
            fbAggregations,
            igPosts,
            igReels,
            fbPosts,
            igFollowersTimeline,
            igReachTimeline,
        ] = await Promise.all([
            metricoolFetch('/stats/aggregations/instagram', dateParams).catch(() => ({})),
            metricoolFetch('/stats/aggregations/Facebook', dateParams).catch(() => ({})),
            metricoolFetch('/stats/instagram/posts', { ...dateParams, sortcolumn: 'engagement' }).catch(() => []),
            metricoolFetch('/stats/instagram/reels', { ...dateParams, sortcolumn: 'engagement' }).catch(() => []),
            metricoolFetch('/stats/facebook/posts', { ...dateParams, sortcolumn: 'engagement' }).catch(() => []),
            metricoolFetch('/stats/timeline/igFollowers', dateParams).catch(() => []),
            metricoolFetch('/stats/timeline/igreach', dateParams).catch(() => []),
        ]);

        // Process Instagram posts — top 10 by engagement
        const topIgPosts = (Array.isArray(igPosts) ? igPosts : []).slice(0, 10).map((p: any) => ({
            id: p.postId,
            platform: 'instagram',
            type: p.type || 'post',
            content: (p.content || '').slice(0, 120) + ((p.content || '').length > 120 ? '…' : ''),
            imageUrl: p.imageUrl,
            url: p.url,
            likes: p.likes || 0,
            comments: p.comments || 0,
            shares: p.shares || 0,
            saved: p.saved || 0,
            engagement: p.engagement || 0,
            impressions: p.impressionsTotal || p.impressions || 0,
            reach: p.reach || 0,
            views: p.views || 0,
            date: p.created,
            spend: p.spend || 0,
        }));

        // Process Instagram reels
        const topIgReels = (Array.isArray(igReels) ? igReels : []).slice(0, 5).map((p: any) => ({
            id: p.postId,
            platform: 'instagram',
            type: 'REEL',
            content: (p.content || '').slice(0, 120) + ((p.content || '').length > 120 ? '…' : ''),
            imageUrl: p.imageUrl,
            url: p.url,
            likes: p.likes || 0,
            comments: p.comments || 0,
            shares: p.shares || 0,
            saved: p.saved || 0,
            engagement: p.engagement || 0,
            impressions: p.impressionsTotal || p.impressions || 0,
            reach: p.reach || 0,
            views: p.views || p.videoViews || 0,
            date: p.created,
            spend: p.spend || 0,
        }));

        // Process Facebook posts — top 10
        const topFbPosts = (Array.isArray(fbPosts) ? fbPosts : []).slice(0, 10).map((p: any) => ({
            id: p.postId,
            platform: 'facebook',
            type: p.type || 'post',
            content: (p.text || '').slice(0, 120) + ((p.text || '').length > 120 ? '…' : ''),
            imageUrl: p.picture,
            url: p.link,
            likes: p.reactions || 0,
            comments: p.comments || 0,
            shares: p.shares || 0,
            saved: 0,
            engagement: p.engagement || 0,
            impressions: p.impressions || 0,
            reach: p.impressionsUnique || 0,
            views: p.videoViews || 0,
            date: p.created ? new Date(p.created).toISOString().slice(0, 19).replace('T', ' ') : '',
            spend: p.spend || 0,
        }));

        // Process followers timeline (array of [timestamp, value] pairs)
        const followersData = (Array.isArray(igFollowersTimeline) ? igFollowersTimeline : []).map((item: any) => ({
            date: item[0],
            value: item[1],
        }));

        const reachData = (Array.isArray(igReachTimeline) ? igReachTimeline : []).map((item: any) => ({
            date: item[0],
            value: item[1],
        }));

        return NextResponse.json({
            status: 'live',
            range,
            instagram: {
                followers: igAggregations.Followers || 0,
                following: igAggregations.Friends || 0,
                reach: igAggregations.reach || 0,
                views: igAggregations.views || 0,
                engaged: igAggregations.accounts_engaged || 0,
            },
            facebook: {
                likes: fbAggregations.facebookLikes || 0,
                reach: fbAggregations.dailyImpressionsUnique || 0,
                impressions: fbAggregations.dailyImpressions || 0,
                engagement: fbAggregations.dailyReactions || 0,
                clicks: fbAggregations.dailyClicks || 0,
            },
            topPosts: [...topIgPosts, ...topIgReels, ...topFbPosts],
            followersTimeline: followersData,
            reachTimeline: reachData,
        });
    } catch (error: any) {
        console.error('Social analytics error:', error);
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }
}

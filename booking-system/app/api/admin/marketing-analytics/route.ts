export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/admin/marketing-analytics
 * Returns marketing analytics data.
 * Query params: range=7d|30d|90d|custom, start=YYYY-MM-DD, end=YYYY-MM-DD
 *
 * Live integrations:
 * - Meta Ads: Uses Meta Marketing API with access token
 * - Google Ads: Uses Customer ID 370-832-5833 (requires Developer Token — currently mock)
 */

interface MetaCampaignInsight {
    campaign_name: string;
    campaign_id: string;
    impressions: string;
    clicks: string;
    spend: string;
    ctr: string;
    cpc: string;
    actions?: Array<{ action_type: string; value: string }>;
    date_start: string;
    date_stop: string;
}

interface MetaDailyInsight {
    impressions: string;
    clicks: string;
    spend: string;
    actions?: Array<{ action_type: string; value: string }>;
    date_start: string;
    date_stop: string;
}

function getDateRange(range: string, start?: string, end?: string): { since: string; until: string } {
    const endDate = end ? new Date(end) : new Date();
    let startDate: Date;

    if (range === 'custom' && start) {
        startDate = new Date(start);
    } else {
        const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - days);
    }

    return {
        since: startDate.toISOString().split('T')[0],
        until: endDate.toISOString().split('T')[0],
    };
}

async function fetchMetaAdsInsights(accountId: string, accessToken: string, since: string, until: string) {
    const baseUrl = `https://graph.facebook.com/v19.0/act_${accountId}/insights`;

    // 1. Fetch campaign-level data
    const campaignParams = new URLSearchParams({
        access_token: accessToken,
        time_range: JSON.stringify({ since, until }),
        level: 'campaign',
        fields: 'campaign_name,campaign_id,impressions,clicks,spend,ctr,cpc,actions',
        limit: '50',
    });

    let campaigns: MetaCampaignInsight[] = [];
    let permissionError: string | null = null;
    try {
        const campRes = await fetch(`${baseUrl}?${campaignParams.toString()}`);
        if (campRes.ok) {
            const campData = await campRes.json();
            campaigns = campData.data || [];
        } else {
            const errData = await campRes.json().catch(() => null);
            const errMsg = errData?.error?.message || `HTTP ${campRes.status}`;
            console.error('[Meta Ads] Campaign insights error:', errMsg);
            if (errMsg.includes('ads_management') || errMsg.includes('ads_read') || errMsg.includes('#200')) {
                permissionError = errMsg;
            }
        }
    } catch (err) {
        console.error('[Meta Ads] Campaign insights fetch error:', err);
    }

    // If permission error, return early with error info
    if (permissionError) {
        return { campaigns: [], dailyData: [], permissionError };
    }

    // 2. Fetch daily aggregate data
    const dailyParams = new URLSearchParams({
        access_token: accessToken,
        time_range: JSON.stringify({ since, until }),
        time_increment: '1',
        fields: 'impressions,clicks,spend,actions',
        limit: '100',
    });

    let dailyData: MetaDailyInsight[] = [];
    try {
        const dailyRes = await fetch(`${baseUrl}?${dailyParams.toString()}`);
        if (dailyRes.ok) {
            const data = await dailyRes.json();
            dailyData = data.data || [];

            // Handle pagination if needed
            let nextUrl = data.paging?.next;
            while (nextUrl) {
                const nextRes = await fetch(nextUrl);
                if (nextRes.ok) {
                    const nextData = await nextRes.json();
                    dailyData = [...dailyData, ...(nextData.data || [])];
                    nextUrl = nextData.paging?.next;
                } else {
                    break;
                }
            }
        } else {
            const errText = await dailyRes.text();
            console.error('[Meta Ads] Daily insights error:', dailyRes.status, errText);
        }
    } catch (err) {
        console.error('[Meta Ads] Daily insights fetch error:', err);
    }

    return { campaigns, dailyData, permissionError: null };
}

function getConversions(actions?: Array<{ action_type: string; value: string }>): number {
    if (!actions) return 0;
    // Count leads, purchases, and other conversion-type actions
    const conversionTypes = ['lead', 'purchase', 'complete_registration', 'schedule', 'contact', 'submit_application', 'offsite_conversion.fb_pixel_lead'];
    let total = 0;
    for (const action of actions) {
        if (conversionTypes.some(t => action.action_type.includes(t))) {
            total += parseInt(action.value) || 0;
        }
    }
    return total;
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '30d';
    const startParam = searchParams.get('start') || undefined;
    const endParam = searchParams.get('end') || undefined;
    const { since, until } = getDateRange(range, startParam, endParam);

    const metaAccountId = process.env.META_ADS_ACCOUNT_ID;
    const metaAccessToken = process.env.META_ADS_ACCESS_TOKEN;

    // If Meta credentials are configured, fetch live data
    if (metaAccountId && metaAccessToken) {
        try {
            const { campaigns, dailyData, permissionError } = await fetchMetaAdsInsights(metaAccountId, metaAccessToken, since, until);

            // If there's a permission error, return it clearly
            if (permissionError) {
                return NextResponse.json({
                    status: 'permission_error',
                    range,
                    since,
                    until,
                    error: permissionError,
                    message: 'The Meta access token needs ads_read permission. Regenerate the token in Meta Developer App with ads_read permission enabled.',
                    googleAdsCustomerId: process.env.GOOGLE_ADS_CUSTOMER_ID || '370-832-5833',
                });
            }

            // Transform campaign data
            const metaCampaigns = campaigns.map(c => ({
                id: `mc-${c.campaign_id}`,
                name: c.campaign_name,
                platform: 'meta_ads' as const,
                status: 'active' as const,
                budget: 0,
                metrics: {
                    impressions: parseInt(c.impressions) || 0,
                    clicks: parseInt(c.clicks) || 0,
                    ctr: parseFloat(c.ctr) || 0,
                    cost: parseFloat(c.spend) || 0,
                    cpc: parseFloat(c.cpc) || 0,
                    conversions: getConversions(c.actions),
                    cpa: 0,
                    roas: 0,
                },
            }));

            // Calculate CPA and ROAS for campaigns
            for (const camp of metaCampaigns) {
                camp.metrics.cpa = camp.metrics.conversions > 0 ? camp.metrics.cost / camp.metrics.conversions : 0;
                camp.metrics.roas = camp.metrics.cost > 0 ? (camp.metrics.conversions * 350) / camp.metrics.cost : 0;
            }

            // Transform daily data
            const metaDailyMetrics = dailyData.map(d => ({
                date: d.date_start,
                cost: parseFloat(d.spend) || 0,
                clicks: parseInt(d.clicks) || 0,
                conversions: getConversions(d.actions),
                impressions: parseInt(d.impressions) || 0,
            }));

            // Aggregate metrics
            const totalImpressions = metaDailyMetrics.reduce((sum, d) => sum + d.impressions, 0);
            const totalClicks = metaDailyMetrics.reduce((sum, d) => sum + d.clicks, 0);
            const totalCost = metaDailyMetrics.reduce((sum, d) => sum + d.cost, 0);
            const totalConversions = metaDailyMetrics.reduce((sum, d) => sum + d.conversions, 0);

            const metaAdsMetrics = {
                impressions: totalImpressions,
                clicks: totalClicks,
                ctr: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0,
                cost: Math.round(totalCost * 100) / 100,
                cpc: totalClicks > 0 ? Math.round((totalCost / totalClicks) * 100) / 100 : 0,
                conversions: totalConversions,
                cpa: totalConversions > 0 ? Math.round((totalCost / totalConversions) * 100) / 100 : 0,
                roas: totalCost > 0 ? Math.round(((totalConversions * 350) / totalCost) * 100) / 100 : 0,
            };

            return NextResponse.json({
                status: 'live',
                range,
                since,
                until,
                metaAdsMetrics,
                metaCampaigns,
                metaDailyMetrics,
                googleAdsCustomerId: process.env.GOOGLE_ADS_CUSTOMER_ID || '370-832-5833',
            });
        } catch (error) {
            console.error('[Marketing Analytics] Meta API error:', error);
            return NextResponse.json({
                status: 'error',
                error: 'Failed to fetch Meta Ads data',
                range,
                googleAdsCustomerId: process.env.GOOGLE_ADS_CUSTOMER_ID || '370-832-5833',
            }, { status: 500 });
        }
    }

    // No Meta credentials — return mock signal
    return NextResponse.json({
        status: 'mock',
        range,
        message: 'No Meta Ads credentials configured. Using client-side mock data.',
        googleAdsCustomerId: process.env.GOOGLE_ADS_CUSTOMER_ID || '370-832-5833',
    });
}

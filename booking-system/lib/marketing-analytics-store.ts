import { create } from 'zustand';

// ── Types ──

export type AdPlatform = 'google_ads' | 'meta_ads';

export interface AdMetrics {
    impressions: number;
    clicks: number;
    ctr: number;           // Click-through rate %
    cost: number;          // Total spend (AED)
    cpc: number;           // Cost per click
    conversions: number;   // Bookings attributed
    cpa: number;           // Cost per acquisition
    roas: number;          // Return on ad spend
}

export interface CampaignData {
    id: string;
    name: string;
    platform: AdPlatform;
    status: 'active' | 'paused' | 'ended';
    budget: number;
    metrics: AdMetrics;
}

export interface DailyMetric {
    date: string;   // YYYY-MM-DD
    googleAds: { cost: number; clicks: number; conversions: number; impressions: number };
    metaAds: { cost: number; clicks: number; conversions: number; impressions: number };
}

export interface MarketingState {
    googleAdsMetrics: AdMetrics;
    metaAdsMetrics: AdMetrics;
    campaigns: CampaignData[];
    dailyMetrics: DailyMetric[];
    dateRange: '7d' | '30d' | '90d' | 'custom';
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
    loading: boolean;

    setDateRange: (range: '7d' | '30d' | '90d') => void;
    setCustomDateRange: (startDate: string, endDate: string) => void;
    fetchMetrics: () => Promise<void>;
}

// ── Helper: generate daily mock data ──
function generateDailyData(days: number, endDate?: Date): DailyMetric[] {
    const data: DailyMetric[] = [];
    const end = endDate || new Date();
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(end);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];

        // Google Ads: higher volume, lower CPC
        const gClicks = Math.floor(40 + Math.random() * 60);
        const gImpressions = gClicks * (8 + Math.floor(Math.random() * 12));
        const gCost = gClicks * (1.2 + Math.random() * 0.8);
        const gConversions = Math.floor(gClicks * (0.06 + Math.random() * 0.04));

        // Meta Ads: moderate volume, slightly higher CPC
        const mClicks = Math.floor(25 + Math.random() * 45);
        const mImpressions = mClicks * (12 + Math.floor(Math.random() * 18));
        const mCost = mClicks * (1.5 + Math.random() * 1.0);
        const mConversions = Math.floor(mClicks * (0.05 + Math.random() * 0.05));

        data.push({
            date: dateStr,
            googleAds: { cost: Math.round(gCost * 100) / 100, clicks: gClicks, conversions: gConversions, impressions: gImpressions },
            metaAds: { cost: Math.round(mCost * 100) / 100, clicks: mClicks, conversions: mConversions, impressions: mImpressions },
        });
    }
    return data;
}

function aggregateMetrics(daily: DailyMetric[], platform: 'googleAds' | 'metaAds'): AdMetrics {
    let totalImpressions = 0, totalClicks = 0, totalCost = 0, totalConversions = 0;
    for (const d of daily) {
        const m = d[platform];
        totalImpressions += m.impressions;
        totalClicks += m.clicks;
        totalCost += m.cost;
        totalConversions += m.conversions;
    }
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const cpc = totalClicks > 0 ? totalCost / totalClicks : 0;
    const cpa = totalConversions > 0 ? totalCost / totalConversions : 0;
    // Assume average booking value of 350 AED
    const roas = totalCost > 0 ? (totalConversions * 350) / totalCost : 0;

    return {
        impressions: totalImpressions,
        clicks: totalClicks,
        ctr: Math.round(ctr * 100) / 100,
        cost: Math.round(totalCost * 100) / 100,
        cpc: Math.round(cpc * 100) / 100,
        conversions: totalConversions,
        cpa: Math.round(cpa * 100) / 100,
        roas: Math.round(roas * 100) / 100,
    };
}

// ── Mock Campaigns ──
const MOCK_CAMPAIGNS: CampaignData[] = [
    {
        id: 'gc-1', name: 'Dermatology Services Dubai', platform: 'google_ads', status: 'active', budget: 3000,
        metrics: { impressions: 42800, clicks: 1850, ctr: 4.32, cost: 2780, cpc: 1.50, conversions: 124, cpa: 22.42, roas: 15.61 },
    },
    {
        id: 'gc-2', name: 'Full Body Laser Hair Removal', platform: 'google_ads', status: 'active', budget: 2000,
        metrics: { impressions: 28400, clicks: 980, ctr: 3.45, cost: 1640, cpc: 1.67, conversions: 68, cpa: 24.12, roas: 14.51 },
    },
    {
        id: 'gc-3', name: 'Laser Clinic Brand', platform: 'google_ads', status: 'paused', budget: 1500,
        metrics: { impressions: 15200, clicks: 520, ctr: 3.42, cost: 890, cpc: 1.71, conversions: 31, cpa: 28.71, roas: 12.19 },
    },
    {
        id: 'mc-1', name: 'Instagram Beauty Treatments', platform: 'meta_ads', status: 'active', budget: 2500,
        metrics: { impressions: 68500, clicks: 1420, ctr: 2.07, cost: 2340, cpc: 1.65, conversions: 89, cpa: 26.29, roas: 13.31 },
    },
    {
        id: 'mc-2', name: 'Facebook PRP Hair Treatment', platform: 'meta_ads', status: 'active', budget: 1800,
        metrics: { impressions: 45200, clicks: 890, ctr: 1.97, cost: 1580, cpc: 1.78, conversions: 52, cpa: 30.38, roas: 11.52 },
    },
    {
        id: 'mc-3', name: 'Hydrafacial Awareness', platform: 'meta_ads', status: 'ended', budget: 1000,
        metrics: { impressions: 32100, clicks: 680, ctr: 2.12, cost: 980, cpc: 1.44, conversions: 38, cpa: 25.79, roas: 13.57 },
    },
];

// ── Store ──

export const useMarketingStore = create<MarketingState>((set, get) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const initialDaily = generateDailyData(30);

    return {
        googleAdsMetrics: aggregateMetrics(initialDaily, 'googleAds'),
        metaAdsMetrics: aggregateMetrics(initialDaily, 'metaAds'),
        campaigns: MOCK_CAMPAIGNS,
        dailyMetrics: initialDaily,
        dateRange: '30d',
        startDate: thirtyDaysAgo.toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0],
        loading: false,

        setDateRange: (range) => {
            const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
            const daily = generateDailyData(days);
            const end = new Date();
            const start = new Date(end);
            start.setDate(start.getDate() - days);
            set({
                dateRange: range,
                startDate: start.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0],
                dailyMetrics: daily,
                googleAdsMetrics: aggregateMetrics(daily, 'googleAds'),
                metaAdsMetrics: aggregateMetrics(daily, 'metaAds'),
            });
        },

        setCustomDateRange: (startDate, endDate) => {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const diffDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
            const daily = generateDailyData(diffDays, end);
            set({
                dateRange: 'custom',
                startDate,
                endDate,
                dailyMetrics: daily,
                googleAdsMetrics: aggregateMetrics(daily, 'googleAds'),
                metaAdsMetrics: aggregateMetrics(daily, 'metaAds'),
            });
        },

        fetchMetrics: async () => {
            set({ loading: true });
            try {
                const res = await fetch(`/api/admin/marketing-analytics?range=${get().dateRange}&start=${get().startDate}&end=${get().endDate}`);
                if (res.ok) {
                    const data = await res.json();

                    if (data.status === 'live' && data.metaAdsMetrics) {
                        // We have live Meta data — merge with mock Google Ads
                        const currentDaily = get().dailyMetrics;

                        // Build a daily lookup from Meta live data
                        const metaDailyMap = new Map<string, { cost: number; clicks: number; conversions: number; impressions: number }>();
                        if (data.metaDailyMetrics) {
                            for (const d of data.metaDailyMetrics) {
                                metaDailyMap.set(d.date, {
                                    cost: d.cost,
                                    clicks: d.clicks,
                                    conversions: d.conversions,
                                    impressions: d.impressions,
                                });
                            }
                        }

                        // Merge: keep mock Google Ads daily, replace Meta with live data
                        const mergedDaily = currentDaily.map(d => ({
                            ...d,
                            metaAds: metaDailyMap.get(d.date) || { cost: 0, clicks: 0, conversions: 0, impressions: 0 },
                        }));

                        // Keep mock Google campaigns, add live Meta campaigns
                        const googleCampaigns = get().campaigns.filter(c => c.platform === 'google_ads');
                        const liveCampaigns = data.metaCampaigns || [];
                        const allCampaigns = [...googleCampaigns, ...liveCampaigns];

                        set({
                            dailyMetrics: mergedDaily,
                            metaAdsMetrics: data.metaAdsMetrics,
                            googleAdsMetrics: aggregateMetrics(mergedDaily, 'googleAds'),
                            campaigns: allCampaigns,
                        });
                    } else if (data.dailyMetrics) {
                        // Full mock data from API
                        set({
                            dailyMetrics: data.dailyMetrics,
                            googleAdsMetrics: data.googleAdsMetrics || aggregateMetrics(data.dailyMetrics, 'googleAds'),
                            metaAdsMetrics: data.metaAdsMetrics || aggregateMetrics(data.dailyMetrics, 'metaAds'),
                            campaigns: data.campaigns || get().campaigns,
                        });
                    }
                    // else status === 'mock' — keep client-side mock data as-is
                }
            } catch {
                // Use mock data on error
            } finally {
                set({ loading: false });
            }
        },
    };
});

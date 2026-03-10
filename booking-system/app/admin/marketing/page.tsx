'use client';

import React, { useEffect, useState } from 'react';
import { useMarketingStore, AdMetrics, AdPlatform } from '@/lib/marketing-analytics-store';
import { TrendingUp, TrendingDown, DollarSign, MousePointerClick, Eye, Target, ArrowUpRight, ArrowDownRight, ChevronRight, CalendarDays } from 'lucide-react';

// ── Inline Mini Chart (SVG sparkline) ──
function Sparkline({ data, color, height = 40 }: { data: number[]; color: string; height?: number }) {
    if (data.length < 2) return null;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const w = 120;
    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = height - ((v - min) / range) * (height - 4) - 2;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg width={w} height={height} className="shrink-0">
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

// ── Bar Chart (SVG) ──
function BarChart({ googleData, metaData, labels, height = 200 }: {
    googleData: number[];
    metaData: number[];
    labels: string[];
    height?: number;
}) {
    const allData = [...googleData, ...metaData];
    const max = Math.max(...allData, 1);
    const barWidth = Math.max(4, Math.min(16, 600 / (labels.length * 3)));
    const gap = barWidth * 0.5;
    const groupWidth = barWidth * 2 + gap;
    const totalWidth = labels.length * (groupWidth + gap * 2);

    return (
        <div className="overflow-x-auto">
            <svg width={Math.max(totalWidth, 300)} height={height + 30} className="w-full">
                {labels.map((label, i) => {
                    const x = i * (groupWidth + gap * 2) + gap * 2;
                    const gH = (googleData[i] / max) * height;
                    const mH = (metaData[i] / max) * height;
                    return (
                        <g key={i}>
                            <rect x={x} y={height - gH} width={barWidth} height={gH} rx={2} fill="#4285F4" opacity={0.85} />
                            <rect x={x + barWidth + 2} y={height - mH} width={barWidth} height={mH} rx={2} fill="#1877F2" opacity={0.85} />
                            {i % Math.max(1, Math.floor(labels.length / 8)) === 0 && (
                                <text x={x + barWidth} y={height + 16} textAnchor="middle" className="fill-gray-400 text-[9px]">
                                    {label.slice(5)}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

// ── KPI Card ──
function KpiCard({ title, value, change, icon, color, prefix = '', suffix = '' }: {
    title: string;
    value: number | string;
    change?: number;
    icon: React.ReactNode;
    color: string;
    prefix?: string;
    suffix?: string;
}) {
    const isUp = (change ?? 0) >= 0;
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-lg transition-shadow duration-200">
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</span>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
                    {icon}
                </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
            </div>
            {change !== undefined && (
                <div className={`flex items-center gap-1 text-xs font-medium ${isUp ? 'text-emerald-600' : 'text-red-500'}`}>
                    {isUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {Math.abs(change).toFixed(1)}% vs prev period
                </div>
            )}
        </div>
    );
}

// ── Platform Badge ──
function PlatformBadge({ platform }: { platform: AdPlatform }) {
    if (platform === 'google_ads') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Google Ads
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="#1877F2">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            Meta Ads
        </span>
    );
}

// ── Status Badge ──
function StatusBadge({ status }: { status: string }) {
    const styles = {
        active: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        paused: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        ended: 'bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600',
    };
    return (
        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${styles[status as keyof typeof styles] || styles.ended}`}>
            {status}
        </span>
    );
}

// ── Metric comparison row ──
function ComparisonRow({ label, googleValue, metaValue, format: fmt = 'number' }: {
    label: string;
    googleValue: number;
    metaValue: number;
    format?: 'number' | 'currency' | 'percent' | 'ratio';
}) {
    const formatVal = (v: number) => {
        switch (fmt) {
            case 'currency': return `AED ${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
            case 'percent': return `${v.toFixed(2)}%`;
            case 'ratio': return `${v.toFixed(2)}x`;
            default: return v.toLocaleString();
        }
    };

    const googleWins = fmt === 'percent' || fmt === 'ratio'
        ? googleValue > metaValue
        : (label.includes('CPC') || label.includes('CPA') || label.includes('Cost'))
            ? googleValue < metaValue
            : googleValue > metaValue;

    return (
        <tr className="border-b border-gray-100 dark:border-gray-700/50 last:border-0">
            <td className="py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-300">{label}</td>
            <td className={`py-3 px-4 text-sm font-semibold text-right ${googleWins ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>
                {formatVal(googleValue)}
                {googleWins && <span className="ml-1 text-[10px]">✦</span>}
            </td>
            <td className={`py-3 px-4 text-sm font-semibold text-right ${!googleWins ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>
                {formatVal(metaValue)}
                {!googleWins && <span className="ml-1 text-[10px]">✦</span>}
            </td>
        </tr>
    );
}

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════

export default function MarketingAnalyticsPage() {
    const { googleAdsMetrics, metaAdsMetrics, campaigns, dailyMetrics, dateRange, startDate, endDate, setDateRange, setCustomDateRange, loading } = useMarketingStore();
    const [showCustom, setShowCustom] = useState(false);
    const [customStart, setCustomStart] = useState(startDate);
    const [customEnd, setCustomEnd] = useState(endDate);

    useEffect(() => {
        // Fetch live data whenever the date range changes
        useMarketingStore.getState().fetchMetrics();
    }, [dateRange, startDate, endDate]);

    // Sync local state when store dates change from preset buttons
    useEffect(() => {
        setCustomStart(startDate);
        setCustomEnd(endDate);
    }, [startDate, endDate]);

    const handleCustomApply = () => {
        if (customStart && customEnd && customStart <= customEnd) {
            setCustomDateRange(customStart, customEnd);
        }
    };

    const totalSpend = googleAdsMetrics.cost + metaAdsMetrics.cost;
    const totalClicks = googleAdsMetrics.clicks + metaAdsMetrics.clicks;
    const totalConversions = googleAdsMetrics.conversions + metaAdsMetrics.conversions;
    const totalCPA = totalConversions > 0 ? totalSpend / totalConversions : 0;

    const googleCampaigns = campaigns.filter(c => c.platform === 'google_ads');
    const metaCampaigns = campaigns.filter(c => c.platform === 'meta_ads');

    return (
        <div className="p-6 max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <TrendingUp className="w-6 h-6 text-indigo-600" />
                        Marketing Analytics
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Compare Google Ads & Meta Ads performance and track booking conversions.
                    </p>
                </div>
                <div className="flex items-center gap-2 mt-4 md:mt-0 flex-wrap">
                    {(['7d', '30d', '90d'] as const).map(range => (
                        <button
                            key={range}
                            onClick={() => { setDateRange(range); setShowCustom(false); }}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${dateRange === range
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-indigo-900/30'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            {range === '7d' ? '7D' : range === '30d' ? '30D' : '90D'}
                        </button>
                    ))}
                    <button
                        onClick={() => setShowCustom(!showCustom)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${dateRange === 'custom'
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-indigo-900/30'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                    >
                        <CalendarDays className="w-4 h-4" />
                        Custom
                    </button>
                </div>
            </div>

            {/* Custom Date Range Picker */}
            {showCustom && (
                <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex flex-wrap items-end gap-4">
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Start Date</label>
                        <input
                            type="date"
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                            max={customEnd}
                            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">End Date</label>
                        <input
                            type="date"
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            min={customStart}
                            max={new Date().toISOString().split('T')[0]}
                            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                        />
                    </div>
                    <button
                        onClick={handleCustomApply}
                        disabled={!customStart || !customEnd || customStart > customEnd}
                        className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                        Apply
                    </button>
                    {dateRange === 'custom' && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <CalendarDays className="w-3.5 h-3.5" />
                            {startDate} → {endDate} ({dailyMetrics.length} days)
                        </span>
                    )}
                </div>
            )}


            {loading && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                    Loading latest data...
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <KpiCard
                    title="Total Ad Spend"
                    value={totalSpend.toFixed(0)}
                    change={8.4}
                    prefix="AED "
                    icon={<DollarSign className="w-4 h-4 text-white" />}
                    color="bg-gradient-to-br from-emerald-500 to-emerald-600"
                />
                <KpiCard
                    title="Total Clicks"
                    value={totalClicks}
                    change={12.7}
                    icon={<MousePointerClick className="w-4 h-4 text-white" />}
                    color="bg-gradient-to-br from-blue-500 to-blue-600"
                />
                <KpiCard
                    title="Bookings from Ads"
                    value={totalConversions}
                    change={15.2}
                    icon={<Target className="w-4 h-4 text-white" />}
                    color="bg-gradient-to-br from-purple-500 to-purple-600"
                />
                <KpiCard
                    title="Cost per Booking"
                    value={totalCPA.toFixed(2)}
                    change={-3.1}
                    prefix="AED "
                    icon={<TrendingDown className="w-4 h-4 text-white" />}
                    color="bg-gradient-to-br from-amber-500 to-amber-600"
                />
            </div>

            {/* Charts + Platform Comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Spend Over Time Chart */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Ad Spend Over Time</h2>
                        <div className="flex items-center gap-4 text-[11px]">
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-1.5 rounded-full bg-[#4285F4]" /> Google Ads
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-1.5 rounded-full bg-[#1877F2]" /> Meta Ads
                            </span>
                        </div>
                    </div>
                    <BarChart
                        googleData={dailyMetrics.map(d => d.googleAds.cost)}
                        metaData={dailyMetrics.map(d => d.metaAds.cost)}
                        labels={dailyMetrics.map(d => d.date)}
                        height={180}
                    />
                </div>

                {/* Platform Comparison */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="p-5 border-b border-gray-100 dark:border-gray-700">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Platform Comparison</h2>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">✦ indicates better performer</p>
                    </div>
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-700/50">
                                <th className="py-2 px-4 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400">Metric</th>
                                <th className="py-2 px-4 text-right text-[11px] font-semibold text-blue-600">Google</th>
                                <th className="py-2 px-4 text-right text-[11px] font-semibold text-indigo-600">Meta</th>
                            </tr>
                        </thead>
                        <tbody>
                            <ComparisonRow label="Impressions" googleValue={googleAdsMetrics.impressions} metaValue={metaAdsMetrics.impressions} />
                            <ComparisonRow label="Clicks" googleValue={googleAdsMetrics.clicks} metaValue={metaAdsMetrics.clicks} />
                            <ComparisonRow label="CTR" googleValue={googleAdsMetrics.ctr} metaValue={metaAdsMetrics.ctr} format="percent" />
                            <ComparisonRow label="Total Cost" googleValue={googleAdsMetrics.cost} metaValue={metaAdsMetrics.cost} format="currency" />
                            <ComparisonRow label="CPC" googleValue={googleAdsMetrics.cpc} metaValue={metaAdsMetrics.cpc} format="currency" />
                            <ComparisonRow label="Bookings" googleValue={googleAdsMetrics.conversions} metaValue={metaAdsMetrics.conversions} />
                            <ComparisonRow label="CPA" googleValue={googleAdsMetrics.cpa} metaValue={metaAdsMetrics.cpa} format="currency" />
                            <ComparisonRow label="ROAS" googleValue={googleAdsMetrics.roas} metaValue={metaAdsMetrics.roas} format="ratio" />
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Conversion Trend */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Google Ads Trend */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Google Ads Bookings</h2>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{googleAdsMetrics.conversions}</p>
                        </div>
                        <Sparkline data={dailyMetrics.map(d => d.googleAds.conversions)} color="#4285F4" height={50} />
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <div>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">Spend</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">AED {googleAdsMetrics.cost.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">CPA</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">AED {googleAdsMetrics.cpa.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">ROAS</p>
                            <p className="text-sm font-semibold text-emerald-600">{googleAdsMetrics.roas.toFixed(2)}x</p>
                        </div>
                    </div>
                </div>

                {/* Meta Ads Trend */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Meta Ads Bookings</h2>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{metaAdsMetrics.conversions}</p>
                        </div>
                        <Sparkline data={dailyMetrics.map(d => d.metaAds.conversions)} color="#1877F2" height={50} />
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <div>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">Spend</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">AED {metaAdsMetrics.cost.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">CPA</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">AED {metaAdsMetrics.cpa.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">ROAS</p>
                            <p className="text-sm font-semibold text-emerald-600">{metaAdsMetrics.roas.toFixed(2)}x</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Campaign Breakdown */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-8">
                <div className="p-5 border-b border-gray-100 dark:border-gray-700">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Campaign Breakdown</h2>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Performance by individual campaign</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-700/50 text-left">
                                <th className="py-3 px-5 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Campaign</th>
                                <th className="py-3 px-3 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Platform</th>
                                <th className="py-3 px-3 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="py-3 px-3 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Impressions</th>
                                <th className="py-3 px-3 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Clicks</th>
                                <th className="py-3 px-3 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">CTR</th>
                                <th className="py-3 px-3 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Spend</th>
                                <th className="py-3 px-3 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">CPC</th>
                                <th className="py-3 px-3 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Bookings</th>
                                <th className="py-3 px-3 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">CPA</th>
                                <th className="py-3 px-3 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">ROAS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {campaigns.map(c => (
                                <tr key={c.id} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="py-3 px-5">
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">{c.name}</span>
                                    </td>
                                    <td className="py-3 px-3"><PlatformBadge platform={c.platform} /></td>
                                    <td className="py-3 px-3"><StatusBadge status={c.status} /></td>
                                    <td className="py-3 px-3 text-sm text-right text-gray-700 dark:text-gray-300">{c.metrics.impressions.toLocaleString()}</td>
                                    <td className="py-3 px-3 text-sm text-right text-gray-700 dark:text-gray-300">{c.metrics.clicks.toLocaleString()}</td>
                                    <td className="py-3 px-3 text-sm text-right text-gray-700 dark:text-gray-300">{c.metrics.ctr.toFixed(2)}%</td>
                                    <td className="py-3 px-3 text-sm text-right font-medium text-gray-900 dark:text-white">AED {c.metrics.cost.toLocaleString()}</td>
                                    <td className="py-3 px-3 text-sm text-right text-gray-700 dark:text-gray-300">AED {c.metrics.cpc.toFixed(2)}</td>
                                    <td className="py-3 px-3 text-sm text-right font-semibold text-purple-600 dark:text-purple-400">{c.metrics.conversions}</td>
                                    <td className="py-3 px-3 text-sm text-right text-gray-700 dark:text-gray-300">AED {c.metrics.cpa.toFixed(2)}</td>
                                    <td className="py-3 px-3 text-sm text-right font-semibold text-emerald-600">{c.metrics.roas.toFixed(2)}x</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Booking Attribution */}
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl p-6 text-white">
                <h2 className="text-sm font-semibold opacity-80 uppercase tracking-wider mb-4">Booking Attribution Insight</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <p className="text-3xl font-bold">{totalConversions}</p>
                        <p className="text-sm opacity-70 mt-1">Total bookings from ads</p>
                    </div>
                    <div>
                        <p className="text-3xl font-bold">AED {(totalConversions * 350).toLocaleString()}</p>
                        <p className="text-sm opacity-70 mt-1">Estimated revenue from ad bookings</p>
                    </div>
                    <div>
                        <p className="text-3xl font-bold">{((totalConversions * 350) / totalSpend).toFixed(1)}x</p>
                        <p className="text-sm opacity-70 mt-1">Overall return on ad spend</p>
                    </div>
                </div>
                <div className="mt-6 pt-4 border-t border-white/20 flex items-center gap-2 text-sm opacity-70">
                    <Eye className="w-4 h-4" />
                    <span>Based on average booking value of AED 350. Connect Google Ads API for actual conversion tracking.</span>
                </div>
            </div>
        </div>
    );
}

'use client';

import React, { useEffect, useState } from 'react';
import { Instagram, Facebook, Eye, Users, Heart, TrendingUp, ExternalLink, MessageCircle, Share2, Bookmark, BarChart3 } from 'lucide-react';

interface SocialPost {
    id: string;
    platform: string;
    type: string;
    content: string;
    imageUrl: string;
    url: string;
    likes: number;
    comments: number;
    shares: number;
    saved: number;
    engagement: number;
    impressions: number;
    reach: number;
    views: number;
    date: string;
    spend: number;
}

interface SocialData {
    status: string;
    instagram: { followers: number; following: number; reach: number; views: number; engaged: number };
    facebook: { likes: number; reach: number; impressions: number; engagement: number; clicks: number };
    topPosts: SocialPost[];
}

export default function SocialAnalyticsPage() {
    const [data, setData] = useState<SocialData | null>(null);
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState('30d');
    const [platformFilter, setPlatformFilter] = useState<'all' | 'instagram' | 'facebook'>('all');

    useEffect(() => {
        setLoading(true);
        fetch(`/api/admin/social-analytics?range=${range}`)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, [range]);

    const fmt = (n: number) => {
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
        if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
        return n.toLocaleString();
    };

    const filteredPosts = data?.topPosts?.filter(p => platformFilter === 'all' || p.platform === platformFilter) || [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <BarChart3 className="w-7 h-7 text-indigo-500" />
                        Social Media Analytics
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Live data from Metricool — Instagram &amp; Facebook</p>
                </div>
                <div className="flex gap-2">
                    {(['7d', '30d', '90d'] as const).map(r => (
                        <button
                            key={r}
                            onClick={() => setRange(r)}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${range === r
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                                }`}
                        >
                            {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : '90 Days'}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
                </div>
            ) : !data || data.status === 'error' ? (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-red-700 dark:text-red-300">
                    Failed to load social analytics. Check Metricool API configuration.
                </div>
            ) : (
                <>
                    {/* Instagram KPI Cards */}
                    <div>
                        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Instagram className="w-4 h-4 text-pink-500" /> Instagram
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {[
                                { label: 'Followers', value: data.instagram.followers, icon: Users, color: 'text-pink-600 bg-pink-50 dark:bg-pink-900/20' },
                                { label: 'Reach', value: data.instagram.reach, icon: Eye, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20' },
                                { label: 'Views', value: data.instagram.views, icon: TrendingUp, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
                                { label: 'Following', value: data.instagram.following, icon: Users, color: 'text-teal-600 bg-teal-50 dark:bg-teal-900/20' },
                                { label: 'Engaged', value: data.instagram.engaged, icon: Heart, color: 'text-red-600 bg-red-50 dark:bg-red-900/20' },
                            ].map(kpi => (
                                <div key={kpi.label} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-shadow">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{kpi.label}</span>
                                        <div className={`p-1.5 rounded-lg ${kpi.color}`}><kpi.icon className="w-3.5 h-3.5" /></div>
                                    </div>
                                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{fmt(kpi.value)}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Facebook KPI Cards */}
                    <div>
                        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Facebook className="w-4 h-4 text-blue-600" /> Facebook
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {[
                                { label: 'Page Likes', value: data.facebook.likes, icon: Heart, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
                                { label: 'Reach', value: data.facebook.reach, icon: Eye, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' },
                                { label: 'Impressions', value: data.facebook.impressions, icon: TrendingUp, color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20' },
                                { label: 'Reactions', value: data.facebook.engagement, icon: Heart, color: 'text-pink-600 bg-pink-50 dark:bg-pink-900/20' },
                                { label: 'Clicks', value: data.facebook.clicks, icon: ExternalLink, color: 'text-green-600 bg-green-50 dark:bg-green-900/20' },
                            ].map(kpi => (
                                <div key={kpi.label} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-shadow">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{kpi.label}</span>
                                        <div className={`p-1.5 rounded-lg ${kpi.color}`}><kpi.icon className="w-3.5 h-3.5" /></div>
                                    </div>
                                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{fmt(kpi.value)}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Top Posts Section */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Top Performing Posts</h2>
                            <div className="flex gap-1.5">
                                {(['all', 'instagram', 'facebook'] as const).map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setPlatformFilter(f)}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${platformFilter === f
                                            ? f === 'instagram' ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'
                                                : f === 'facebook' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                                    : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400'
                                            }`}
                                    >
                                        {f === 'all' ? 'All' : f === 'instagram' ? '📸 Instagram' : '📘 Facebook'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {filteredPosts.length === 0 ? (
                            <div className="p-10 text-center text-gray-400">No posts found for this period.</div>
                        ) : (
                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filteredPosts.map((post, i) => (
                                    <div key={post.id || i} className="p-4 flex gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        {/* Thumbnail */}
                                        <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                                            {post.imageUrl ? (
                                                <img src={post.imageUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                    {post.platform === 'instagram' ? <Instagram className="w-6 h-6" /> : <Facebook className="w-6 h-6" />}
                                                </div>
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded uppercase ${post.platform === 'instagram' ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                                                    {post.platform}
                                                </span>
                                                <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 uppercase">
                                                    {post.type?.replace('FEED_', '').replace('_', ' ')}
                                                </span>
                                                <span className="text-[11px] text-gray-400">{post.date}</span>
                                                {post.url && (
                                                    <a href={post.url} target="_blank" rel="noopener noreferrer" className="ml-auto text-gray-400 hover:text-indigo-500">
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                    </a>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{post.content || '(no caption)'}</p>
                                        </div>

                                        {/* Metrics */}
                                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                                            <div className="flex flex-col items-center gap-0.5" title="Likes">
                                                <Heart className="w-3.5 h-3.5 text-red-400" />
                                                <span className="font-semibold text-gray-700 dark:text-gray-200">{fmt(post.likes)}</span>
                                            </div>
                                            <div className="flex flex-col items-center gap-0.5" title="Comments">
                                                <MessageCircle className="w-3.5 h-3.5 text-blue-400" />
                                                <span className="font-semibold text-gray-700 dark:text-gray-200">{fmt(post.comments)}</span>
                                            </div>
                                            <div className="flex flex-col items-center gap-0.5" title="Shares">
                                                <Share2 className="w-3.5 h-3.5 text-green-400" />
                                                <span className="font-semibold text-gray-700 dark:text-gray-200">{fmt(post.shares)}</span>
                                            </div>
                                            {post.saved > 0 && (
                                                <div className="flex flex-col items-center gap-0.5" title="Saved">
                                                    <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                                                    <span className="font-semibold text-gray-700 dark:text-gray-200">{fmt(post.saved)}</span>
                                                </div>
                                            )}
                                            <div className="flex flex-col items-center gap-0.5 pl-2 border-l border-gray-200 dark:border-gray-600" title="Reach">
                                                <Eye className="w-3.5 h-3.5 text-purple-400" />
                                                <span className="font-semibold text-gray-700 dark:text-gray-200">{fmt(post.reach)}</span>
                                            </div>
                                            <div className="flex flex-col items-center gap-0.5" title="Engagement %">
                                                <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                                                <span className="font-semibold text-gray-700 dark:text-gray-200">{post.engagement.toFixed(1)}%</span>
                                            </div>
                                            {post.spend > 0 && (
                                                <div className="flex flex-col items-center gap-0.5 pl-2 border-l border-gray-200 dark:border-gray-600" title="Ad Spend">
                                                    <span className="text-[10px] text-amber-500">💰</span>
                                                    <span className="font-semibold text-amber-600 dark:text-amber-400">AED {fmt(post.spend)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

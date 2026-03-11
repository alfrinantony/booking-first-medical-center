'use client';

import React, { useState, useEffect } from 'react';
import { useInboxStore } from '@/lib/inbox-store';
import { Platform, GoogleReviewConversation, Conversation } from '@/types/inbox';
import { Send, Search, Facebook, Instagram, Phone, MoreVertical, Star, Clock, Bot, MapPin, Linkedin, MessageCircle, MessageSquare, Lock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

// Platforms not yet connected
const COMING_SOON_PLATFORMS: Platform[] = ['whatsapp', 'tiktok', 'linkedin'];

// Google "G" icon SVG component
function GoogleIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.44 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
    );
}

// TikTok icon SVG component
function TikTokIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.18a8.16 8.16 0 004.76 1.52V7.25a4.82 4.82 0 01-1-.56z" />
        </svg>
    );
}

// Star rating display component
function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
    const sizeClass = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(i => (
                <Star
                    key={i}
                    className={`${sizeClass} ${i <= rating
                        ? 'fill-amber-400 text-amber-400'
                        : 'fill-gray-200 text-gray-200 dark:fill-gray-600 dark:text-gray-600'
                        }`}
                />
            ))}
        </div>
    );
}

// Helper to check if a conversation is a Google Review
function isGoogleReview(conversation: Conversation): conversation is GoogleReviewConversation {
    return conversation.platform === 'google_reviews';
}

export default function UnifiedInbox() {
    const {
        conversations,
        activeConversationId,
        messages,
        filter,
        setFilter,
        setActiveConversation,
        sendMessage,
        fetchSocialInbox,
        socialInboxLoading,
    } = useInboxStore();
    const { loadMoreConversations, fbNextCursor, igNextCursor, loadingMore } = useInboxStore();

    const [replyText, setReplyText] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        // Load all social inbox conversations from Metricool
        fetchSocialInbox();
    }, [fetchSocialInbox]);

    if (!isClient) return <div className="p-8">Loading inbox...</div>;

    const isComingSoon = COMING_SOON_PLATFORMS.includes(filter as Platform);

    const filteredConversations = conversations?.filter(c => {
        const matchesFilter = filter === 'all' || c.platform === filter;
        const matchesSearch = c.participants.some(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesFilter && matchesSearch;
    });

    const activeConversation = conversations.find(c => c.id === activeConversationId);
    const activeMessages = activeConversationId ? messages[activeConversationId] || [] : [];

    // Sort messages by timestamp
    const sortedMessages = [...activeMessages].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyText.trim() || !activeConversationId) return;

        sendMessage(activeConversationId, replyText);
        setReplyText('');
    };

    const getPlatformIcon = (platform: Platform) => {
        switch (platform) {
            case 'facebook': return <Facebook className="w-4 h-4 text-blue-600" />;
            case 'instagram': return <Instagram className="w-4 h-4 text-pink-600" />;
            case 'whatsapp': return <Phone className="w-4 h-4 text-green-600" />;
            case 'google_reviews': return <GoogleIcon className="w-4 h-4" />;
            case 'tiktok': return <TikTokIcon className="w-4 h-4" />;
            case 'linkedin': return <Linkedin className="w-4 h-4 text-blue-700" />;
        }
    };

    const getPlatformLabel = (platform: Platform) => {
        switch (platform) {
            case 'facebook': return 'Facebook';
            case 'instagram': return 'Instagram';
            case 'whatsapp': return 'WhatsApp';
            case 'google_reviews': return 'Google Reviews';
            case 'tiktok': return 'TikTok';
            case 'linkedin': return 'LinkedIn';
        }
    };

    // Get auto-reply countdown for a Google review
    const getAutoReplyInfo = (conv: GoogleReviewConversation) => {
        if (conv.replyStatus === 'replied') return null;
        if (conv.replyStatus === 'auto_replied') return { label: 'Auto-replied', color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/30' };

        if (conv.autoReplyScheduledAt) {
            const scheduledTime = new Date(conv.autoReplyScheduledAt).getTime();
            const now = Date.now();

            if (now >= scheduledTime) {
                return { label: 'Auto-reply pending…', color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/30' };
            }

            const remaining = formatDistanceToNow(new Date(conv.autoReplyScheduledAt), { addSuffix: false });
            return { label: `Auto-reply in ${remaining}`, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30' };
        }

        return { label: 'Awaiting reply', color: 'text-red-600 bg-red-50 dark:bg-red-900/30' };
    };

    // Count Google review conversations
    const googleReviewCount = conversations.filter(c => c.platform === 'google_reviews').length;
    const unrepliedGoogleCount = conversations.filter(
        c => c.platform === 'google_reviews' && isGoogleReview(c) && c.replyStatus === 'unreplied'
    ).length;

    // Platform tab configuration
    const platformTabs: { key: Platform | 'all'; label: string; icon: React.ReactNode; color: string; activeColor: string }[] = [
        { key: 'all', label: 'All', icon: <MessageCircle className="w-4 h-4" />, color: 'text-gray-600 dark:text-gray-400', activeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-500' },
        { key: 'whatsapp', label: 'WhatsApp', icon: <Phone className="w-4 h-4" />, color: 'text-green-600', activeColor: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-500' },
        { key: 'instagram', label: 'Instagram', icon: <Instagram className="w-4 h-4" />, color: 'text-pink-600', activeColor: 'bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 border-pink-500' },
        { key: 'facebook', label: 'Facebook', icon: <Facebook className="w-4 h-4" />, color: 'text-blue-600', activeColor: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-500' },
        { key: 'tiktok', label: 'TikTok', icon: <TikTokIcon className="w-4 h-4" />, color: 'text-gray-900 dark:text-gray-100', activeColor: 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100 border-gray-800' },
        { key: 'linkedin', label: 'LinkedIn', icon: <Linkedin className="w-4 h-4" />, color: 'text-blue-700', activeColor: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border-sky-600' },
        { key: 'google_reviews', label: 'Reviews', icon: <GoogleIcon className="w-4 h-4" />, color: 'text-amber-600', activeColor: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-500' },
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)]">
            {/* Platform Tabs */}
            <div className="flex items-center gap-1.5 px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                {platformTabs.map(tab => {
                    const count = tab.key === 'all'
                        ? conversations.filter(c => c.unreadCount > 0).length
                        : conversations.filter(c => c.platform === tab.key && c.unreadCount > 0).length;
                    const totalCount = tab.key === 'all'
                        ? conversations.length
                        : conversations.filter(c => c.platform === tab.key).length;
                    const isActive = filter === tab.key;

                    const isComingSoonTab = COMING_SOON_PLATFORMS.includes(tab.key as Platform);

                    return (
                        <button
                            key={tab.key}
                            onClick={() => setFilter(tab.key as Platform | 'all')}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap border-b-2 ${isActive
                                ? tab.activeColor
                                : `bg-gray-50 dark:bg-gray-700/50 ${tab.color} hover:bg-gray-100 dark:hover:bg-gray-700 border-transparent`
                                } ${isComingSoonTab ? 'opacity-60' : ''}`}
                        >
                            {tab.icon}
                            <span>{tab.label}</span>
                            {isComingSoonTab ? (
                                <Lock className="w-3 h-3 text-gray-400" />
                            ) : count > 0 ? (
                                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                                    {count}
                                </span>
                            ) : totalCount > 0 ? (
                                <span className="text-[10px] text-gray-400 dark:text-gray-500">{totalCount}</span>
                            ) : null}
                        </button>
                    );
                })}
            </div>

            <div className="flex flex-1 bg-white dark:bg-gray-800 rounded-b-lg shadow overflow-hidden">
                {/* Sidebar - Conversation List */}
                <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 flex flex-col">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder={`Search ${filter === 'all' ? 'all messages' : getPlatformLabel(filter as Platform)}...`}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-200"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {/* Coming Soon overlay for disconnected platforms */}
                        {isComingSoon ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                                    <Lock className="w-8 h-8 text-gray-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Coming Soon</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
                                    {filter === 'whatsapp' && 'WhatsApp Business integration is coming soon. Stay tuned!'}
                                    {filter === 'tiktok' && 'TikTok inbox integration is planned for a future update.'}
                                    {filter === 'linkedin' && 'LinkedIn messaging will be available in a future update.'}
                                </p>
                                <span className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                    <Clock className="w-3.5 h-3.5" />
                                    Not Connected
                                </span>
                            </div>
                        ) : socialInboxLoading ? (
                            <div className="flex-1 flex items-center justify-center p-8">
                                <div className="animate-pulse text-gray-400">Loading conversations...</div>
                            </div>
                        ) : (
                            <>
                                {filteredConversations.map(conversation => {
                                    const isGR = isGoogleReview(conversation);
                                    const autoReplyInfo = isGR ? getAutoReplyInfo(conversation) : null;

                                    return (
                                        <div
                                            key={conversation.id}
                                            onClick={() => setActiveConversation(conversation.id)}
                                            className={`p-4 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${activeConversationId === conversation.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-l-indigo-500' : 'border-l-4 border-l-transparent'
                                                }`}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                                    <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">{conversation.participants[0].name}</h3>
                                                    {getPlatformIcon(conversation.platform)}
                                                </div>
                                                <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                                                    {format(new Date(conversation.lastMessage.timestamp), 'MMM d, h:mm a')}
                                                </span>
                                            </div>

                                            {/* Google Review: show star rating + branch */}
                                            {isGR && (
                                                <div className="flex items-center gap-2 mb-1">
                                                    <StarRating rating={conversation.starRating} />
                                                    <span className="text-xs text-gray-400 flex items-center gap-0.5">
                                                        <MapPin className="w-3 h-3" />
                                                        {conversation.clinicName.replace(' Branch', '')}
                                                    </span>
                                                </div>
                                            )}

                                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
                                                {conversation.messageType === 'dm' && (
                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded text-[9px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 shrink-0">
                                                        <MessageSquare className="w-2.5 h-2.5" /> DM
                                                    </span>
                                                )}
                                                {conversation.messageType === 'comment' && (
                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded text-[9px] font-bold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 shrink-0">
                                                        Comment
                                                    </span>
                                                )}
                                                <span className="truncate">{conversation.lastMessage.content}</span>
                                            </p>

                                            {/* Google Review: auto-reply status badge */}
                                            {isGR && autoReplyInfo && (
                                                <div className={`mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${autoReplyInfo.color}`}>
                                                    {conversation.replyStatus === 'auto_replied' ? (
                                                        <Bot className="w-3 h-3" />
                                                    ) : (
                                                        <Clock className="w-3 h-3" />
                                                    )}
                                                    {autoReplyInfo.label}
                                                </div>
                                            )}

                                            {/* Unread badge for non-Google conversations */}
                                            {!isGR && conversation.unreadCount > 0 && (
                                                <span className="mt-1 inline-flex items-center justify-center w-5 h-5 bg-indigo-600 text-white text-[10px] rounded-full font-bold">
                                                    {conversation.unreadCount}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                                {filteredConversations.length === 0 && (
                                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                        No conversations found
                                    </div>
                                )}
                                {/* Load More button for DM conversations */}
                                {(fbNextCursor || igNextCursor) && (filter === 'all' || filter === 'facebook' || filter === 'instagram') && (
                                    <div className="p-3 border-t border-gray-100 dark:border-gray-700">
                                        <button
                                            onClick={loadMoreConversations}
                                            disabled={loadingMore}
                                            className="w-full py-2.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            {loadingMore ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                                                    Loading...
                                                </>
                                            ) : (
                                                'Load More Conversations'
                                            )}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900">
                    {activeConversationId && activeConversation ? (
                        <>
                            {/* Chat Header */}
                            <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${isGoogleReview(activeConversation)
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-indigo-100 text-indigo-700'
                                        }`}>
                                        {activeConversation.participants[0].name.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                            {activeConversation.participants[0].name}
                                            {getPlatformIcon(activeConversation.platform)}
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                                via {getPlatformLabel(activeConversation.platform)}
                                                {activeConversation.messageType === 'dm' && (
                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                                        <MessageSquare className="w-3 h-3" /> DM
                                                    </span>
                                                )}
                                            </span>
                                            {isGoogleReview(activeConversation) && (
                                                <>
                                                    <span className="text-xs text-gray-300 dark:text-gray-600">|</span>
                                                    <StarRating rating={activeConversation.starRating} size="sm" />
                                                    <span className="text-xs text-gray-400 flex items-center gap-0.5">
                                                        <MapPin className="w-3 h-3" />
                                                        {activeConversation.clinicName}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Auto-reply status badge in header */}
                                    {isGoogleReview(activeConversation) && (() => {
                                        const info = getAutoReplyInfo(activeConversation);
                                        if (!info) return null;
                                        return (
                                            <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${info.color}`}>
                                                {activeConversation.replyStatus === 'auto_replied' ? (
                                                    <Bot className="w-3.5 h-3.5" />
                                                ) : (
                                                    <Clock className="w-3.5 h-3.5" />
                                                )}
                                                {info.label}
                                            </div>
                                        );
                                    })()}
                                    <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                        <MoreVertical className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Chat Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {/* Show review context banner for Google Reviews */}
                                {isGoogleReview(activeConversation) && (
                                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <GoogleIcon className="w-4 h-4" />
                                            <span className="text-sm font-medium text-amber-800 dark:text-amber-300">Google Review</span>
                                            <span className="text-xs text-amber-600 dark:text-amber-400">
                                                • {activeConversation.clinicName}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <StarRating rating={activeConversation.starRating} size="md" />
                                            <span className="text-xs text-amber-600 dark:text-amber-400">
                                                {activeConversation.starRating}/5 stars
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {sortedMessages.map((msg) => {
                                    const isStaff = msg.isFromStaff;
                                    return (
                                        <div key={msg.id} className={`flex ${isStaff ? 'justify-end' : 'justify-start'}`}>
                                            <div
                                                className={`max-w-[70%] rounded-lg px-4 py-2 text-sm ${isStaff
                                                    ? msg.isAutoReply
                                                        ? 'bg-purple-600 text-white rounded-br-none'
                                                        : 'bg-indigo-600 text-white rounded-br-none'
                                                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-bl-none shadow-sm'
                                                    }`}
                                            >
                                                {/* Staff name badge */}
                                                {isStaff && !msg.isAutoReply && msg.repliedByUserName && (
                                                    <div className="text-[10px] font-semibold text-indigo-200 mb-0.5 opacity-90">
                                                        {msg.repliedByUserName}
                                                    </div>
                                                )}
                                                {/* Auto-reply badge */}
                                                {msg.isAutoReply && (
                                                    <div className="flex items-center gap-1 mb-1 text-[10px] text-purple-200 opacity-80">
                                                        <Bot className="w-3 h-3" />
                                                        AI Auto-Reply
                                                    </div>
                                                )}
                                                <p>{msg.content}</p>
                                                <div className={`text-[10px] mt-1 text-right ${isStaff ? (msg.isAutoReply ? 'text-purple-200' : 'text-indigo-200') : 'text-gray-400'}`}>
                                                    {format(new Date(msg.timestamp), 'h:mm a')}
                                                    {isStaff && msg.repliedByUserName && !msg.isAutoReply && (
                                                        <span className="ml-1 opacity-70">• {msg.repliedByUserName}</span>
                                                    )}
                                                    {isStaff && (
                                                        <span className="ml-1 opacity-70">
                                                            {msg.status === 'read' ? '✓✓' : '✓'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                            </div>

                            {/* Input Area */}
                            <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                                {isGoogleReview(activeConversation) && activeConversation.replyStatus !== 'unreplied' && (
                                    <div className="mb-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                        {activeConversation.replyStatus === 'auto_replied' ? (
                                            <>
                                                <Bot className="w-3 h-3 text-purple-500" />
                                                This review was auto-replied. You can still send a manual reply.
                                            </>
                                        ) : (
                                            <>✓ This review has been replied to.</>
                                        )}
                                    </div>
                                )}
                                <form onSubmit={handleSendMessage} className="flex gap-2">
                                    <input
                                        type="text"
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        placeholder={
                                            isGoogleReview(activeConversation)
                                                ? 'Reply to this Google review...'
                                                : 'Type a reply...'
                                        }
                                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!replyText.trim()}
                                        className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                                <Send className="w-8 h-8 opacity-50" />
                            </div>
                            <p>Select a conversation to start messaging</p>
                            {googleReviewCount > 0 && (
                                <p className="text-sm mt-2 text-gray-300 flex items-center gap-1">
                                    <GoogleIcon className="w-4 h-4" />
                                    {googleReviewCount} Google review{googleReviewCount !== 1 ? 's' : ''} in inbox
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

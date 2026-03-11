import { create } from 'zustand';
import { Conversation, Message, Platform, GoogleReviewConversation } from '@/types/inbox';

interface InboxState {
    conversations: Conversation[];
    activeConversationId: string | null;
    messages: Record<string, Message[]>; // conversationId -> messages
    filter: Platform | 'all';
    socialInboxLoaded: boolean;
    socialInboxLoading: boolean;
    // Pagination cursors for Meta DMs
    fbNextCursor: string | null;
    igNextCursor: string | null;
    loadingMore: boolean;

    // Actions
    setFilter: (filter: Platform | 'all') => void;
    setActiveConversation: (conversationId: string) => void;
    sendMessage: (conversationId: string, content: string) => void;
    receiveMessage: (message: Message) => void;
    fetchSocialInbox: () => Promise<void>;
    loadMoreConversations: () => Promise<void>;
    // Legacy — kept for backward compat
    fetchGoogleReviewConversations: () => Promise<void>;
    replyToGoogleReview: (reviewId: string, content: string) => Promise<void>;
}

// Helper to get logged-in admin user from session
function getLoggedInUser(): { id: string; name: string } {
    if (typeof window === 'undefined') return { id: 'staff_unknown', name: 'Staff' };
    try {
        const raw = sessionStorage.getItem('adminUser');
        if (raw) {
            const user = JSON.parse(raw);
            return { id: user.id || 'staff_unknown', name: user.name || 'Staff' };
        }
    } catch { /* ignore */ }
    return { id: 'staff_unknown', name: 'Staff' };
}

export const useInboxStore = create<InboxState>((set, get) => ({
    conversations: [],
    activeConversationId: null,
    messages: {},
    filter: 'all',
    socialInboxLoaded: false,
    socialInboxLoading: false,
    fbNextCursor: null,
    igNextCursor: null,
    loadingMore: false,

    setFilter: (filter) => set({ filter }),

    setActiveConversation: (conversationId) => {
        set({ activeConversationId: conversationId });

        // Lazy-load messages for DM conversations that haven't been fetched yet
        const state = get();
        const conversation = state.conversations.find(c => c.id === conversationId);
        if (
            conversation &&
            conversation.messageType === 'dm' &&
            (!state.messages[conversationId] || state.messages[conversationId].length === 0)
        ) {
            // Extract the Graph API conversation ID from the store ID (e.g., "fb-dm-t_123" -> "t_123")
            const graphConvId = (conversation as any).graphConversationId;
            if (graphConvId) {
                fetch(`/api/admin/meta-dms?conversationId=${graphConvId}&platform=${conversation.platform}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.messages && data.messages.length > 0) {
                            const mapped = data.messages.map((m: any) => ({
                                id: m.id,
                                conversationId,
                                senderId: m.from || `user-${conversationId}`,
                                senderName: m.fromName || conversation.participants[0]?.name || 'Unknown',
                                content: m.message,
                                timestamp: m.timestamp,
                                platform: conversation.platform,
                                isFromStaff: m.isFromPage,
                                status: 'read' as const,
                            }));
                            set((s) => ({
                                messages: { ...s.messages, [conversationId]: mapped },
                            }));
                        }
                    })
                    .catch(err => console.error('[Inbox] Error lazy-loading messages:', err));
            }
        }
    },

    sendMessage: (conversationId, content) => {
        const conversation = get().conversations.find(c => c.id === conversationId);
        if (!conversation) return;

        // Route Google reviews through dedicated handler
        if (conversation.platform === 'google_reviews') {
            get().replyToGoogleReview(conversationId, content);
            return;
        }

        const currentUser = getLoggedInUser();
        const newMessage: Message = {
            id: `msg_${Date.now()}`,
            conversationId,
            senderId: currentUser.id,
            senderName: currentUser.name,
            content,
            timestamp: new Date().toISOString(),
            platform: conversation.platform || 'whatsapp',
            isFromStaff: true,
            repliedByUserId: currentUser.id,
            repliedByUserName: currentUser.name,
            status: 'sent'
        };

        // Optimistically add the reply locally
        set((state) => {
            const existingMessages = state.messages[conversationId] || [];
            const updatedMessages = [...existingMessages, newMessage];

            const updatedConversations = state.conversations.map(c => {
                if (c.id === conversationId) {
                    return { ...c, lastMessage: newMessage, updatedAt: newMessage.timestamp };
                }
                return c;
            });
            updatedConversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

            return {
                messages: { ...state.messages, [conversationId]: updatedMessages },
                conversations: updatedConversations
            };
        });

        // Route DM replies through Meta DMs API, comments through Metricool
        const isDM = conversation.messageType === 'dm';

        if (isDM) {
            // DM reply via Meta Graph API
            const participantId = conversation.participants[0]?.id?.replace('participant-', '') || '';
            fetch('/api/admin/meta-dms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    platform: conversation.platform,
                    recipientId: participantId,
                    content,
                }),
            })
                .then(res => res.json())
                .then(data => {
                    if (data.sent) {
                        console.log('[Inbox] DM reply sent:', data);
                    } else {
                        console.warn('[Inbox] DM reply not delivered:', data.message);
                        alert(data.message || 'Could not send message. Please try again.');
                    }
                })
                .catch(err => {
                    console.error('[Inbox] Error sending DM reply:', err);
                    alert('Network error — could not send message.');
                });
        } else {
            // Comment reply via Metricool social-inbox API
            fetch('/api/admin/social-inbox', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    platform: conversation.platform,
                    conversationId,
                    content,
                }),
            })
                .then(res => res.json())
                .then(data => console.log('[Inbox] Comment reply sent:', data))
                .catch(err => console.error('[Inbox] Error sending comment reply:', err));
        }
    },

    replyToGoogleReview: async (reviewId, content) => {
        const currentUser = getLoggedInUser();
        const newMessage: Message = {
            id: `reply_${Date.now()}`,
            conversationId: reviewId,
            senderId: currentUser.id,
            senderName: currentUser.name,
            content,
            timestamp: new Date().toISOString(),
            platform: 'google_reviews',
            isFromStaff: true,
            repliedByUserId: currentUser.id,
            repliedByUserName: currentUser.name,
            status: 'sent'
        };

        set((state) => {
            const existingMessages = state.messages[reviewId] || [];
            const updatedMessages = [...existingMessages, newMessage];

            const updatedConversations = state.conversations.map(c => {
                if (c.id === reviewId) {
                    const updated = { ...c, lastMessage: newMessage, updatedAt: newMessage.timestamp, unreadCount: 0 };
                    if ('replyStatus' in updated) {
                        (updated as GoogleReviewConversation).replyStatus = 'replied';
                        (updated as GoogleReviewConversation).autoReplyScheduledAt = undefined;
                    }
                    return updated;
                }
                return c;
            });
            updatedConversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

            return {
                messages: { ...state.messages, [reviewId]: updatedMessages },
                conversations: updatedConversations
            };
        });

        const conv = get().conversations.find(c => c.id === reviewId);
        const googleReviewId = (conv && 'googleReviewId' in conv) ? (conv as GoogleReviewConversation).googleReviewId : reviewId;

        try {
            await fetch('/api/admin/social-inbox', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    platform: 'google_reviews',
                    conversationId: reviewId,
                    content,
                    reviewname: googleReviewId,
                }),
            });
        } catch (err) {
            console.error('[Inbox] Error replying to Google review:', err);
        }
    },

    receiveMessage: (message) => {
        set((state) => {
            console.log('Received message:', message);
            return state;
        });
    },

    /**
     * Fetches all inbox data from:
     * 1. Metricool (post comments + Google Reviews) via /api/admin/social-inbox
     * 2. Meta Graph API (FB Messenger + IG DMs) via /api/admin/meta-dms
     */
    fetchSocialInbox: async () => {
        if (get().socialInboxLoaded || get().socialInboxLoading) return;

        set({ socialInboxLoading: true });

        try {
            // Fetch both APIs in parallel
            const [socialRes, dmsRes] = await Promise.allSettled([
                fetch('/api/admin/social-inbox'),
                fetch('/api/admin/meta-dms'),
            ]);

            let allConversations: Conversation[] = [];
            let allMessages: Record<string, Message[]> = {};

            // ── 1. Process Metricool data (comments + reviews) ──
            if (socialRes.status === 'fulfilled' && socialRes.value.ok) {
                const data = await socialRes.value.json();
                const apiConversations = data.conversations || [];
                const apiMessages: Record<string, any[]> = data.messages || {};

                for (const c of apiConversations) {
                    const lastMsg: Message = {
                        id: `last-${c.id}`,
                        conversationId: c.id,
                        senderId: c.platform === 'google_reviews' ? `reviewer-${c.id}` : 'post',
                        senderName: c.participantName,
                        content: c.lastMessageContent,
                        timestamp: c.lastMessageTimestamp,
                        platform: c.platform,
                        isFromStaff: c.platform !== 'google_reviews',
                        status: 'read',
                    };

                    const base: Conversation = {
                        id: c.id,
                        platform: c.platform,
                        messageType: c.platform === 'google_reviews' ? 'review' : 'comment',
                        participants: [{
                            id: `participant-${c.id}`,
                            name: c.participantName,
                            avatar: c.participantAvatar,
                        }],
                        lastMessage: lastMsg,
                        unreadCount: c.unreadCount || 0,
                        updatedAt: c.lastMessageTimestamp,
                    };

                    if (c.platform === 'google_reviews') {
                        allConversations.push({
                            ...base,
                            starRating: c.starRating || 0,
                            reviewText: c.reviewText || '',
                            clinicId: c.clinicId || '',
                            clinicName: c.clinicName || '',
                            replyStatus: c.replyStatus || 'unreplied',
                            receivedAt: c.lastMessageTimestamp,
                            googleReviewId: c.googleReviewId,
                        } as GoogleReviewConversation);
                    } else {
                        allConversations.push(base);
                    }
                }

                // Convert API messages
                for (const [convId, msgs] of Object.entries(apiMessages)) {
                    allMessages[convId] = (msgs as any[]).map((m: any) => ({
                        id: m.id,
                        conversationId: m.conversationId,
                        senderId: m.isFromStaff ? 'staff_1' : `user-${m.conversationId}`,
                        senderName: m.senderName,
                        content: m.content,
                        timestamp: m.timestamp,
                        platform: m.platform,
                        isFromStaff: m.isFromStaff,
                        status: m.status || 'read',
                    }));
                }
            }

            // ── 2. Process Meta DMs (FB Messenger + IG DMs) ──
            let dmFbNextCursor: string | null = null;
            let dmIgNextCursor: string | null = null;
            if (dmsRes.status === 'fulfilled' && dmsRes.value.ok) {
                const data = await dmsRes.value.json();
                const dmConversations = data.conversations || [];
                dmFbNextCursor = data.fbNextCursor || null;
                dmIgNextCursor = data.igNextCursor || null;

                for (const c of dmConversations) {
                    const lastMsg: Message = {
                        id: `last-${c.id}`,
                        conversationId: c.id,
                        senderId: `user-${c.participantId || c.id}`,
                        senderName: c.participantName,
                        content: c.lastMessageContent,
                        timestamp: c.lastMessageTimestamp,
                        platform: c.platform,
                        isFromStaff: false,
                        status: 'read',
                    };

                    allConversations.push({
                        id: c.id,
                        platform: c.platform,
                        messageType: 'dm',
                        participants: [{
                            id: c.participantId || `participant-${c.id}`,
                            name: c.participantName,
                            avatar: c.participantAvatar,
                        }],
                        lastMessage: lastMsg,
                        unreadCount: c.unreadCount || 0,
                        updatedAt: c.lastMessageTimestamp,
                        graphConversationId: c.graphConversationId,
                    } as any);

                    // Convert DM messages (if any were pre-loaded — now mostly empty for lazy loading)
                    if (c.messages && c.messages.length > 0) {
                        allMessages[c.id] = c.messages.map((m: any) => ({
                            id: m.id,
                            conversationId: c.id,
                            senderId: m.from || `user-${c.id}`,
                            senderName: m.fromName || c.participantName,
                            content: m.message,
                            timestamp: m.timestamp,
                            platform: c.platform,
                            isFromStaff: m.isFromPage,
                            status: 'read',
                        }));
                    }
                }
            }

            // Sort all conversations by most recent
            allConversations.sort(
                (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
            );

            set({
                conversations: allConversations,
                messages: allMessages,
                socialInboxLoaded: true,
                socialInboxLoading: false,
                fbNextCursor: dmFbNextCursor,
                igNextCursor: dmIgNextCursor,
            });
        } catch (err) {
            console.error('[Inbox] Error fetching inbox:', err);
            set({ socialInboxLoading: false });
        }
    },

    loadMoreConversations: async () => {
        const state = get();
        if (state.loadingMore) return;
        if (!state.fbNextCursor && !state.igNextCursor) return;

        set({ loadingMore: true });
        try {
            const params = new URLSearchParams();
            if (state.fbNextCursor) params.set('fbCursor', state.fbNextCursor);
            if (state.igNextCursor) params.set('igCursor', state.igNextCursor);

            const res = await fetch(`/api/admin/meta-dms?${params}`);
            if (!res.ok) { set({ loadingMore: false }); return; }
            const data = await res.json();
            const newConversations = data.conversations || [];

            // Map to store format and append
            const mapped: Conversation[] = newConversations.map((c: any) => {
                const lastMsg: Message = {
                    id: `last-${c.id}`,
                    conversationId: c.id,
                    senderId: `user-${c.participantId || c.id}`,
                    senderName: c.participantName,
                    content: c.lastMessageContent,
                    timestamp: c.lastMessageTimestamp,
                    platform: c.platform,
                    isFromStaff: false,
                    status: 'read' as const,
                };
                return {
                    id: c.id,
                    platform: c.platform,
                    messageType: 'dm',
                    participants: [{
                        id: c.participantId || `participant-${c.id}`,
                        name: c.participantName,
                        avatar: c.participantAvatar,
                    }],
                    lastMessage: lastMsg,
                    unreadCount: c.unreadCount || 0,
                    updatedAt: c.lastMessageTimestamp,
                    graphConversationId: c.graphConversationId,
                } as any;
            });

            // Deduplicate and append
            const existingIds = new Set(state.conversations.map(c => c.id));
            const uniqueNew = mapped.filter(c => !existingIds.has(c.id));

            set((s) => ({
                conversations: [...s.conversations, ...uniqueNew],
                loadingMore: false,
                fbNextCursor: data.fbNextCursor || null,
                igNextCursor: data.igNextCursor || null,
            }));
        } catch (err) {
            console.error('[Inbox] Error loading more conversations:', err);
            set({ loadingMore: false });
        }
    },

    // Legacy method
    fetchGoogleReviewConversations: async () => {
        await get().fetchSocialInbox();
    },
}));

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

    // Realtime sync state
    lastSyncTimestamp: string | null;
    lastSyncedAt: Date | null;
    isSyncing: boolean;

    // Actions
    setFilter: (filter: Platform | 'all') => void;
    setActiveConversation: (conversationId: string) => void;
    sendMessage: (conversationId: string, content: string) => void;
    receiveMessage: (message: Message) => void;
    fetchSocialInbox: (force?: boolean) => Promise<void>;
    pollSync: () => Promise<void>;
    pollActiveConversation: () => Promise<void>;
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
    lastSyncTimestamp: null,
    lastSyncedAt: null,
    isSyncing: false,

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
            const participantId = conversation.participants[0]?.id?.replace('participant-', '') || '';
            if (graphConvId) {
                fetch(`/api/admin/meta-dms?conversationId=${encodeURIComponent(graphConvId)}&platform=${conversation.platform}&participantId=${encodeURIComponent(participantId)}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.messages && data.messages.length > 0) {
                            const mapped: Message[] = data.messages.map((m: any) => ({
                                id: m.id,
                                conversationId,
                                senderId: (m.isFromStaff || m.isFromPage) ? 'staff_1' : (m.from || `user-${conversationId}`),
                                senderName: m.fromName || conversation.participants[0]?.name || 'Unknown',
                                content: m.message,
                                timestamp: m.timestamp,
                                platform: conversation.platform,
                                isFromStaff: Boolean(m.isFromStaff || m.isFromPage),
                                status: 'read' as const,
                                attachments: m.attachments || undefined,
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

        // Route DM replies through Meta DMs API, LinkedIn API, TikTok API, or Metricool comments
        const isDM = conversation.messageType === 'dm';

        if (isDM && conversation.platform === 'linkedin') {
            // LinkedIn DM reply
            const graphConvId = (conversation as any).graphConversationId;
            fetch('/api/admin/linkedin-inbox', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversationId: graphConvId, content }),
            })
                .then(res => res.json())
                .then(data => console.log('[Inbox] LinkedIn reply sent:', data))
                .catch(err => console.error('[Inbox] Error sending LinkedIn reply:', err));
        } else if (isDM && conversation.platform === 'tiktok') {
            // TikTok DM reply
            const graphConvId = (conversation as any).graphConversationId || conversation.participants[0]?.id?.replace('participant-', '') || conversation.id;
            fetch('/api/admin/tiktok-inbox', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversationId: graphConvId, content }),
            })
                .then(res => res.json())
                .then(data => console.log('[Inbox] TikTok reply sent:', data))
                .catch(err => console.error('[Inbox] Error sending TikTok reply:', err));
        } else if (isDM) {
            // DM reply via Meta Graph API (Messenger, Instagram, or WhatsApp)
            const participantId = conversation.participants[0]?.id?.replace('participant-', '') || '';
            fetch('/api/admin/meta-dms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    platform: conversation.platform,
                    recipientId: participantId,
                    content,
                    waPhoneNumberId: (conversation as any).waPhoneNumberId,
                }),
            })
                .then(res => res.json())
                .then(data => {
                    if (data.sent) {
                        console.log('[Inbox] DM reply sent:', data);
                    } else {
                        console.warn('[Inbox] DM reply not delivered:', data.message);
                        set((state) => {
                            const cur = state.messages[conversationId] || [];
                            const updated = cur.map(m => m.id === newMessage.id ? { ...m, status: 'failed' as const } : m);
                            return { messages: { ...state.messages, [conversationId]: updated } };
                        });
                        alert(data.message || 'Could not send message. Please try again.');
                    }
                })
                .catch(err => {
                    console.error('[Inbox] Error sending DM reply:', err);
                    set((state) => {
                        const cur = state.messages[conversationId] || [];
                        const updated = cur.map(m => m.id === newMessage.id ? { ...m, status: 'failed' as const } : m);
                        return { messages: { ...state.messages, [conversationId]: updated } };
                    });
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

        // 1. Post to Google Reviews Inbox store (persists in blob & marks replied locally)
        fetch('/api/admin/google-reviews-inbox', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                reviewId: googleReviewId || reviewId,
                content,
                repliedByUserId: currentUser.id,
                repliedByUserName: currentUser.name,
            }),
        }).catch(err => console.warn('[Inbox] Error submitting to google-reviews-inbox:', err));

        // 2. Post to Metricool GMB review reply API (for live sync with Google)
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
            console.error('[Inbox] Error replying to Google review via Metricool:', err);
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
     * 3. LinkedIn inbox via /api/admin/linkedin-inbox
     */
    fetchSocialInbox: async (force = false) => {
        if (!force && (get().socialInboxLoaded || get().socialInboxLoading)) return;

        set({ socialInboxLoading: true });

        try {
            // Fetch all APIs in parallel
            const [socialRes, dmsRes, liRes, ttRes, grRes] = await Promise.allSettled([
                fetch('/api/admin/social-inbox'),
                fetch('/api/admin/meta-dms'),
                fetch('/api/admin/linkedin-inbox'),
                fetch('/api/admin/tiktok-inbox'),
                fetch('/api/admin/google-reviews-inbox'),
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

            // ── 2. Process Meta DMs (FB Messenger + IG DMs + WhatsApp) ──
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
                        waPhoneNumberId: c.waPhoneNumberId,
                    } as any);

                    // Convert DM messages (if any were pre-loaded)
                    if (c.messages && c.messages.length > 0) {
                        allMessages[c.id] = c.messages.map((m: any) => ({
                            id: m.id,
                            conversationId: c.id,
                            senderId: (m.isFromStaff || m.isFromPage) ? 'staff_1' : (m.from || `user-${c.id}`),
                            senderName: m.fromName || c.participantName,
                            content: m.message,
                            timestamp: m.timestamp,
                            platform: c.platform,
                            isFromStaff: Boolean(m.isFromStaff || m.isFromPage),
                            status: 'read',
                            attachments: m.attachments || undefined,
                        }));
                    }
                }
            }

            // ── 3. Process LinkedIn DMs ──
            if (liRes.status === 'fulfilled' && liRes.value.ok) {
                const liData = await liRes.value.json();
                const liConversations = liData.conversations || [];

                for (const c of liConversations) {
                    const lastMsg: Message = {
                        id: `last-${c.id}`,
                        conversationId: c.id,
                        senderId: c.participantId || `user-${c.id}`,
                        senderName: c.participantName,
                        content: c.lastMessageContent,
                        timestamp: c.lastMessageTimestamp,
                        platform: 'linkedin',
                        isFromStaff: false,
                        status: 'read',
                    };

                    allConversations.push({
                        id: c.id,
                        platform: 'linkedin',
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

                    if (c.messages && c.messages.length > 0) {
                        allMessages[c.id] = c.messages.map((m: any) => ({
                            id: m.id,
                            conversationId: c.id,
                            senderId: m.from || `user-${c.id}`,
                            senderName: m.fromName || c.participantName,
                            content: m.message,
                            timestamp: m.timestamp,
                            platform: 'linkedin',
                            isFromStaff: m.isFromPage || false,
                            status: 'read',
                        }));
                    }
                }
            }

            // ── 4. Process TikTok Messages ──
            if (ttRes.status === 'fulfilled' && ttRes.value.ok) {
                const ttData = await ttRes.value.json();
                const ttConversations = ttData.conversations || [];

                for (const c of ttConversations) {
                    const lastMsg: Message = {
                        id: `last-${c.id}`,
                        conversationId: c.id,
                        senderId: c.participantId || `user-${c.id}`,
                        senderName: c.participantName,
                        content: c.lastMessageContent,
                        timestamp: c.lastMessageTimestamp,
                        platform: 'tiktok',
                        isFromStaff: false,
                        status: 'read',
                    };

                    allConversations.push({
                        id: c.id,
                        platform: 'tiktok',
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

                    if (c.messages && c.messages.length > 0) {
                        allMessages[c.id] = c.messages.map((m: any) => ({
                            id: m.id,
                            conversationId: c.id,
                            senderId: m.from || `user-${c.id}`,
                            senderName: m.fromName || c.participantName,
                            content: m.message,
                            timestamp: m.timestamp,
                            platform: 'tiktok',
                            isFromStaff: m.isFromPage || false,
                            status: 'read',
                        }));
                    }
                }
            }

            // ── 5. Process Google Reviews from GoogleReviewsInboxStore ──
            if (grRes.status === 'fulfilled' && grRes.value.ok) {
                const grData = await grRes.value.json();
                const grConvs: GoogleReviewConversation[] = grData.conversations || [];
                const grMsgs: Record<string, Message[]> = grData.messages || {};

                for (const gc of grConvs) {
                    const existingIdx = allConversations.findIndex(
                        c => c.id === gc.id || (gc.googleReviewId && (c as any).googleReviewId === gc.googleReviewId)
                    );
                    if (existingIdx === -1) {
                        allConversations.push(gc);
                    } else if (gc.replyStatus === 'replied' || gc.replyStatus === 'auto_replied') {
                        // If local store has confirmed reply status, prioritize it
                        allConversations[existingIdx] = gc;
                    }
                }

                for (const [convId, msgs] of Object.entries(grMsgs)) {
                    if (!allMessages[convId] || allMessages[convId].length <= msgs.length) {
                        allMessages[convId] = msgs;
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

    /**
     * Real-time polling across all channels:
     * Fast check of webhooks + active thread messages without full reload.
     */
    pollSync: async () => {
        const state = get();
        if (state.isSyncing) return;
        set({ isSyncing: true });

        try {
            const activeId = state.activeConversationId;
            const activeConv = activeId ? state.conversations.find(c => c.id === activeId) : null;
            const graphConvId = activeConv ? (activeConv as any).graphConversationId : null;
            const participantId = activeConv?.participants[0]?.id?.replace('participant-', '') || '';

            const params = new URLSearchParams();
            if (state.lastSyncTimestamp) {
                params.set('since', state.lastSyncTimestamp);
            }
            if (activeId) {
                params.set('activeConversationId', activeId);
                if (graphConvId) params.set('graphConversationId', graphConvId);
                if (activeConv) params.set('platform', activeConv.platform);
                if (participantId) params.set('participantId', participantId);
            }

            const res = await fetch(`/api/admin/inbox/sync?${params}`);
            if (res.ok) {
                const data = await res.json();
                const newMsgs: Message[] = data.newMessages || [];
                const latestTs = data.timestamp || new Date().toISOString();

                if (newMsgs.length > 0) {
                    set((cur) => {
                        const updatedMessages = { ...cur.messages };
                        let conversationsUpdated = false;
                        const updatedConversations = [...cur.conversations];

                        for (const msg of newMsgs) {
                            let convId = msg.conversationId;
                            // Match by conversation ID, graphConversationId, or participant ID
                            let convIdx = updatedConversations.findIndex(c => 
                                c.id === convId || 
                                (c as any).graphConversationId === convId ||
                                c.participants.some(p => p.id.includes(msg.senderId) || p.id.includes(msg.conversationId))
                            );

                            const targetConvId = convIdx !== -1 ? updatedConversations[convIdx].id : convId;

                            const existing = updatedMessages[targetConvId] || [];
                            const alreadyExists = existing.some(m => 
                                m.id === msg.id || 
                                (m.content === msg.content && Math.abs(new Date(m.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 4000)
                            );

                            if (!alreadyExists) {
                                updatedMessages[targetConvId] = [...existing, { ...msg, conversationId: targetConvId }];

                                if (convIdx !== -1) {
                                    const conv = updatedConversations[convIdx];
                                    const isCurrentActive = cur.activeConversationId === conv.id;
                                    updatedConversations[convIdx] = {
                                        ...conv,
                                        lastMessage: { ...msg, conversationId: targetConvId },
                                        updatedAt: msg.timestamp,
                                        unreadCount: isCurrentActive ? 0 : (conv.unreadCount + 1),
                                    };
                                    conversationsUpdated = true;
                                }
                            }
                        }

                        if (conversationsUpdated) {
                            updatedConversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
                        }

                        return {
                            messages: updatedMessages,
                            conversations: conversationsUpdated ? updatedConversations : cur.conversations,
                            lastSyncTimestamp: latestTs,
                            lastSyncedAt: new Date(),
                            isSyncing: false,
                        };
                    });
                } else {
                    set({
                        lastSyncTimestamp: latestTs,
                        lastSyncedAt: new Date(),
                        isSyncing: false,
                    });
                }
            } else {
                set({ isSyncing: false });
            }
        } catch (err) {
            console.warn('[InboxStore] pollSync error:', err);
            set({ isSyncing: false });
        }
    },

    /**
     * Poll active conversation directly for immediate feedback when actively chatting.
     */
    pollActiveConversation: async () => {
        const state = get();
        const activeId = state.activeConversationId;
        if (!activeId) return;
        const conv = state.conversations.find(c => c.id === activeId);
        if (!conv) return;

        const graphConvId = (conv as any).graphConversationId;
        const participantId = conv.participants[0]?.id?.replace('participant-', '') || '';

        try {
            const res = await fetch(`/api/admin/meta-dms?conversationId=${encodeURIComponent(graphConvId || activeId)}&platform=${conv.platform}&participantId=${encodeURIComponent(participantId)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.messages && data.messages.length > 0) {
                    const mapped: Message[] = data.messages.map((m: any) => ({
                        id: m.id,
                        conversationId: activeId,
                        senderId: (m.isFromStaff || m.isFromPage) ? 'staff_1' : (m.from || `user-${activeId}`),
                        senderName: m.fromName || conv.participants[0]?.name || 'Unknown',
                        content: m.message,
                        timestamp: m.timestamp,
                        platform: conv.platform,
                        isFromStaff: Boolean(m.isFromStaff || m.isFromPage),
                        status: 'read' as const,
                        attachments: m.attachments || undefined,
                    }));

                    set((cur) => {
                        const curMsgs = cur.messages[activeId] || [];
                        if (mapped.length !== curMsgs.length || mapped[mapped.length - 1]?.id !== curMsgs[curMsgs.length - 1]?.id) {
                            const lastMsg = mapped[mapped.length - 1];
                            const updatedConversations = cur.conversations.map(c => {
                                if (c.id === activeId && lastMsg) {
                                    return {
                                        ...c,
                                        lastMessage: lastMsg,
                                        updatedAt: lastMsg.timestamp,
                                    };
                                }
                                return c;
                            });
                            return {
                                messages: { ...cur.messages, [activeId]: mapped },
                                conversations: updatedConversations,
                            };
                        }
                        return cur;
                    });
                }
            }
        } catch (e) {
            console.warn('[InboxStore] pollActiveConversation error:', e);
        }
    },
}));

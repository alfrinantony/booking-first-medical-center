import { create } from 'zustand';
import { Conversation, Message, Platform, GoogleReviewConversation } from '@/types/inbox';

interface InboxState {
    conversations: Conversation[];
    activeConversationId: string | null;
    messages: Record<string, Message[]>; // conversationId -> messages
    filter: Platform | 'all';
    socialInboxLoaded: boolean;
    socialInboxLoading: boolean;

    // Actions
    setFilter: (filter: Platform | 'all') => void;
    setActiveConversation: (conversationId: string) => void;
    sendMessage: (conversationId: string, content: string) => void;
    receiveMessage: (message: Message) => void;
    fetchSocialInbox: () => Promise<void>;
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

    setFilter: (filter) => set({ filter }),

    setActiveConversation: (conversationId) => set({ activeConversationId: conversationId }),

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
            if (dmsRes.status === 'fulfilled' && dmsRes.value.ok) {
                const data = await dmsRes.value.json();
                const dmConversations = data.conversations || [];

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
                    });

                    // Convert DM messages
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
            });
        } catch (err) {
            console.error('[Inbox] Error fetching inbox:', err);
            set({ socialInboxLoading: false });
        }
    },

    // Legacy method
    fetchGoogleReviewConversations: async () => {
        await get().fetchSocialInbox();
    },
}));

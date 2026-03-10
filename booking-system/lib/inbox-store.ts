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

        // Post reply via Metricool social-inbox API
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
            .then(data => console.log('[Inbox] Reply sent:', data))
            .catch(err => console.error('[Inbox] Error sending reply:', err));
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

        // Find the Google review conversation to get the reviewname
        const conv = get().conversations.find(c => c.id === reviewId);
        const googleReviewId = (conv && 'googleReviewId' in conv) ? (conv as GoogleReviewConversation).googleReviewId : reviewId;

        // Post reply via Metricool social-inbox API
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
     * Fetches all social inbox conversations from the unified Metricool API endpoint.
     * Replaces the old mock data approach.
     */
    fetchSocialInbox: async () => {
        if (get().socialInboxLoaded || get().socialInboxLoading) return;

        set({ socialInboxLoading: true });

        try {
            const res = await fetch('/api/admin/social-inbox');
            if (!res.ok) throw new Error('Failed to fetch social inbox');
            const data = await res.json();

            const apiConversations = data.conversations || [];
            const apiMessages: Record<string, Message[]> = data.messages || {};

            // Convert API format to inbox Conversation format
            const newConversations: Conversation[] = apiConversations.map((c: any) => {
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
                    participants: [{
                        id: `participant-${c.id}`,
                        name: c.participantName,
                        avatar: c.participantAvatar,
                    }],
                    lastMessage: lastMsg,
                    unreadCount: c.unreadCount || 0,
                    updatedAt: c.lastMessageTimestamp,
                };

                // Add Google Review specific fields
                if (c.platform === 'google_reviews') {
                    return {
                        ...base,
                        starRating: c.starRating || 0,
                        reviewText: c.reviewText || '',
                        clinicId: c.clinicId || '',
                        clinicName: c.clinicName || '',
                        replyStatus: c.replyStatus || 'unreplied',
                        receivedAt: c.lastMessageTimestamp,
                        googleReviewId: c.googleReviewId,
                    } as GoogleReviewConversation;
                }

                return base;
            });

            // Convert API messages format
            const newMessages: Record<string, Message[]> = {};
            for (const [convId, msgs] of Object.entries(apiMessages)) {
                newMessages[convId] = (msgs as any[]).map((m: any) => ({
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

            set({
                conversations: newConversations.sort(
                    (a: Conversation, b: Conversation) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
                ),
                messages: newMessages,
                socialInboxLoaded: true,
                socialInboxLoading: false,
            });
        } catch (err) {
            console.error('[Inbox] Error fetching social inbox:', err);
            set({ socialInboxLoading: false });
        }
    },

    // Legacy method — now just calls fetchSocialInbox since Google reviews are included
    fetchGoogleReviewConversations: async () => {
        await get().fetchSocialInbox();
    },
}));

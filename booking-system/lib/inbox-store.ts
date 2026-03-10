import { create } from 'zustand';
import { Conversation, Message, Platform, GoogleReviewConversation } from '@/types/inbox';

interface InboxState {
    conversations: Conversation[];
    activeConversationId: string | null;
    messages: Record<string, Message[]>; // conversationId -> messages
    filter: Platform | 'all';
    googleReviewsLoaded: boolean;

    // Actions
    setFilter: (filter: Platform | 'all') => void;
    setActiveConversation: (conversationId: string) => void;
    sendMessage: (conversationId: string, content: string) => void;
    receiveMessage: (message: Message) => void;
    fetchGoogleReviewConversations: () => Promise<void>;
    replyToGoogleReview: (reviewId: string, content: string) => Promise<void>;
}

// Mock Data — existing social channels
const MOCK_CONVERSATIONS: Conversation[] = [
    {
        id: 'conv_1',
        platform: 'whatsapp',
        participants: [{ id: 'user_1', name: 'Alice Johnson', avatar: 'https://i.pravatar.cc/150?u=alice' }],
        lastMessage: {
            id: 'msg_1',
            conversationId: 'conv_1',
            senderId: 'user_1',
            senderName: 'Alice Johnson',
            content: 'Hi, I need to reschedule my appointment.',
            timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
            platform: 'whatsapp',
            isFromStaff: false,
            status: 'read'
        },
        unreadCount: 1,
        updatedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    },
    {
        id: 'conv_2',
        platform: 'facebook',
        participants: [{ id: 'user_2', name: 'Bob Smith', avatar: 'https://i.pravatar.cc/150?u=bob' }],
        lastMessage: {
            id: 'msg_2',
            conversationId: 'conv_2',
            senderId: 'staff_1',
            senderName: 'Staff',
            content: 'Sure, we have an opening tomorrow at 2 PM.',
            timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
            platform: 'facebook',
            isFromStaff: true,
            status: 'delivered'
        },
        unreadCount: 0,
        updatedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    },
    {
        id: 'conv_3',
        platform: 'instagram',
        participants: [{ id: 'user_3', name: 'Charlie Davis', avatar: 'https://i.pravatar.cc/150?u=charlie' }],
        lastMessage: {
            id: 'msg_3',
            conversationId: 'conv_3',
            senderId: 'user_3',
            senderName: 'Charlie Davis',
            content: 'Do you offer laser treatments?',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
            platform: 'instagram',
            isFromStaff: false,
            status: 'read'
        },
        unreadCount: 0,
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
    {
        id: 'conv_4',
        platform: 'tiktok',
        participants: [{ id: 'user_4', name: 'Dana K.', avatar: 'https://i.pravatar.cc/150?u=dana' }],
        lastMessage: {
            id: 'msg_4',
            conversationId: 'conv_4',
            senderId: 'user_4',
            senderName: 'Dana K.',
            content: 'Hi! I saw your HydraFacial reel — do you have weekend availability?',
            timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
            platform: 'tiktok',
            isFromStaff: false,
            status: 'read'
        },
        unreadCount: 1,
        updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
    {
        id: 'conv_5',
        platform: 'linkedin',
        participants: [{ id: 'user_5', name: 'Dr. Rajan Mehta', avatar: 'https://i.pravatar.cc/150?u=rajan' }],
        lastMessage: {
            id: 'msg_5',
            conversationId: 'conv_5',
            senderId: 'user_5',
            senderName: 'Dr. Rajan Mehta',
            content: 'Interested in collaboration opportunities for dermatology services.',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
            platform: 'linkedin',
            isFromStaff: false,
            status: 'read'
        },
        unreadCount: 1,
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    }
];

const MOCK_MESSAGES: Record<string, Message[]> = {
    'conv_1': [
        {
            id: 'msg_0',
            conversationId: 'conv_1',
            senderId: 'staff_1',
            senderName: 'Staff',
            content: 'Hello Alice, how can we help you?',
            timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
            platform: 'whatsapp',
            isFromStaff: true,
            status: 'read'
        },
        {
            id: 'msg_1',
            conversationId: 'conv_1',
            senderId: 'user_1',
            senderName: 'Alice Johnson',
            content: 'Hi, I need to reschedule my appointment.',
            timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
            platform: 'whatsapp',
            isFromStaff: false,
            status: 'read'
        }
    ],
    'conv_2': [
        {
            id: 'msg_2',
            conversationId: 'conv_2',
            senderId: 'staff_1',
            senderName: 'Staff',
            content: 'Sure, we have an opening tomorrow at 2 PM.',
            timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
            platform: 'facebook',
            isFromStaff: true,
            status: 'delivered'
        }
    ],
    'conv_3': [
        {
            id: 'msg_3',
            conversationId: 'conv_3',
            senderId: 'user_3',
            senderName: 'Charlie Davis',
            content: 'Do you offer laser treatments?',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
            platform: 'instagram',
            isFromStaff: false,
            status: 'read'
        }
    ],
    'conv_4': [
        {
            id: 'msg_4',
            conversationId: 'conv_4',
            senderId: 'user_4',
            senderName: 'Dana K.',
            content: 'Hi! I saw your HydraFacial reel — do you have weekend availability?',
            timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
            platform: 'tiktok',
            isFromStaff: false,
            status: 'read'
        }
    ],
    'conv_5': [
        {
            id: 'msg_5',
            conversationId: 'conv_5',
            senderId: 'user_5',
            senderName: 'Dr. Rajan Mehta',
            content: 'Interested in collaboration opportunities for dermatology services.',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
            platform: 'linkedin',
            isFromStaff: false,
            status: 'read'
        }
    ]
};

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
    conversations: MOCK_CONVERSATIONS,
    activeConversationId: null,
    messages: MOCK_MESSAGES,
    filter: 'all',
    googleReviewsLoaded: false,

    setFilter: (filter) => set({ filter }),

    setActiveConversation: (conversationId) => set({ activeConversationId: conversationId }),

    sendMessage: (conversationId, content) => {
        const conversation = get().conversations.find(c => c.id === conversationId);
        if (!conversation) return;

        // If this is a Google review, use the review reply endpoint
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

        set((state) => {
            const existingMessages = state.messages[conversationId] || [];
            const updatedMessages = [...existingMessages, newMessage];

            const updatedConversations = state.conversations.map(c => {
                if (c.id === conversationId) {
                    return { ...c, lastMessage: newMessage, updatedAt: newMessage.timestamp };
                }
                return c;
            });

            // Move updated conversation to top
            updatedConversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

            return {
                messages: { ...state.messages, [conversationId]: updatedMessages },
                conversations: updatedConversations
            };
        });

        // Call API to send message
        fetch('/api/messages/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                platform: get().conversations.find(c => c.id === conversationId)?.platform,
                recipientId: conversationId,
                message: content,
            }),
        }).then(res => res.json())
            .then(data => console.log('Message sent API response:', data))
            .catch(err => console.error('Error sending message:', err));
    },

    replyToGoogleReview: async (reviewId, content) => {
        const currentUser = getLoggedInUser();
        // Optimistically add the reply to the UI
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
                    // Update reply status for Google review conversations
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

        // Call the API to persist the reply
        try {
            const currentUser = getLoggedInUser();
            await fetch('/api/admin/google-reviews-inbox', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reviewId, content, repliedByUserId: currentUser.id, repliedByUserName: currentUser.name }),
            });
        } catch (err) {
            console.error('Error replying to Google review:', err);
        }
    },

    receiveMessage: (message) => {
        set((state) => {
            console.log('Received message:', message);
            return state;
        });
    },

    fetchGoogleReviewConversations: async () => {
        if (get().googleReviewsLoaded) return;

        // Set loaded flag eagerly to prevent duplicate fetches from React Strict Mode
        set({ googleReviewsLoaded: true });

        try {
            const res = await fetch('/api/admin/google-reviews-inbox');
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();

            const googleConversations: Conversation[] = data.conversations || [];
            const googleMessages: Record<string, Message[]> = data.messages || {};

            set((state) => {
                // Deduplicate: only add conversations not already present
                const existingIds = new Set(state.conversations.map(c => c.id));
                const newConversations = googleConversations.filter(c => !existingIds.has(c.id));

                return {
                    conversations: [...state.conversations, ...newConversations].sort(
                        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
                    ),
                    messages: { ...state.messages, ...googleMessages },
                };
            });
        } catch (err) {
            console.error('Error fetching Google review conversations:', err);
        }
    },

}));

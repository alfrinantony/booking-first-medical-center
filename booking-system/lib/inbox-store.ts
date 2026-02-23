import { create } from 'zustand';
import { Conversation, Message, Platform } from '@/types/inbox';

interface InboxState {
    conversations: Conversation[];
    activeConversationId: string | null;
    messages: Record<string, Message[]>; // conversationId -> messages
    filter: Platform | 'all';

    // Actions
    setFilter: (filter: Platform | 'all') => void;
    setActiveConversation: (conversationId: string) => void;
    sendMessage: (conversationId: string, content: string) => void;
    receiveMessage: (message: Message) => void;
}

// Mock Data
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
    ]
};

export const useInboxStore = create<InboxState>((set, get) => ({
    conversations: MOCK_CONVERSATIONS,
    activeConversationId: null,
    messages: MOCK_MESSAGES,
    filter: 'all',

    setFilter: (filter) => set({ filter }),

    setActiveConversation: (conversationId) => set({ activeConversationId: conversationId }),

    sendMessage: (conversationId, content) => {
        const newMessage: Message = {
            id: `msg_${Date.now()}`,
            conversationId,
            senderId: 'staff_1',
            senderName: 'Staff',
            content,
            timestamp: new Date().toISOString(),
            platform: get().conversations.find(c => c.id === conversationId)?.platform || 'whatsapp',
            isFromStaff: true,
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

    receiveMessage: (message) => {
        set((state) => {
            // Logic to handle incoming message (update conversation list, add to messages)
            // For mock purposes, we just log it
            console.log('Received message:', message);
            return state;
        });
    }
}));

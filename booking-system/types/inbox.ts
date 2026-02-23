export type Platform = 'facebook' | 'instagram' | 'whatsapp';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string; // ISO string
  platform: Platform;
  isFromStaff: boolean;
  status: 'sent' | 'delivered' | 'read' | 'failed';
}

export interface Conversation {
  id: string;
  platform: Platform;
  participants: {
    id: string;
    name: string;
    avatar?: string;
  }[];
  lastMessage: Message;
  unreadCount: number;
  updatedAt: string; // ISO string
}

export type Platform = 'facebook' | 'instagram' | 'whatsapp' | 'google_reviews' | 'tiktok' | 'linkedin';

export type ReviewReplyStatus = 'unreplied' | 'replied' | 'auto_replied';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string; // ISO string
  platform: Platform;
  isFromStaff: boolean;
  isAutoReply?: boolean; // True if sent by AI auto-reply
  repliedByUserId?: string;  // Staff user ID who sent this reply
  repliedByUserName?: string; // Staff display name who sent this reply
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

/** Extended conversation type for Google Reviews */
export interface GoogleReviewConversation extends Conversation {
  platform: 'google_reviews';
  starRating: number; // 1-5
  reviewText: string;
  reviewerPhotoUrl?: string;
  clinicId: string;
  clinicName: string;
  replyStatus: ReviewReplyStatus;
  receivedAt: string; // ISO string — when the review was first detected
  googleReviewId?: string; // Google's review ID for API reply
  autoReplyScheduledAt?: string; // ISO string — when auto-reply will fire (receivedAt + 6h)
}

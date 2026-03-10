import { GoogleReviewConversation, Message, ReviewReplyStatus } from '@/types/inbox';
import { loadFromBlob, saveToBlob } from './blob-persistence';
import { clinics } from './data';

// ─────────────────────────────────────────────────────────────
// Google Reviews Inbox Store — Server-side with blob persistence
//
// Stores Google review conversations detected via the Places API.
// Each review becomes a "conversation" in the inbox with the
// review text as the incoming message, and any replies as outgoing.
// ─────────────────────────────────────────────────────────────

const BLOB_KEY = 'google-reviews-inbox';

interface PlaceReview {
    clinicId: string;
    authorName: string;
    rating: number;
    text: string;
    relativeTime: string;
    photoUrl?: string;
}

interface StoredReviewConversation {
    id: string;
    googleReviewId?: string;
    reviewerName: string;
    reviewerPhotoUrl?: string;
    starRating: number;
    reviewText: string;
    clinicId: string;
    clinicName: string;
    receivedAt: string;
    replyStatus: ReviewReplyStatus;
    replies: StoredReply[];
}

interface StoredReply {
    id: string;
    content: string;
    timestamp: string;
    isAutoReply: boolean;
    repliedByUserId?: string;
    repliedByUserName?: string;
}

let store: StoredReviewConversation[] = [];
let loaded = false;

async function ensureLoaded() {
    if (!loaded) {
        store = await loadFromBlob<StoredReviewConversation[]>(BLOB_KEY, []);
        loaded = true;
    }
}

// ── Place ID cache (clinicId → placeId) ──
const placeIdCache = new Map<string, string>();

async function lookupPlaceId(clinicName: string, clinicId: string, apiKey: string): Promise<string | null> {
    if (placeIdCache.has(clinicId)) return placeIdCache.get(clinicId)!;

    const query = `First Medical Center ${clinicName} Dubai`;
    try {
        const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'places.id,places.displayName',
            },
            body: JSON.stringify({ textQuery: query }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        const placeId = data?.places?.[0]?.id;
        if (placeId) {
            placeIdCache.set(clinicId, placeId);
            return placeId;
        }
    } catch {
        // silent
    }
    return null;
}

async function fetchReviewsForClinic(clinicId: string, clinicName: string, apiKey: string): Promise<PlaceReview[]> {
    const placeId = await lookupPlaceId(clinicName, clinicId, apiKey);
    if (!placeId) return [];

    try {
        const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
            headers: {
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'reviews',
            },
        });
        if (!res.ok) return [];
        const data = await res.json();
        return (data?.reviews || []).map((r: any) => ({
            clinicId,
            authorName: r.authorAttribution?.displayName || 'Anonymous',
            rating: r.rating || 0,
            text: r.text?.text || '',
            relativeTime: r.relativePublishTimeDescription || '',
            photoUrl: r.authorAttribution?.photoUri || undefined,
        }));
    } catch {
        return [];
    }
}

/** Generate a unique key for a review to prevent duplicates */
function reviewKey(clinicId: string, authorName: string, text: string): string {
    return `${clinicId}::${authorName}::${text.substring(0, 80)}`;
}

// ── Mock reviews for when no API key is available ──
function getMockReviews(): PlaceReview[] {
    return [
        {
            clinicId: 'clinic-1',
            authorName: 'Sara Ahmed',
            rating: 5,
            text: 'Excellent experience at the Al Muraqabat branch! Dr. Fatima was very professional and the staff was incredibly welcoming. The clinic is clean and modern. Highly recommend!',
            relativeTime: '2 hours ago',
        },
        {
            clinicId: 'clinic-2',
            authorName: 'Mohammed Al-Rashid',
            rating: 4,
            text: 'Good service at Al Qiyadah. Had to wait a bit longer than expected but the treatment was thorough. The doctor explained everything clearly.',
            relativeTime: '5 hours ago',
        },
        {
            clinicId: 'clinic-1',
            authorName: 'Emily Johnson',
            rating: 5,
            text: 'Best dermatology clinic in Dubai! I have been coming here for 2 years and the results are amazing. Thank you First Medical Center!',
            relativeTime: '1 day ago',
        },
        {
            clinicId: 'clinic-3',
            authorName: 'Ahmad Hassan',
            rating: 3,
            text: 'The Silicon Oasis branch is convenient but the parking is limited. Treatment was okay, nothing special. Could improve the waiting area.',
            relativeTime: '2 days ago',
        },
        {
            clinicId: 'clinic-2',
            authorName: 'Fatima Zahra',
            rating: 5,
            text: 'Wonderful staff and amazing results! My skin has never looked better. The PRP treatment was worth every dirham.',
            relativeTime: '3 days ago',
        },
    ];
}

export const GoogleReviewsInboxStore = {
    /**
     * Fetch fresh reviews from Google Places API and merge with existing store.
     * New reviews are added; existing ones are kept untouched (preserving reply status).
     */
    refresh: async (): Promise<void> => {
        await ensureLoaded();

        const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

        let allReviews: PlaceReview[];
        if (apiKey) {
            const reviewSets = await Promise.all(
                clinics.map(c => fetchReviewsForClinic(c.id, c.name, apiKey))
            );
            allReviews = reviewSets.flat();
        } else {
            // Use mock data when no API key
            allReviews = getMockReviews();
        }

        // Build a set of existing review keys
        const existingKeys = new Set(
            store.map(s => reviewKey(s.clinicId, s.reviewerName, s.reviewText))
        );

        // Add only new reviews
        let added = 0;
        for (const review of allReviews) {
            const key = reviewKey(review.clinicId, review.authorName, review.text);
            if (!existingKeys.has(key)) {
                const clinic = clinics.find(c => c.id === review.clinicId);
                const now = new Date().toISOString();
                store.push({
                    id: `grev-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    reviewerName: review.authorName,
                    reviewerPhotoUrl: review.photoUrl,
                    starRating: review.rating,
                    reviewText: review.text,
                    clinicId: review.clinicId,
                    clinicName: clinic?.name || review.clinicId,
                    receivedAt: now,
                    replyStatus: 'unreplied',
                    replies: [],
                });
                existingKeys.add(key);
                added++;
            }
        }

        if (added > 0) {
            await saveToBlob(BLOB_KEY, store);
        }
    },

    /** Get all review conversations */
    getAll: async (): Promise<StoredReviewConversation[]> => {
        await ensureLoaded();
        return store;
    },

    /** Get a single review conversation by ID */
    getById: async (id: string): Promise<StoredReviewConversation | undefined> => {
        await ensureLoaded();
        return store.find(s => s.id === id);
    },

    /** Add a manual reply to a review */
    addReply: async (reviewId: string, content: string, isAutoReply: boolean = false, repliedByUserId?: string, repliedByUserName?: string): Promise<StoredReply | null> => {
        await ensureLoaded();
        const review = store.find(s => s.id === reviewId);
        if (!review) return null;

        const reply: StoredReply = {
            id: `reply-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            content,
            timestamp: new Date().toISOString(),
            isAutoReply,
            repliedByUserId,
            repliedByUserName,
        };

        review.replies.push(reply);
        review.replyStatus = isAutoReply ? 'auto_replied' : 'replied';
        await saveToBlob(BLOB_KEY, store);
        return reply;
    },

    /** Get all unreplied reviews older than 6 hours */
    getUnrepliedOlderThan: async (hoursThreshold: number = 6): Promise<StoredReviewConversation[]> => {
        await ensureLoaded();
        const cutoff = Date.now() - hoursThreshold * 60 * 60 * 1000;
        return store.filter(
            s => s.replyStatus === 'unreplied' && new Date(s.receivedAt).getTime() < cutoff
        );
    },

    /** Convert stored conversations to the inbox Conversation format */
    toInboxFormat: async (): Promise<{ conversations: GoogleReviewConversation[]; messages: Record<string, Message[]> }> => {
        await ensureLoaded();
        const conversations: GoogleReviewConversation[] = [];
        const messages: Record<string, Message[]> = {};

        for (const item of store) {
            // Create the review as an incoming message
            const reviewMsg: Message = {
                id: `${item.id}-review`,
                conversationId: item.id,
                senderId: `google-${item.reviewerName}`,
                senderName: item.reviewerName,
                content: item.reviewText,
                timestamp: item.receivedAt,
                platform: 'google_reviews',
                isFromStaff: false,
                status: 'read',
            };

            const allMessages: Message[] = [reviewMsg];

            // Add replies as outgoing messages
            for (const reply of item.replies) {
                allMessages.push({
                    id: reply.id,
                    conversationId: item.id,
                    senderId: reply.repliedByUserId || 'staff_1',
                    senderName: reply.isAutoReply ? 'AI Auto-Reply' : (reply.repliedByUserName || 'Staff'),
                    content: reply.content,
                    timestamp: reply.timestamp,
                    platform: 'google_reviews',
                    isFromStaff: true,
                    isAutoReply: reply.isAutoReply,
                    repliedByUserId: reply.repliedByUserId,
                    repliedByUserName: reply.repliedByUserName,
                    status: 'sent',
                });
            }

            const lastMsg = allMessages[allMessages.length - 1];
            const autoReplyTime = new Date(new Date(item.receivedAt).getTime() + 6 * 60 * 60 * 1000).toISOString();

            conversations.push({
                id: item.id,
                platform: 'google_reviews',
                participants: [{
                    id: `google-${item.reviewerName}`,
                    name: item.reviewerName,
                    avatar: item.reviewerPhotoUrl,
                }],
                lastMessage: lastMsg,
                unreadCount: item.replyStatus === 'unreplied' ? 1 : 0,
                updatedAt: lastMsg.timestamp,
                starRating: item.starRating,
                reviewText: item.reviewText,
                clinicId: item.clinicId,
                clinicName: item.clinicName,
                replyStatus: item.replyStatus,
                receivedAt: item.receivedAt,
                googleReviewId: item.googleReviewId,
                autoReplyScheduledAt: item.replyStatus === 'unreplied' ? autoReplyTime : undefined,
            });

            messages[item.id] = allMessages;
        }

        // Sort by most recent first
        conversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        return { conversations, messages };
    },
};

import { GoogleReview } from './review-discount-store';
import { loadFromBlob, saveToBlob } from './blob-persistence';

/**
 * Server-side store for Google reviews with blob persistence.
 */
let reviews: GoogleReview[] = [];
let revLoaded = false;

async function ensureRevLoaded() {
    if (!revLoaded) {
        reviews = await loadFromBlob<GoogleReview[]>('reviews', []);
        revLoaded = true;
    }
}

export const ReviewsServerStore = {
    getAll: async () => { await ensureRevLoaded(); return reviews; },

    getByCustomer: async (customerPhone: string) => {
        await ensureRevLoaded();
        return reviews.filter(r => r.customerPhone === customerPhone);
    },

    add: async (review: Omit<GoogleReview, 'id' | 'submittedAt'>) => {
        await ensureRevLoaded();
        // Upsert: replace existing review for same customer+branch
        reviews = reviews.filter(
            r => !(r.customerPhone === review.customerPhone && r.clinicId === review.clinicId)
        );
        const newReview: GoogleReview = {
            ...review,
            id: `rev-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            submittedAt: new Date().toISOString(),
        };
        reviews.push(newReview);
        await saveToBlob('reviews', reviews);
        return newReview;
    },

    delete: async (id: string) => {
        await ensureRevLoaded();
        reviews = reviews.filter(r => r.id !== id);
        await saveToBlob('reviews', reviews);
    },

    /** Bulk-load reviews (used to sync from client localStorage on first request) */
    sync: async (clientReviews: GoogleReview[]) => {
        await ensureRevLoaded();
        for (const cr of clientReviews) {
            const existing = reviews.find(
                r => r.customerPhone === cr.customerPhone && r.clinicId === cr.clinicId
            );
            if (!existing || new Date(cr.submittedAt) > new Date(existing.submittedAt)) {
                reviews = reviews.filter(
                    r => !(r.customerPhone === cr.customerPhone && r.clinicId === cr.clinicId)
                );
                reviews.push(cr);
            }
        }
        await saveToBlob('reviews', reviews);
        return reviews;
    },
};

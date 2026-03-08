import { GoogleReview } from './review-discount-store';

/**
 * Server-side in-memory store for Google reviews.
 * Ensures reviews persist across client sessions (same server instance).
 * Mirrors the client-side Zustand store but lives on the server.
 */
let reviews: GoogleReview[] = [];

export const ReviewsServerStore = {
    getAll: () => reviews,

    getByCustomer: (customerPhone: string) =>
        reviews.filter(r => r.customerPhone === customerPhone),

    add: (review: Omit<GoogleReview, 'id' | 'submittedAt'>) => {
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
        return newReview;
    },

    delete: (id: string) => {
        reviews = reviews.filter(r => r.id !== id);
    },

    /** Bulk-load reviews (used to sync from client localStorage on first request) */
    sync: (clientReviews: GoogleReview[]) => {
        // Merge: for each client review, upsert into server store
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
        return reviews;
    },
};

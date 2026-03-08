import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clinics } from './data';

/* ────────────────────────────────────────────
 * Google Review Discount Store
 *
 * Tracks customer-submitted Google review ratings per branch.
 * Discount rules:
 *   • 5★ for ALL branches  → 3% off total
 *   • 5★ for 1+ branch (no sub-5 reviews) → 1% off total
 *   • Any review < 5★       → 0%
 *   • No reviews             → 0%
 *
 * Persistence:
 *   • Client-side: Zustand persist (localStorage)
 *   • Server-side: /api/admin/reviews  (synced on mount & every submit)
 * ──────────────────────────────────────────── */

export interface GoogleReview {
    id: string;
    customerPhone: string;
    clinicId: string;
    rating: number; // 1-5
    submittedAt: string;
}

export interface ReviewDiscountResult {
    percent: number;       // 0, 1, or 3
    reviewedBranches: number;
    totalBranches: number;
    hasSubFiveReview: boolean;
}

interface ReviewDiscountState {
    reviews: GoogleReview[];
    _synced: boolean; // Whether initial server sync has happened

    // Customer actions
    submitReview: (customerPhone: string, clinicId: string, rating: number) => void;
    getCustomerReviews: (customerPhone: string) => GoogleReview[];
    getReviewDiscount: (customerPhone: string) => ReviewDiscountResult;

    // Sync with server
    syncWithServer: () => Promise<void>;

    // Admin
    getAllReviews: () => GoogleReview[];
    deleteReview: (id: string) => void;
}

export const useReviewDiscountStore = create<ReviewDiscountState>()(
    persist(
        (set, get) => ({
            reviews: [],
            _synced: false,

            submitReview: (customerPhone, clinicId, rating) => {
                const clamped = Math.max(1, Math.min(5, Math.round(rating)));

                set(state => {
                    // Upsert: replace existing review for same customer+branch
                    const filtered = state.reviews.filter(
                        r => !(r.customerPhone === customerPhone && r.clinicId === clinicId)
                    );
                    return {
                        reviews: [...filtered, {
                            id: `rev-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                            customerPhone,
                            clinicId,
                            rating: clamped,
                            submittedAt: new Date().toISOString(),
                        }],
                    };
                });

                // Persist to server (fire-and-forget)
                fetch('/api/admin/reviews', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ customerPhone, clinicId, rating: clamped }),
                }).catch(() => {/* silent – localStorage is the fallback */ });
            },

            getCustomerReviews: (customerPhone) => {
                return get().reviews.filter(r => r.customerPhone === customerPhone);
            },

            getReviewDiscount: (customerPhone) => {
                const allClinicIds = clinics.map(c => c.id);
                const totalBranches = allClinicIds.length;
                const customerReviews = get().reviews.filter(r => r.customerPhone === customerPhone);

                if (customerReviews.length === 0) {
                    return { percent: 0, reviewedBranches: 0, totalBranches, hasSubFiveReview: false };
                }

                // Check for any sub-5 review
                const hasSubFiveReview = customerReviews.some(r => r.rating < 5);
                if (hasSubFiveReview) {
                    return { percent: 0, reviewedBranches: customerReviews.length, totalBranches, hasSubFiveReview: true };
                }

                // Count 5-star reviewed branches
                const fiveStarBranches = new Set(
                    customerReviews.filter(r => r.rating === 5).map(r => r.clinicId)
                );
                const reviewedBranches = fiveStarBranches.size;

                if (reviewedBranches >= totalBranches) {
                    return { percent: 3, reviewedBranches, totalBranches, hasSubFiveReview: false };
                }
                if (reviewedBranches >= 1) {
                    return { percent: 1, reviewedBranches, totalBranches, hasSubFiveReview: false };
                }

                return { percent: 0, reviewedBranches: 0, totalBranches, hasSubFiveReview: false };
            },

            /**
             * Two-way sync: push local reviews to server, merge server reviews back.
             * Called once on first mount (dashboard / booking page).
             */
            syncWithServer: async () => {
                if (get()._synced) return;
                try {
                    const localReviews = get().reviews;
                    const res = await fetch('/api/admin/reviews', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sync: true, reviews: localReviews }),
                    });
                    if (res.ok) {
                        const merged: GoogleReview[] = await res.json();
                        set({ reviews: merged, _synced: true });
                    }
                } catch {
                    // Offline → keep using localStorage
                }
            },

            getAllReviews: () => get().reviews,

            deleteReview: (id) => {
                set(state => ({
                    reviews: state.reviews.filter(r => r.id !== id),
                }));
                // Also delete on server
                fetch(`/api/admin/reviews?id=${id}`, { method: 'DELETE' }).catch(() => { });
            },
        }),
        {
            name: 'review-discount-store',
        }
    )
);

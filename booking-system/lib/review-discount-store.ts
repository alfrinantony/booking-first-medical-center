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

    // Customer actions
    submitReview: (customerPhone: string, clinicId: string, rating: number) => void;
    getCustomerReviews: (customerPhone: string) => GoogleReview[];
    getReviewDiscount: (customerPhone: string) => ReviewDiscountResult;

    // Admin
    getAllReviews: () => GoogleReview[];
    deleteReview: (id: string) => void;
}

export const useReviewDiscountStore = create<ReviewDiscountState>()(
    persist(
        (set, get) => ({
            reviews: [],

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

            getAllReviews: () => get().reviews,

            deleteReview: (id) => {
                set(state => ({
                    reviews: state.reviews.filter(r => r.id !== id),
                }));
            },
        }),
        {
            name: 'review-discount-store',
        }
    )
);

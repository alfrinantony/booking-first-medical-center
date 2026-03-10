// ─────────────────────────────────────────────────────────────
// Review Discount Store — Google Review tracking with Azure Blob persistence
// ─────────────────────────────────────────────────────────────

import { loadFromBlob, saveToBlob } from './blob-persistence';
import { clinics } from './data';

/* ────────────────────────────────────────────
 * Google Review Discount Store
 *
 * Tracks customer-submitted Google review ratings per branch.
 * Discount rules (graduated by branches visited + reviewed):
 *   • 5★ review for 1 visited branch  → 1% off
 *   • 5★ reviews for 2 visited branches → 2% off
 *   • 5★ reviews for 3 visited branches → 3% off
 *   • Any review < 5★                  → 0%
 *   • No reviews                        → 0%
 * ──────────────────────────────────────────── */

export interface GoogleReview {
    id: string;
    customerPhone: string;
    clinicId: string;
    rating: number; // 1-5
    submittedAt: string;
}

export interface ReviewDiscountResult {
    percent: number;       // 0, 1, 2, or 3
    reviewedBranches: number;
    totalBranches: number;
    hasSubFiveReview: boolean;
}

// ── In-memory store ──
let reviews: GoogleReview[] = [];
let reviewDiscountLoaded = false;

async function ensureReviewDiscountLoaded() {
    if (!reviewDiscountLoaded) {
        const data = await loadFromBlob<{ reviews: GoogleReview[] }>('review-discounts', { reviews: [] });
        reviews = data.reviews;
        reviewDiscountLoaded = true;
    }
}

async function saveReviewDiscount() {
    await saveToBlob('review-discounts', { reviews });
}

export const ReviewDiscountStore = {
    submitReview: async (customerPhone: string, clinicId: string, rating: number) => {
        await ensureReviewDiscountLoaded();
        const clamped = Math.max(1, Math.min(5, Math.round(rating)));

        // Upsert: replace existing review for same customer+branch
        reviews = reviews.filter(
            r => !(r.customerPhone === customerPhone && r.clinicId === clinicId)
        );
        reviews.push({
            id: `rev-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            customerPhone,
            clinicId,
            rating: clamped,
            submittedAt: new Date().toISOString(),
        });
        await saveReviewDiscount();
    },

    getCustomerReviews: async (customerPhone: string): Promise<GoogleReview[]> => {
        await ensureReviewDiscountLoaded();
        return reviews.filter(r => r.customerPhone === customerPhone);
    },

    getReviewDiscount: async (customerPhone: string): Promise<ReviewDiscountResult> => {
        await ensureReviewDiscountLoaded();
        const allClinicIds = clinics.map(c => c.id);
        const totalBranches = allClinicIds.length;
        const customerReviews = reviews.filter(r => r.customerPhone === customerPhone);

        if (customerReviews.length === 0) {
            return { percent: 0, reviewedBranches: 0, totalBranches, hasSubFiveReview: false };
        }

        const hasSubFiveReview = customerReviews.some(r => r.rating < 5);
        if (hasSubFiveReview) {
            return { percent: 0, reviewedBranches: customerReviews.length, totalBranches, hasSubFiveReview: true };
        }

        const fiveStarBranches = new Set(
            customerReviews.filter(r => r.rating === 5).map(r => r.clinicId)
        );
        const reviewedBranches = fiveStarBranches.size;
        const percent = Math.min(reviewedBranches, 3);
        return { percent, reviewedBranches, totalBranches, hasSubFiveReview: false };
    },

    getAllReviews: async (): Promise<GoogleReview[]> => {
        await ensureReviewDiscountLoaded();
        return [...reviews];
    },

    deleteReview: async (id: string) => {
        await ensureReviewDiscountLoaded();
        reviews = reviews.filter(r => r.id !== id);
        await saveReviewDiscount();
    },
};

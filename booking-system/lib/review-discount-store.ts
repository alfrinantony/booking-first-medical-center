import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
 *
 * Eligibility: customer must have booked at the branch to review it.
 * Gmail: customer must have a Google (Gmail) account.
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
    percent: number;       // 0, 1, 2, or 3
    reviewedBranches: number;
    totalBranches: number;
    hasSubFiveReview: boolean;
}

interface ReviewDiscountState {
    reviews: GoogleReview[];
    _synced: boolean; // Whether initial server sync has happened
    _googleChecked: boolean; // Whether Google Places API check has run

    // Customer actions
    submitReview: (customerPhone: string, clinicId: string, rating: number) => void;
    getCustomerReviews: (customerPhone: string) => GoogleReview[];
    getReviewDiscount: (customerPhone: string) => ReviewDiscountResult;

    // Sync with server
    syncWithServer: () => Promise<void>;

    // Auto-detect Google reviews via Places API
    fetchGoogleReviews: (customerName: string, customerId: string) => Promise<number>;

    // Admin
    getAllReviews: () => GoogleReview[];
    deleteReview: (id: string) => void;
}

export const useReviewDiscountStore = create<ReviewDiscountState>()(
    persist(
        (set, get) => ({
            reviews: [],
            _synced: false,
            _googleChecked: false,

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

                // Check for any sub-5 review — disqualifies all discounts
                const hasSubFiveReview = customerReviews.some(r => r.rating < 5);
                if (hasSubFiveReview) {
                    return { percent: 0, reviewedBranches: customerReviews.length, totalBranches, hasSubFiveReview: true };
                }

                // Count 5-star reviewed branches → graduated discount
                const fiveStarBranches = new Set(
                    customerReviews.filter(r => r.rating === 5).map(r => r.clinicId)
                );
                const reviewedBranches = fiveStarBranches.size;

                // 1 branch = 1%, 2 branches = 2%, 3+ branches = 3%
                const percent = Math.min(reviewedBranches, 3);
                return { percent, reviewedBranches, totalBranches, hasSubFiveReview: false };

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

            /**
             * Fetch real Google reviews via Places API and auto-detect
             * if the customer has already reviewed any branch.
             * Returns the number of new reviews auto-detected.
             */
            fetchGoogleReviews: async (customerName, customerId) => {
                if (get()._googleChecked) return 0;
                try {
                    const res = await fetch(
                        `/api/admin/google-reviews?customerName=${encodeURIComponent(customerName)}`
                    );
                    if (!res.ok) { set({ _googleChecked: true }); return 0; }
                    const data = await res.json();
                    const matches: { clinicId: string; rating: number }[] = data?.matches || [];

                    let autoDetected = 0;
                    for (const m of matches) {
                        // Only auto-fill if the customer hasn't already manually rated this branch
                        const existing = get().reviews.find(
                            r => r.customerPhone === customerId && r.clinicId === m.clinicId
                        );
                        if (!existing) {
                            // Use submitReview so it also persists to the server
                            get().submitReview(customerId, m.clinicId, m.rating);
                            autoDetected++;
                        }
                    }
                    set({ _googleChecked: true });
                    return autoDetected;
                } catch {
                    set({ _googleChecked: true });
                    return 0;
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

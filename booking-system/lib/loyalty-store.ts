import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type LoyaltyTransactionType = 'referral_reward' | 'service_earning' | 'redemption' | 'manual_adjustment';

export interface LoyaltyTransaction {
    id: string;
    customerPhone: string;
    type: LoyaltyTransactionType;
    points: number; // Positive for earning, negative for redemption
    description: string;
    netAmount?: number; // The net amount (excl tax) used for calculation
    createdAt: string;
}

interface LoyaltyState {
    transactions: LoyaltyTransaction[];

    // Earning methods
    addReferralReward: (referrerPhone: string, netAmount: number) => void;
    addServiceEarning: (customerPhone: string, netAmount: number) => void;
    addManualAdjustment: (customerPhone: string, points: number, description: string) => void;

    // Redemption
    redeemPoints: (customerPhone: string, redeemAmountAED: number) => { success: boolean; message: string; pointsUsed?: number };

    // Queries
    getBalance: (customerPhone: string) => number;
    getHistory: (customerPhone: string) => LoyaltyTransaction[];
}

// Constants
const REFERRAL_RATE = 0.01;    // 1% of net amount
const SERVICE_RATE = 0.005;    // 0.5% of net amount
const EARNING_MULTIPLIER = 10; // Points = eligible amount × 10
const REDEMPTION_MULTIPLIER = 15; // Points needed = AED amount × 15

export const useLoyaltyStore = create<LoyaltyState>()(
    persist(
        (set, get) => ({
            transactions: [],

            addReferralReward: (referrerPhone, netAmount) => {
                const eligibleAmount = netAmount * REFERRAL_RATE;
                const points = Math.floor(eligibleAmount * EARNING_MULTIPLIER);
                if (points <= 0) return;

                const tx: LoyaltyTransaction = {
                    id: `lty-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    customerPhone: referrerPhone,
                    type: 'referral_reward',
                    points,
                    description: `Referral reward: 1% of AED ${netAmount.toFixed(2)} (×10)`,
                    netAmount,
                    createdAt: new Date().toISOString(),
                };

                set(state => ({ transactions: [...state.transactions, tx] }));
            },

            addServiceEarning: (customerPhone, netAmount) => {
                const eligibleAmount = netAmount * SERVICE_RATE;
                const points = Math.floor(eligibleAmount * EARNING_MULTIPLIER);
                if (points <= 0) return;

                const tx: LoyaltyTransaction = {
                    id: `lty-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    customerPhone,
                    type: 'service_earning',
                    points,
                    description: `Service earning: 0.5% of AED ${netAmount.toFixed(2)} (×10)`,
                    netAmount,
                    createdAt: new Date().toISOString(),
                };

                set(state => ({ transactions: [...state.transactions, tx] }));
            },

            addManualAdjustment: (customerPhone, points, description) => {
                const tx: LoyaltyTransaction = {
                    id: `lty-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    customerPhone,
                    type: 'manual_adjustment',
                    points,
                    description: `Manual: ${description}`,
                    createdAt: new Date().toISOString(),
                };

                set(state => ({ transactions: [...state.transactions, tx] }));
            },

            redeemPoints: (customerPhone, redeemAmountAED) => {
                const balance = get().getBalance(customerPhone);
                const pointsNeeded = Math.ceil(redeemAmountAED * REDEMPTION_MULTIPLIER);

                if (balance < pointsNeeded) {
                    return {
                        success: false,
                        message: `Insufficient points. Need ${pointsNeeded} points (have ${balance}). AED ${redeemAmountAED} requires ${pointsNeeded} points at ×15 rate.`,
                    };
                }

                const tx: LoyaltyTransaction = {
                    id: `lty-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    customerPhone,
                    type: 'redemption',
                    points: -pointsNeeded,
                    description: `Redeemed ${pointsNeeded} points for AED ${redeemAmountAED.toFixed(2)}`,
                    netAmount: redeemAmountAED,
                    createdAt: new Date().toISOString(),
                };

                set(state => ({ transactions: [...state.transactions, tx] }));

                return {
                    success: true,
                    message: `Successfully redeemed ${pointsNeeded} points for AED ${redeemAmountAED.toFixed(2)}`,
                    pointsUsed: pointsNeeded,
                };
            },

            getBalance: (customerPhone) => {
                return get().transactions
                    .filter(t => t.customerPhone === customerPhone)
                    .reduce((sum, t) => sum + t.points, 0);
            },

            getHistory: (customerPhone) => {
                return get().transactions
                    .filter(t => t.customerPhone === customerPhone)
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            },
        }),
        {
            name: 'loyalty-store',
        }
    )
);

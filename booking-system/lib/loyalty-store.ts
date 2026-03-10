// ─────────────────────────────────────────────────────────────
// Loyalty Store — Points & Redemption with Azure Blob persistence
// ─────────────────────────────────────────────────────────────

import { loadFromBlob, saveToBlob } from './blob-persistence';

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

// Constants
const REFERRAL_RATE = 0.01;    // 1% of net amount
const SERVICE_RATE = 0.005;    // 0.5% of net amount
const EARNING_MULTIPLIER = 10; // Points = eligible amount × 10
const REDEMPTION_MULTIPLIER = 15; // Points needed = AED amount × 15

// ── In-memory store ──
let transactions: LoyaltyTransaction[] = [];
let loyaltyLoaded = false;

async function ensureLoyaltyLoaded() {
    if (!loyaltyLoaded) {
        const data = await loadFromBlob<{ transactions: LoyaltyTransaction[] }>('loyalty', { transactions: [] });
        transactions = data.transactions;
        loyaltyLoaded = true;
    }
}

async function saveLoyalty() {
    await saveToBlob('loyalty', { transactions });
}

export const LoyaltyStore = {
    addReferralReward: async (referrerPhone: string, netAmount: number) => {
        await ensureLoyaltyLoaded();
        const eligibleAmount = netAmount * REFERRAL_RATE;
        const points = Math.floor(eligibleAmount * EARNING_MULTIPLIER);
        if (points <= 0) return;

        transactions.push({
            id: `lty-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            customerPhone: referrerPhone,
            type: 'referral_reward',
            points,
            description: `Referral reward: 1% of AED ${netAmount.toFixed(2)} (×10)`,
            netAmount,
            createdAt: new Date().toISOString(),
        });
        await saveLoyalty();
    },

    addServiceEarning: async (customerPhone: string, netAmount: number) => {
        await ensureLoyaltyLoaded();
        const eligibleAmount = netAmount * SERVICE_RATE;
        const points = Math.floor(eligibleAmount * EARNING_MULTIPLIER);
        if (points <= 0) return;

        transactions.push({
            id: `lty-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            customerPhone,
            type: 'service_earning',
            points,
            description: `Service earning: 0.5% of AED ${netAmount.toFixed(2)} (×10)`,
            netAmount,
            createdAt: new Date().toISOString(),
        });
        await saveLoyalty();
    },

    addManualAdjustment: async (customerPhone: string, points: number, description: string) => {
        await ensureLoyaltyLoaded();
        transactions.push({
            id: `lty-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            customerPhone,
            type: 'manual_adjustment',
            points,
            description: `Manual: ${description}`,
            createdAt: new Date().toISOString(),
        });
        await saveLoyalty();
    },

    redeemPoints: async (customerPhone: string, redeemAmountAED: number): Promise<{ success: boolean; message: string; pointsUsed?: number }> => {
        await ensureLoyaltyLoaded();
        const balance = LoyaltyStore.getBalanceSync(customerPhone);
        const pointsNeeded = Math.ceil(redeemAmountAED * REDEMPTION_MULTIPLIER);

        if (balance < pointsNeeded) {
            return {
                success: false,
                message: `Insufficient points. Need ${pointsNeeded} points (have ${balance}). AED ${redeemAmountAED} requires ${pointsNeeded} points at ×15 rate.`,
            };
        }

        transactions.push({
            id: `lty-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            customerPhone,
            type: 'redemption',
            points: -pointsNeeded,
            description: `Redeemed ${pointsNeeded} points for AED ${redeemAmountAED.toFixed(2)}`,
            netAmount: redeemAmountAED,
            createdAt: new Date().toISOString(),
        });
        await saveLoyalty();

        return {
            success: true,
            message: `Successfully redeemed ${pointsNeeded} points for AED ${redeemAmountAED.toFixed(2)}`,
            pointsUsed: pointsNeeded,
        };
    },

    getBalance: async (customerPhone: string): Promise<number> => {
        await ensureLoyaltyLoaded();
        return transactions
            .filter(t => t.customerPhone === customerPhone)
            .reduce((sum, t) => sum + t.points, 0);
    },

    // Sync version (only call after ensureLoyaltyLoaded)
    getBalanceSync: (customerPhone: string): number => {
        return transactions
            .filter(t => t.customerPhone === customerPhone)
            .reduce((sum, t) => sum + t.points, 0);
    },

    getHistory: async (customerPhone: string): Promise<LoyaltyTransaction[]> => {
        await ensureLoyaltyLoaded();
        return transactions
            .filter(t => t.customerPhone === customerPhone)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },

    getAllTransactions: async (): Promise<LoyaltyTransaction[]> => {
        await ensureLoyaltyLoaded();
        return [...transactions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
};

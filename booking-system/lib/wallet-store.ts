import { loadFromBlob, saveToBlob } from './blob-persistence';

export interface WalletTransaction {
    id: string;
    date: string;       // ISO datetime
    amount: number;     // Negative for deduction, Positive for addition
    type: 'refund' | 'payment_credit' | 'promotion' | 'deduction' | 'package_conversion' | 'restricted_usage';
    description: string;
    referenceId?: string; // e.g., Invoice ID or Package ID
    staffName?: string;
    isRestricted?: boolean; // Flag to indicate if transaction affects restricted balance
}

export interface RestrictedBalance {
    id: string;
    amount: number; // Current remaining amount
    expiryDate: string; // ISO datetime
    sourcePackageId: string;
    description: string;
}

export interface ClientWallet {
    clientPhone: string;
    clientName: string;
    balance: number;
    currency: string;
    transactions: WalletTransaction[];
    restrictedBalances?: RestrictedBalance[]; // Optional for backwards compatibility
}

interface WalletData {
    wallets: ClientWallet[];
}

let wallets: ClientWallet[] = [];
async function ensureWalletLoaded() {
    
        const data = await loadFromBlob<WalletData>('wallets', { wallets: [] });
        wallets = data.wallets || [];
        
}

async function saveWallet() {
    await saveToBlob<WalletData>('wallets', { wallets });
}

export const WalletStore = {
    getWallet: async (clientPhone: string): Promise<ClientWallet | null> => {
        await ensureWalletLoaded();
        return wallets.find(w => w.clientPhone === clientPhone) || null;
    },

    getOrCreateWallet: async (clientPhone: string, clientName: string): Promise<ClientWallet> => {
        await ensureWalletLoaded();
        let wallet = wallets.find(w => w.clientPhone === clientPhone);
        if (!wallet) {
            wallet = {
                clientPhone,
                clientName,
                balance: 0,
                currency: 'AED',
                transactions: [],
            };
            wallets.push(wallet);
            await saveWallet();
        }
        return wallet;
    },

    addTransaction: async (
        clientPhone: string,
        clientName: string,
        amount: number,
        type: WalletTransaction['type'],
        description: string,
        referenceId?: string,
        staffName?: string
    ): Promise<ClientWallet> => {
        const wallet = await WalletStore.getOrCreateWallet(clientPhone, clientName);

        const transaction: WalletTransaction = {
            id: `txn-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            date: new Date().toISOString(),
            amount,
            type,
            description,
            referenceId,
            staffName,
        };

        wallet.transactions.push(transaction);
        wallet.balance += amount; // amounts can be negative
        wallet.balance = parseFloat(wallet.balance.toFixed(2)); // handle float precision

        await saveWallet();
        return wallet;
    },

    addRestrictedBalance: async (
        clientPhone: string,
        clientName: string,
        amount: number,
        expiryDate: string,
        sourcePackageId: string,
        description: string,
        staffName?: string
    ): Promise<ClientWallet> => {
        const wallet = await WalletStore.getOrCreateWallet(clientPhone, clientName);
        
        if (!wallet.restrictedBalances) wallet.restrictedBalances = [];
        
        wallet.restrictedBalances.push({
            id: `rest-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            amount: parseFloat(amount.toFixed(2)),
            expiryDate,
            sourcePackageId,
            description
        });

        wallet.transactions.push({
            id: `txn-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            date: new Date().toISOString(),
            amount,
            type: 'package_conversion',
            description,
            referenceId: sourcePackageId,
            staffName,
            isRestricted: true,
        });

        await saveWallet();
        return wallet;
    },

    deductRestrictedBalance: async (
        clientPhone: string,
        clientName: string,
        amountToDeduct: number,
        description: string,
        staffName?: string
    ): Promise<{ remainingAmountToPay: number, deductedRestricted: number, wallet: ClientWallet | null }> => {
        const wallet = await WalletStore.getWallet(clientPhone);
        if (!wallet || !wallet.restrictedBalances || wallet.restrictedBalances.length === 0) {
            return { remainingAmountToPay: amountToDeduct, deductedRestricted: 0, wallet };
        }

        // Clean up expired balances first
        const now = new Date();
        wallet.restrictedBalances = wallet.restrictedBalances.filter(rb => new Date(rb.expiryDate) > now && rb.amount > 0);

        if (wallet.restrictedBalances.length === 0) {
            return { remainingAmountToPay: amountToDeduct, deductedRestricted: 0, wallet };
        }

        // Sort by closest expiry date
        wallet.restrictedBalances.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

        let remainingToPay = amountToDeduct;
        let totalDeducted = 0;

        for (let i = 0; i < wallet.restrictedBalances.length && remainingToPay > 0; i++) {
            const rb = wallet.restrictedBalances[i];
            const deduction = Math.min(rb.amount, remainingToPay);
            
            rb.amount -= deduction;
            rb.amount = parseFloat(rb.amount.toFixed(2));
            
            remainingToPay -= deduction;
            remainingToPay = parseFloat(remainingToPay.toFixed(2));
            
            totalDeducted += deduction;
            totalDeducted = parseFloat(totalDeducted.toFixed(2));

            // Log individual deduction
            if (deduction > 0) {
                wallet.transactions.push({
                    id: `txn-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    date: new Date().toISOString(),
                    amount: -deduction,
                    type: 'restricted_usage',
                    description: `Used from restricted balance (${rb.description}): ${description}`,
                    referenceId: rb.id,
                    staffName,
                    isRestricted: true,
                });
            }
        }

        // Clean up empty balances
        wallet.restrictedBalances = wallet.restrictedBalances.filter(rb => rb.amount > 0);

        await saveWallet();
        return { remainingAmountToPay: remainingToPay, deductedRestricted: totalDeducted, wallet };
    },
};

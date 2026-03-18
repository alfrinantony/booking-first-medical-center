import { loadFromBlob, saveToBlob } from './blob-persistence';

export interface WalletTransaction {
    id: string;
    date: string;       // ISO datetime
    amount: number;     // Negative for deduction, Positive for addition
    type: 'refund' | 'payment_credit' | 'promotion' | 'deduction';
    description: string;
    referenceId?: string; // e.g., Invoice ID or Package ID
    staffName?: string;
}

export interface ClientWallet {
    clientPhone: string;
    clientName: string;
    balance: number;
    currency: string;
    transactions: WalletTransaction[];
}

interface WalletData {
    wallets: ClientWallet[];
}

let wallets: ClientWallet[] = [];
let walletLoaded = false;

async function ensureWalletLoaded() {
    if (!walletLoaded) {
        const data = await loadFromBlob<WalletData>('wallets', { wallets: [] });
        wallets = data.wallets || [];
        walletLoaded = true;
    }
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
};

import { initialBranchContracts, BranchContract } from './data';
import { loadFromBlob, saveToBlob } from './blob-persistence';

let contractStore: BranchContract[] = JSON.parse(JSON.stringify(initialBranchContracts));
let loaded = false;

async function ensureLoaded() {
    if (!loaded) {
        contractStore = await loadFromBlob<BranchContract[]>('contracts', contractStore);
        loaded = true;
    }
}

export const ContractsStore = {
    getAll: async (): Promise<BranchContract[]> => {
        await ensureLoaded();
        return contractStore;
    },

    getByClinic: async (clinicId: string): Promise<BranchContract[]> => {
        await ensureLoaded();
        return contractStore.filter(c => c.clinicId === clinicId);
    },

    getById: async (id: string): Promise<BranchContract | undefined> => {
        await ensureLoaded();
        return contractStore.find(c => c.id === id);
    },

    add: async (contract: Omit<BranchContract, 'id'>): Promise<BranchContract> => {
        await ensureLoaded();
        const newContract: BranchContract = {
            ...contract,
            id: `contract-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        };
        contractStore.push(newContract);
        await saveToBlob('contracts', contractStore);
        return newContract;
    },

    update: async (id: string, updates: Partial<BranchContract>): Promise<BranchContract | null> => {
        await ensureLoaded();
        const index = contractStore.findIndex(c => c.id === id);
        if (index === -1) return null;
        contractStore[index] = { ...contractStore[index], ...updates };
        await saveToBlob('contracts', contractStore);
        return contractStore[index];
    },

    remove: async (id: string): Promise<boolean> => {
        await ensureLoaded();
        const len = contractStore.length;
        contractStore = contractStore.filter(c => c.id !== id);
        if (contractStore.length < len) {
            await saveToBlob('contracts', contractStore);
            return true;
        }
        return false;
    },
};

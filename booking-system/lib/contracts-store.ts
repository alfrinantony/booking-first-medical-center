import { initialBranchContracts, BranchContract } from './data';

// In-memory store for branch contracts
let contractStore: BranchContract[] = JSON.parse(JSON.stringify(initialBranchContracts));

export const ContractsStore = {
    getAll: (): BranchContract[] => {
        return contractStore;
    },

    getByClinic: (clinicId: string): BranchContract[] => {
        return contractStore.filter(c => c.clinicId === clinicId);
    },

    getById: (id: string): BranchContract | undefined => {
        return contractStore.find(c => c.id === id);
    },

    add: (contract: Omit<BranchContract, 'id'>): BranchContract => {
        const newContract: BranchContract = {
            ...contract,
            id: `contract-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        };
        contractStore.push(newContract);
        return newContract;
    },

    update: (id: string, updates: Partial<BranchContract>): BranchContract | null => {
        const index = contractStore.findIndex(c => c.id === id);
        if (index === -1) return null;
        contractStore[index] = { ...contractStore[index], ...updates };
        return contractStore[index];
    },

    remove: (id: string): boolean => {
        const len = contractStore.length;
        contractStore = contractStore.filter(c => c.id !== id);
        return contractStore.length < len;
    },
};

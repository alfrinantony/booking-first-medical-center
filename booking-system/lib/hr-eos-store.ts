import { loadFromBlob, saveToBlob } from './blob-persistence';
import type { EndOfServiceCalculation } from './hr-payroll-store';

export interface EOSRecord {
    id: string;
    employeeId: string;
    calculation: EndOfServiceCalculation;
    createdAt: string;
    updatedAt: string;
}

let eosRecords: EOSRecord[] = [];

async function ensureStoreLoaded() {
    eosRecords = await loadFromBlob<EOSRecord[]>('hr-eos', []);
}

async function saveStore() {
    await saveToBlob('hr-eos', eosRecords);
}

export const HREosStore = {
    getForEmployee: async (employeeId: string): Promise<EOSRecord | null> => {
        await ensureStoreLoaded();
        return eosRecords.find(r => r.employeeId === employeeId) || null;
    },

    save: async (employeeId: string, calculation: EndOfServiceCalculation): Promise<EOSRecord> => {
        await ensureStoreLoaded();
        const existingIndex = eosRecords.findIndex(r => r.employeeId === employeeId);
        
        const now = new Date().toISOString();
        if (existingIndex >= 0) {
            eosRecords[existingIndex] = {
                ...eosRecords[existingIndex],
                calculation,
                updatedAt: now
            };
            await saveStore();
            return eosRecords[existingIndex];
        } else {
            const newRecord: EOSRecord = {
                id: `eos-${Date.now()}`,
                employeeId,
                calculation,
                createdAt: now,
                updatedAt: now
            };
            eosRecords.push(newRecord);
            await saveStore();
            return newRecord;
        }
    }
};

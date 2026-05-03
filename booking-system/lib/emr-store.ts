// ─────────────────────────────────────────────────────────────
// EMR Store — EMR config & push status with Azure Blob persistence
// ─────────────────────────────────────────────────────────────

import { loadFromBlob, saveToBlob } from './blob-persistence';

/* ── Masking Utilities ── */

export * from './mask-utils';

/* ── EMR Push Status ── */

export interface EMRPushRecord {
    clientId: string;
    status: 'pending' | 'success' | 'failed';
    timestamp: string;
    emrReferenceId?: string;
    errorMessage?: string;
}

/* ── EMR Config ── */

export interface EMRConfig {
    endpointUrl: string;
    apiKey: string;
    enabled: boolean;
    maskContacts: boolean;
}

// ── In-memory store ──
interface EMRData {
    config: EMRConfig;
    pushRecords: EMRPushRecord[];
}

const DEFAULT_CONFIG: EMRConfig = {
    endpointUrl: '',
    apiKey: '',
    enabled: false,
    maskContacts: true,
};

let config: EMRConfig = { ...DEFAULT_CONFIG };
let pushRecords: EMRPushRecord[] = [];
async function ensureEMRLoaded() {
    
        const data = await loadFromBlob<EMRData>('emr-config', { config: DEFAULT_CONFIG, pushRecords: [] });
        config = data.config;
        pushRecords = data.pushRecords;
        
}

async function saveEMR() {
    await saveToBlob<EMRData>('emr-config', { config, pushRecords });
}

export const EMRStore = {
    getConfig: async (): Promise<EMRConfig> => {
        await ensureEMRLoaded();
        return { ...config };
    },

    updateConfig: async (updates: Partial<EMRConfig>) => {
        await ensureEMRLoaded();
        config = { ...config, ...updates };
        await saveEMR();
    },

    setPushStatus: async (clientId: string, record: Omit<EMRPushRecord, 'clientId'>) => {
        await ensureEMRLoaded();
        const newRecord: EMRPushRecord = { clientId, ...record };
        const existing = pushRecords.findIndex(r => r.clientId === clientId);
        if (existing >= 0) {
            pushRecords[existing] = newRecord;
        } else {
            pushRecords.push(newRecord);
        }
        await saveEMR();
    },

    getPushStatus: async (clientId: string): Promise<EMRPushRecord | undefined> => {
        await ensureEMRLoaded();
        return pushRecords.find(r => r.clientId === clientId);
    },

    testConnection: async (): Promise<{ success: boolean; message: string }> => {
        await ensureEMRLoaded();
        if (!config.endpointUrl) {
            return { success: false, message: 'EMR endpoint URL is not configured.' };
        }
        try {
            const res = await fetch(config.endpointUrl, {
                method: 'OPTIONS',
                headers: { 'Authorization': `Bearer ${config.apiKey}` },
            });
            if (res.ok || res.status === 204) {
                return { success: true, message: 'Connection successful!' };
            }
            return { success: false, message: `Server responded with status ${res.status}` };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Connection failed';
            return { success: false, message };
        }
    },
};

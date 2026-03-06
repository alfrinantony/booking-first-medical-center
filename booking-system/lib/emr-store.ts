import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/* ── Masking Utilities ── */

export function maskPhone(phone: string | undefined): string {
    if (!phone) return '—';
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4) return '•'.repeat(phone.length);
    // Show first 4 and last 2 digits, mask the rest
    const visible = phone.slice(0, Math.min(7, phone.length - 3));
    const masked = '•'.repeat(Math.max(0, phone.length - visible.length - 2));
    const tail = phone.slice(-2);
    return visible + masked + tail;
}

export function maskEmail(email: string | undefined): string {
    if (!email) return '—';
    const [local, domain] = email.split('@');
    if (!domain) return '•'.repeat(email.length);
    const visibleLocal = local.slice(0, Math.min(2, local.length));
    const maskedLocal = '•'.repeat(Math.max(0, local.length - 2));
    return `${visibleLocal}${maskedLocal}@${domain}`;
}

/* ── EMR Push Status ── */

export interface EMRPushRecord {
    clientId: string;
    status: 'pending' | 'success' | 'failed';
    timestamp: string;
    emrReferenceId?: string;
    errorMessage?: string;
}

/* ── EMR Store ── */

interface EMRConfig {
    endpointUrl: string;
    apiKey: string;
    enabled: boolean;
    maskContacts: boolean;
}

interface EMRState {
    config: EMRConfig;
    pushRecords: EMRPushRecord[];

    // Config actions
    updateConfig: (updates: Partial<EMRConfig>) => void;

    // Push actions
    setPushStatus: (clientId: string, record: Omit<EMRPushRecord, 'clientId'>) => void;
    getPushStatus: (clientId: string) => EMRPushRecord | undefined;

    // Test connection
    testConnection: () => Promise<{ success: boolean; message: string }>;
}

export const useEMRStore = create<EMRState>()(
    persist(
        (set, get) => ({
            config: {
                endpointUrl: '',
                apiKey: '',
                enabled: false,
                maskContacts: true,
            },
            pushRecords: [],

            updateConfig: (updates) => {
                set(state => ({
                    config: { ...state.config, ...updates }
                }));
            },

            setPushStatus: (clientId, record) => {
                set(state => {
                    const existing = state.pushRecords.findIndex(r => r.clientId === clientId);
                    const newRecord: EMRPushRecord = { clientId, ...record };
                    if (existing >= 0) {
                        const updated = [...state.pushRecords];
                        updated[existing] = newRecord;
                        return { pushRecords: updated };
                    }
                    return { pushRecords: [...state.pushRecords, newRecord] };
                });
            },

            getPushStatus: (clientId) => {
                return get().pushRecords.find(r => r.clientId === clientId);
            },

            testConnection: async () => {
                const { config } = get();
                if (!config.endpointUrl) {
                    return { success: false, message: 'EMR endpoint URL is not configured.' };
                }
                try {
                    const res = await fetch(config.endpointUrl, {
                        method: 'OPTIONS',
                        headers: {
                            'Authorization': `Bearer ${config.apiKey}`,
                        },
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
        }),
        {
            name: 'emr-integration-storage',
        }
    )
);

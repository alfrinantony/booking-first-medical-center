import { loadFromBlob, saveToBlob } from './blob-persistence';

export interface LogEntry {
    id: string;
    timestamp: string;
    userId: string; // ID of the user performing the action
    userName?: string; // Optional readable name
    action: string; // e.g., 'CREATE_BOOKING', 'UPDATE_CLIENT', 'MERGE_CLIENTS'
    details: string; // Description of the change
    entityId?: string; // ID of the affected object (Booking ID, Client ID)
    entityType?: string; // 'Booking', 'Client', 'System'
}

let logs: LogEntry[] = [];
let loaded = false;

async function ensureLoaded() {
    if (!loaded) {
        logs = await loadFromBlob<LogEntry[]>('logs', []);
        loaded = true;
    }
}

export const LogsStore = {
    getAll: async () => {
        await ensureLoaded();
        return [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    },

    add: async (entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
        await ensureLoaded();
        const newLog: LogEntry = {
            id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            timestamp: new Date().toISOString(),
            ...entry
        };
        logs.unshift(newLog); // Add to beginning
        await saveToBlob('logs', logs);
        return newLog;
    }
};

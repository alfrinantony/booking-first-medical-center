import { initialCallAgentSummaries, CallAgentSummary } from './data';
import { loadFromBlob, saveToBlob } from './blob-persistence';

let summaryStore: CallAgentSummary[] = JSON.parse(JSON.stringify(initialCallAgentSummaries));
let casLoaded = false;

async function ensureCASLoaded() {
    if (!casLoaded) {
        summaryStore = await loadFromBlob<CallAgentSummary[]>('call-agent-summaries', initialCallAgentSummaries);
        casLoaded = true;
    }
}

export const CallAgentSummaryStore = {
    getAll: async (): Promise<CallAgentSummary[]> => {
        await ensureCASLoaded();
        return summaryStore;
    },

    getById: async (id: string): Promise<CallAgentSummary | undefined> => {
        await ensureCASLoaded();
        return summaryStore.find(s => s.id === id);
    },

    add: async (summary: Omit<CallAgentSummary, 'id' | 'createdAt'>): Promise<CallAgentSummary> => {
        await ensureCASLoaded();
        const newSummary: CallAgentSummary = {
            ...summary,
            id: `cas-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            createdAt: new Date().toISOString(),
        };
        summaryStore.unshift(newSummary);
        await saveToBlob('call-agent-summaries', summaryStore);
        return newSummary;
    },

    update: async (id: string, updates: Partial<CallAgentSummary>): Promise<CallAgentSummary | null> => {
        await ensureCASLoaded();
        const index = summaryStore.findIndex(s => s.id === id);
        if (index === -1) return null;
        summaryStore[index] = { ...summaryStore[index], ...updates };
        await saveToBlob('call-agent-summaries', summaryStore);
        return summaryStore[index];
    },

    remove: async (id: string): Promise<boolean> => {
        await ensureCASLoaded();
        const len = summaryStore.length;
        summaryStore = summaryStore.filter(s => s.id !== id);
        if (summaryStore.length < len) {
            await saveToBlob('call-agent-summaries', summaryStore);
            return true;
        }
        return false;
    },
};

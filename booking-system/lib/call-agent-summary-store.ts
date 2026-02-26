import { initialCallAgentSummaries, CallAgentSummary } from './data';

// In-memory store for call agent summaries
let summaryStore: CallAgentSummary[] = JSON.parse(JSON.stringify(initialCallAgentSummaries));

export const CallAgentSummaryStore = {
    getAll: (): CallAgentSummary[] => {
        return summaryStore;
    },

    getById: (id: string): CallAgentSummary | undefined => {
        return summaryStore.find(s => s.id === id);
    },

    add: (summary: Omit<CallAgentSummary, 'id' | 'createdAt'>): CallAgentSummary => {
        const newSummary: CallAgentSummary = {
            ...summary,
            id: `cas-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            createdAt: new Date().toISOString(),
        };
        summaryStore.unshift(newSummary); // newest first
        return newSummary;
    },

    update: (id: string, updates: Partial<CallAgentSummary>): CallAgentSummary | null => {
        const index = summaryStore.findIndex(s => s.id === id);
        if (index === -1) return null;
        summaryStore[index] = { ...summaryStore[index], ...updates };
        return summaryStore[index];
    },

    remove: (id: string): boolean => {
        const len = summaryStore.length;
        summaryStore = summaryStore.filter(s => s.id !== id);
        return summaryStore.length < len;
    },
};

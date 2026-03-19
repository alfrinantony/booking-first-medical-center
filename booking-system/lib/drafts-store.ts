// ─────────────────────────────────────────────────────────────
// Drafts Store — Auto-saves user form drafts to Azure Blob
// ─────────────────────────────────────────────────────────────

import { loadFromBlob, saveToBlob } from './blob-persistence';

// Internal memory mapping: { "userId": { "formId": data } }
let drafts: Record<string, Record<string, any>> = {};
async function ensureDraftsLoaded() {
    
        drafts = await loadFromBlob<Record<string, Record<string, any>>>('form-drafts', {});
        
}

async function persistDrafts() {
    await saveToBlob('form-drafts', drafts);
}

export const DraftsStore = {
    getDraft: async (userId: string, formId: string) => {
        await ensureDraftsLoaded();
        return drafts[userId]?.[formId] || null;
    },

    saveDraft: async (userId: string, formId: string, data: any) => {
        await ensureDraftsLoaded();
        if (!drafts[userId]) {
            drafts[userId] = {};
        }
        drafts[userId][formId] = {
            ...data,
            _updatedAt: new Date().toISOString()
        };
        await persistDrafts();
    },

    clearDraft: async (userId: string, formId: string) => {
        await ensureDraftsLoaded();
        if (drafts[userId] && drafts[userId][formId]) {
            delete drafts[userId][formId];
            await persistDrafts();
        }
    }
};

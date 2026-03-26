import { loadFromBlob, saveToBlob } from './blob-persistence';

export interface ChecklistItem {
    id: string; // e.g., 'clinic-cleanliness'
    title: string;
    checked: boolean;
    photoUrl?: string; // Stored in Azure Blob
    notes?: string;
}

export interface DailyChecklist {
    id: string; // 'chk-123456789'
    date: string; // ISO String (YYYY-MM-DD)
    branchId: string;
    branchName: string;
    supervisorName: string; 
    items: ChecklistItem[];
    submittedAt: string;
}

let checklistStore: DailyChecklist[] = [];

async function ensureChecklistsLoaded() {
    checklistStore = await loadFromBlob<DailyChecklist[]>('checklists', []);
}

export const ChecklistStore = {
    getAll: async (): Promise<DailyChecklist[]> => {
        await ensureChecklistsLoaded();
        // Sort newest first
        return [...checklistStore].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },

    getByDate: async (dateStr: string): Promise<DailyChecklist[]> => {
        await ensureChecklistsLoaded();
        return checklistStore.filter(c => c.date === dateStr);
    },

    add: async (checklist: Omit<DailyChecklist, 'id' | 'submittedAt'>): Promise<DailyChecklist> => {
        await ensureChecklistsLoaded();
        const newChecklist: DailyChecklist = {
            ...checklist,
            id: `chk-${Date.now()}`,
            submittedAt: new Date().toISOString()
        };
        checklistStore.push(newChecklist);
        await saveToBlob('checklists', checklistStore);
        return newChecklist;
    },

    update: async (id: string, updates: Partial<DailyChecklist>): Promise<DailyChecklist | null> => {
        await ensureChecklistsLoaded();
        const index = checklistStore.findIndex(c => c.id === id);
        if (index === -1) return null;
        
        checklistStore[index] = { ...checklistStore[index], ...updates };
        await saveToBlob('checklists', checklistStore);
        return checklistStore[index];
    },

    remove: async (id: string): Promise<boolean> => {
        await ensureChecklistsLoaded();
        const len = checklistStore.length;
        checklistStore = checklistStore.filter(c => c.id !== id);
        if (checklistStore.length < len) {
            await saveToBlob('checklists', checklistStore);
            return true;
        }
        return false;
    }
};

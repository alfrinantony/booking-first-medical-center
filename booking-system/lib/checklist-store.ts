import { loadFromBlob, saveToBlob } from './blob-persistence';

// Room Checklist Status Enum
export type RoomChecklistStatus = 
    | 'Pending' 
    | 'Complete' 
    | 'Missing Items' 
    | 'Refill Required' 
    | 'Equipment Issue' 
    | 'Consumables Low' 
    | 'Medicine Low' 
    | 'Not Functioning Properly';

// Daily Room Checklist Entity
export interface RoomChecklist {
    id: string;
    date: string; // YYYY-MM-DD
    branchId: string;
    roomId: string; // Links to specific Room
    supervisorName: string;
    status: RoomChecklistStatus;
    
    // Photo Evidence (Azure URLs)
    pictures: string[]; 
    
    // Module Tracking
    missingItems: string[];
    remarks: string;
    
    equipmentChecks: { equipmentId: string; status: 'Available' | 'Issue' | 'Maintenance' | 'Missing' }[];
    consumableChecks: { itemName: string; status: 'Adequate' | 'Low' | 'Missing' | 'Refilled' }[];
    medicineChecks: { medicineId: string; requiredQty: number; refilledQty: number; shortage: number; missing: boolean }[];
    
    submittedAt: string;
}

let checklistStore: RoomChecklist[] = [];

async function ensureChecklistsLoaded() {
    checklistStore = await loadFromBlob<RoomChecklist[]>('room-checklists', []);
}

export const ChecklistStore = {
    getAll: async (): Promise<RoomChecklist[]> => {
        await ensureChecklistsLoaded();
        // Sort newest first
        return [...checklistStore].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },

    getByDate: async (dateStr: string): Promise<RoomChecklist[]> => {
        await ensureChecklistsLoaded();
        return checklistStore.filter(c => c.date === dateStr);
    },

    getByRoomAndDate: async (roomId: string, dateStr: string): Promise<RoomChecklist | undefined> => {
        await ensureChecklistsLoaded();
        return checklistStore.find(c => c.roomId === roomId && c.date === dateStr);
    },

    add: async (checklist: Omit<RoomChecklist, 'id' | 'submittedAt'>): Promise<RoomChecklist> => {
        await ensureChecklistsLoaded();
        const newChecklist: RoomChecklist = {
            ...checklist,
            id: `chk-${Date.now()}`,
            submittedAt: new Date().toISOString()
        };
        checklistStore.push(newChecklist);
        await saveToBlob('room-checklists', checklistStore);
        return newChecklist;
    },

    update: async (id: string, updates: Partial<RoomChecklist>): Promise<RoomChecklist | null> => {
        await ensureChecklistsLoaded();
        const index = checklistStore.findIndex(c => c.id === id);
        if (index === -1) return null;
        
        checklistStore[index] = { ...checklistStore[index], ...updates };
        await saveToBlob('room-checklists', checklistStore);
        return checklistStore[index];
    },

    remove: async (id: string): Promise<boolean> => {
        await ensureChecklistsLoaded();
        const len = checklistStore.length;
        checklistStore = checklistStore.filter(c => c.id !== id);
        if (checklistStore.length < len) {
            await saveToBlob('room-checklists', checklistStore);
            return true;
        }
        return false;
    }
};

import { loadFromBlob, saveToBlob } from './blob-persistence';

// ── Types ──
export interface EquipmentItem {
    id: string;
    name: string;
    category: string;
    brand: string;
    serialNumber: string;
    quantity: number;
    branchId: string;
    purchaseDate: string;
    warrantyExpiry: string;
    status: 'active' | 'maintenance' | 'damaged' | 'disposed';
    assignedDepartment: string;
    notes: string;
    lowStockThreshold: number;
    nextMaintenanceDate?: string;
}

export interface EquipmentHistoryEntry {
    id: string;
    equipmentId: string;
    action: 'new_entry' | 'transfer' | 'maintenance' | 'damage' | 'disposal' | 'edit';
    fromBranch?: string;
    toBranch?: string;
    notes: string;
    timestamp: string;
    quantityChanged?: number;
}

// ── In-memory state ──
let items: EquipmentItem[] = [];
let history: EquipmentHistoryEntry[] = [];
let loaded = false;

async function ensureLoaded() {
    if (!loaded) {
        items = await loadFromBlob<EquipmentItem[]>('equipment', []);
        history = await loadFromBlob<EquipmentHistoryEntry[]>('equipment-history', []);
        loaded = true;
    }
}

function genId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

// ── Store ──
export const EquipmentStore = {
    // ── Read ──
    getAll: async (filters?: { branchId?: string; status?: string; category?: string }) => {
        await ensureLoaded();
        let result = [...items];
        if (filters?.branchId) result = result.filter(i => i.branchId === filters.branchId);
        if (filters?.status) result = result.filter(i => i.status === filters.status);
        if (filters?.category) result = result.filter(i => i.category === filters.category);
        return result;
    },

    getById: async (id: string) => {
        await ensureLoaded();
        return items.find(i => i.id === id) || null;
    },

    // ── Create ──
    add: async (item: Omit<EquipmentItem, 'id'>) => {
        await ensureLoaded();
        const newItem: EquipmentItem = { ...item, id: genId('eq') };
        items.push(newItem);
        await saveToBlob('equipment', items);

        // History
        const entry: EquipmentHistoryEntry = {
            id: genId('eh'),
            equipmentId: newItem.id,
            action: 'new_entry',
            toBranch: newItem.branchId,
            notes: `Added ${newItem.quantity} unit(s)`,
            timestamp: new Date().toISOString(),
        };
        history.push(entry);
        await saveToBlob('equipment-history', history);

        return newItem;
    },

    // ── Update ──
    update: async (id: string, updates: Partial<Omit<EquipmentItem, 'id'>>) => {
        await ensureLoaded();
        const idx = items.findIndex(i => i.id === id);
        if (idx === -1) return null;

        const old = items[idx];
        items[idx] = { ...old, ...updates };
        await saveToBlob('equipment', items);

        // Status change history
        if (updates.status && updates.status !== old.status) {
            const actionMap: Record<string, EquipmentHistoryEntry['action']> = {
                maintenance: 'maintenance',
                damaged: 'damage',
                disposed: 'disposal',
            };
            const entry: EquipmentHistoryEntry = {
                id: genId('eh'),
                equipmentId: id,
                action: actionMap[updates.status] || 'edit',
                notes: `Status changed: ${old.status} → ${updates.status}`,
                timestamp: new Date().toISOString(),
            };
            history.push(entry);
            await saveToBlob('equipment-history', history);
        } else {
            const entry: EquipmentHistoryEntry = {
                id: genId('eh'),
                equipmentId: id,
                action: 'edit',
                notes: `Equipment details updated`,
                timestamp: new Date().toISOString(),
            };
            history.push(entry);
            await saveToBlob('equipment-history', history);
        }

        return items[idx];
    },

    // ── Delete ──
    delete: async (id: string) => {
        await ensureLoaded();
        const len = items.length;
        items = items.filter(i => i.id !== id);
        if (items.length < len) {
            await saveToBlob('equipment', items);
            return true;
        }
        return false;
    },

    // ── Transfer ──
    transfer: async (id: string, toBranchId: string, quantity: number, notes?: string) => {
        await ensureLoaded();
        const idx = items.findIndex(i => i.id === id);
        if (idx === -1) return null;

        const source = items[idx];
        if (quantity > source.quantity) return null;

        const fromBranch = source.branchId;

        if (quantity === source.quantity) {
            // Move entire item
            items[idx] = { ...source, branchId: toBranchId };
        } else {
            // Split: reduce source quantity, create new item at destination
            items[idx] = { ...source, quantity: source.quantity - quantity };
            const newItem: EquipmentItem = {
                ...source,
                id: genId('eq'),
                branchId: toBranchId,
                quantity,
            };
            items.push(newItem);
        }
        await saveToBlob('equipment', items);

        // History
        const entry: EquipmentHistoryEntry = {
            id: genId('eh'),
            equipmentId: id,
            action: 'transfer',
            fromBranch,
            toBranch: toBranchId,
            notes: notes || `Transferred ${quantity} unit(s)`,
            quantityChanged: quantity,
            timestamp: new Date().toISOString(),
        };
        history.push(entry);
        await saveToBlob('equipment-history', history);

        return items[idx];
    },

    // ── History ──
    getHistory: async (equipmentId?: string) => {
        await ensureLoaded();
        if (equipmentId) return history.filter(h => h.equipmentId === equipmentId);
        return [...history];
    },
};

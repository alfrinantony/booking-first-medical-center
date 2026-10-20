import { loadFromBlob, saveToBlob } from './blob-persistence';

// ── Types ──
export interface FurnitureItem {
    id: string;
    name: string;
    code: string;
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

export interface FurnitureHistoryEntry {
    id: string;
    furnitureId: string;
    action: 'new_entry' | 'transfer' | 'maintenance' | 'damage' | 'disposal' | 'edit';
    fromBranch?: string;
    toBranch?: string;
    notes: string;
    timestamp: string;
    quantityChanged?: number;
}

// ── In-memory state ──
let items: FurnitureItem[] = [];
let history: FurnitureHistoryEntry[] = [];
let loaded = false;

function genId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

async function ensureLoaded() {
    if (!loaded) {
        items = await loadFromBlob<FurnitureItem[]>('furniture', []);
        history = await loadFromBlob<FurnitureHistoryEntry[]>('furniture-history', []);

        // One-time automatic migration: If no furniture items exist yet,
        // check if there are any furniture records stored under equipment.
        if (items.length === 0) {
            try {
                const equipmentItems = await loadFromBlob<any[]>('equipment', []);
                const furnitureFromEq = equipmentItems.filter(
                    (eq) => String(eq.category || '').toLowerCase() === 'furniture'
                );

                if (furnitureFromEq.length > 0) {
                    items = furnitureFromEq.map((eq) => ({
                        id: eq.id.startsWith('fur-') ? eq.id : `fur-${eq.id}`,
                        name: eq.name || '',
                        code: eq.code || '',
                        category: 'Other',
                        brand: eq.brand || '',
                        serialNumber: eq.serialNumber || '',
                        quantity: Number(eq.quantity) || 1,
                        branchId: eq.branchId || 'clinic-1',
                        purchaseDate: eq.purchaseDate || '',
                        warrantyExpiry: eq.warrantyExpiry || '',
                        status: eq.status || 'active',
                        assignedDepartment: eq.assignedDepartment || '',
                        notes: eq.notes || '',
                        lowStockThreshold: Number(eq.lowStockThreshold) || 1,
                        nextMaintenanceDate: eq.nextMaintenanceDate || '',
                    }));

                    await saveToBlob('furniture', items);
                }
            } catch (err) {
                console.warn('[FurnitureStore] Migration check skipped:', err);
            }
        }

        loaded = true;
    }
}

// ── Store ──
export const FurnitureStore = {
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
    add: async (item: Omit<FurnitureItem, 'id'>) => {
        await ensureLoaded();
        const newItem: FurnitureItem = { ...item, id: genId('fur') };
        items.push(newItem);
        await saveToBlob('furniture', items);

        // History
        const entry: FurnitureHistoryEntry = {
            id: genId('fh'),
            furnitureId: newItem.id,
            action: 'new_entry',
            toBranch: newItem.branchId,
            notes: `Added ${newItem.quantity} unit(s)`,
            timestamp: new Date().toISOString(),
        };
        history.push(entry);
        await saveToBlob('furniture-history', history);

        return newItem;
    },

    // ── Update ──
    update: async (id: string, updates: Partial<Omit<FurnitureItem, 'id'>>) => {
        await ensureLoaded();
        const idx = items.findIndex(i => i.id === id);
        if (idx === -1) return null;

        const old = items[idx];
        items[idx] = { ...old, ...updates };
        await saveToBlob('furniture', items);

        // Status change history
        if (updates.status && updates.status !== old.status) {
            const actionMap: Record<string, FurnitureHistoryEntry['action']> = {
                maintenance: 'maintenance',
                damaged: 'damage',
                disposed: 'disposal',
            };
            const entry: FurnitureHistoryEntry = {
                id: genId('fh'),
                furnitureId: id,
                action: actionMap[updates.status] || 'edit',
                notes: `Status changed: ${old.status} → ${updates.status}`,
                timestamp: new Date().toISOString(),
            };
            history.push(entry);
            await saveToBlob('furniture-history', history);
        } else {
            const entry: FurnitureHistoryEntry = {
                id: genId('fh'),
                furnitureId: id,
                action: 'edit',
                notes: `Furniture details updated`,
                timestamp: new Date().toISOString(),
            };
            history.push(entry);
            await saveToBlob('furniture-history', history);
        }

        return items[idx];
    },

    // ── Delete ──
    delete: async (id: string) => {
        await ensureLoaded();
        const len = items.length;
        items = items.filter(i => i.id !== id);
        if (items.length < len) {
            await saveToBlob('furniture', items);
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
            const newItem: FurnitureItem = {
                ...source,
                id: genId('fur'),
                branchId: toBranchId,
                quantity,
            };
            items.push(newItem);
        }
        await saveToBlob('furniture', items);

        // History
        const entry: FurnitureHistoryEntry = {
            id: genId('fh'),
            furnitureId: id,
            action: 'transfer',
            fromBranch,
            toBranch: toBranchId,
            notes: notes || `Transferred ${quantity} unit(s)`,
            quantityChanged: quantity,
            timestamp: new Date().toISOString(),
        };
        history.push(entry);
        await saveToBlob('furniture-history', history);

        return items[idx];
    },

    // ── History ──
    getHistory: async (furnitureId?: string) => {
        await ensureLoaded();
        if (furnitureId) return history.filter(h => h.furnitureId === furnitureId);
        return [...history];
    },
};

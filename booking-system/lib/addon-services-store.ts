/**
 * Add-on Services Store
 *
 * Stores configurable add-on services (e.g. Shaving, Numbing) linked to
 * medicines/consumables. When billed, each linked consumable is automatically
 * deducted from stock via the existing InventoryBatchStore flow.
 *
 * NOTE: No in-memory cache is used here. In Azure SWA each API route runs as
 * an independent Azure Function instance, so a module-level cache variable is
 * NOT shared between PUT and GET routes — leading to stale reads. Every
 * operation reads fresh from Blob Storage instead.
 */
import { loadFromBlob, saveToBlob } from './blob-persistence';

export interface AddonConsumable {
    medicineId: string;
    medicineName: string;       // Display name (denormalised for speed)
    quantityPerService: number; // How many units consumed each time
}

export interface AddonService {
    id: string;
    name: string;               // e.g. "Shaving – Full Body"
    group: string;              // e.g. "Shaving", "Numbing Application"
    defaultPrice: number;       // in AED
    linkedConsumables: AddonConsumable[];
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

// ── Default seed data ──────────────────────────────────────────
const DEFAULT_ADDONS: Omit<AddonService, 'id' | 'createdAt' | 'updatedAt'>[] = [
    { name: 'Shaving – Full Body',               group: 'Shaving',              defaultPrice: 150, linkedConsumables: [], isActive: true },
    { name: 'Shaving – Large Area',              group: 'Shaving',              defaultPrice: 80,  linkedConsumables: [], isActive: true },
    { name: 'Shaving – Medium Area',             group: 'Shaving',              defaultPrice: 60,  linkedConsumables: [], isActive: true },
    { name: 'Shaving – Small Area',              group: 'Shaving',              defaultPrice: 30,  linkedConsumables: [], isActive: true },
    { name: 'Numbing Application – Small Area',  group: 'Numbing Application',  defaultPrice: 50,  linkedConsumables: [], isActive: true },
    { name: 'Numbing Application – Medium Area', group: 'Numbing Application',  defaultPrice: 80,  linkedConsumables: [], isActive: true },
    { name: 'Numbing Application – Large Area',  group: 'Numbing Application',  defaultPrice: 120, linkedConsumables: [], isActive: true },
];

const BLOB_KEY = 'addon-services';

/** Always reads fresh from blob — no cross-request caching. */
async function loadFresh(): Promise<AddonService[]> {
    // loadFromBlob returns the default value (null here) when the blob doesn't exist yet.
    // We use null (not []) as the default so we can distinguish "never written" from
    // "intentionally empty after deletions". Only seed on null — never on [].
    const data = await loadFromBlob<AddonService[] | null>(BLOB_KEY, null);
    if (data === null) {
        // First-time initialisation — seed with defaults
        const now = new Date().toISOString();
        const seeded = DEFAULT_ADDONS.map((d, i) => ({
            ...d,
            id: `addon-seed-${i + 1}`,
            createdAt: now,
            updatedAt: now,
        }));
        await saveToBlob(BLOB_KEY, seeded);
        return seeded;
    }
    return data;
}

export const AddonServicesStore = {
    getAll: async (): Promise<AddonService[]> => loadFresh(),

    getById: async (id: string): Promise<AddonService | null> => {
        const all = await loadFresh();
        return all.find(a => a.id === id) ?? null;
    },

    create: async (
        data: Omit<AddonService, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<AddonService> => {
        const all = await loadFresh();
        const now = new Date().toISOString();
        const addon: AddonService = {
            ...data,
            id: `addon-${Date.now()}`,
            createdAt: now,
            updatedAt: now,
        };
        all.push(addon);
        await saveToBlob(BLOB_KEY, all);
        return addon;
    },

    update: async (
        id: string,
        updates: Partial<Omit<AddonService, 'id' | 'createdAt'>>
    ): Promise<AddonService | null> => {
        const all = await loadFresh();
        const idx = all.findIndex(a => a.id === id);
        if (idx === -1) return null;
        all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
        await saveToBlob(BLOB_KEY, all);
        return all[idx];
    },

    delete: async (id: string): Promise<boolean> => {
        const all = await loadFresh();
        const filtered = all.filter(a => a.id !== id);
        if (filtered.length === all.length) return false;
        await saveToBlob(BLOB_KEY, filtered);
        return true;
    },

    /** Persist addons in an externally-supplied order (used by drag-to-reorder). */
    saveOrder: async (ordered: AddonService[]): Promise<void> => {
        await saveToBlob(BLOB_KEY, ordered);
    },
};

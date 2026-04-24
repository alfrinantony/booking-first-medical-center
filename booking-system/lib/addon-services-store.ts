/**
 * Add-on Services Store
 *
 * Stores configurable add-on services (e.g. Shaving, Numbing) linked to
 * medicines/consumables. When billed, each linked consumable is automatically
 * deducted from stock via the existing InventoryBatchStore flow.
 */
import { loadFromBlob, saveToBlob } from './blob-persistence';

export interface AddonConsumable {
    medicineId: string;
    medicineName: string;       // Display name (denormalised for speed)
    quantityPerService: number; // How many units consumed each time this add-on is rendered
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

// ── Default seed data (pre-configured LHR add-ons with no consumables linked yet) ──
const DEFAULT_ADDONS: Omit<AddonService, 'id' | 'createdAt' | 'updatedAt'>[] = [
    { name: 'Shaving – Full Body',               group: 'Shaving', defaultPrice: 150, linkedConsumables: [], isActive: true },
    { name: 'Shaving – Large Area',              group: 'Shaving', defaultPrice: 80,  linkedConsumables: [], isActive: true },
    { name: 'Shaving – Medium Area',             group: 'Shaving', defaultPrice: 60,  linkedConsumables: [], isActive: true },
    { name: 'Shaving – Small Area',              group: 'Shaving', defaultPrice: 30,  linkedConsumables: [], isActive: true },
    { name: 'Numbing Application – Small Area',  group: 'Numbing Application', defaultPrice: 50,  linkedConsumables: [], isActive: true },
    { name: 'Numbing Application – Medium Area', group: 'Numbing Application', defaultPrice: 80,  linkedConsumables: [], isActive: true },
    { name: 'Numbing Application – Large Area',  group: 'Numbing Application', defaultPrice: 120, linkedConsumables: [], isActive: true },
];

const BLOB_KEY = 'addon-services';
let cache: AddonService[] | null = null;

async function load(): Promise<AddonService[]> {
    if (!cache) {
        const data = await loadFromBlob<AddonService[]>(BLOB_KEY, []);
        // Seed defaults if empty
        if (!data || data.length === 0) {
            const now = new Date().toISOString();
            const seeded = DEFAULT_ADDONS.map((d, i) => ({
                ...d,
                id: `addon-seed-${i + 1}`,
                createdAt: now,
                updatedAt: now,
            }));
            await saveToBlob(BLOB_KEY, seeded);
            cache = seeded;
        } else {
            cache = data;
        }
    }
    return cache;
}

function invalidate() { cache = null; }

async function save(data: AddonService[]) {
    cache = data;
    await saveToBlob(BLOB_KEY, data);
}

export const AddonServicesStore = {
    getAll: async (): Promise<AddonService[]> => load(),

    getById: async (id: string): Promise<AddonService | null> => {
        const all = await load();
        return all.find(a => a.id === id) ?? null;
    },

    create: async (
        data: Omit<AddonService, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<AddonService> => {
        const all = await load();
        const now = new Date().toISOString();
        const addon: AddonService = {
            ...data,
            id: `addon-${Date.now()}`,
            createdAt: now,
            updatedAt: now,
        };
        all.push(addon);
        await save(all);
        return addon;
    },

    update: async (
        id: string,
        updates: Partial<Omit<AddonService, 'id' | 'createdAt'>>
    ): Promise<AddonService | null> => {
        const all = await load();
        const idx = all.findIndex(a => a.id === id);
        if (idx === -1) return null;
        all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
        await save(all);
        return all[idx];
    },

    delete: async (id: string): Promise<boolean> => {
        const all = await load();
        const idx = all.findIndex(a => a.id === id);
        if (idx === -1) return false;
        all.splice(idx, 1);
        await save(all);
        invalidate();
        return true;
    },

    /** Persist addons in an externally-supplied order (used by the reorder endpoint). */
    saveOrder: async (ordered: AddonService[]): Promise<void> => {
        await save(ordered);
    },
};

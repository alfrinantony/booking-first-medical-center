import { PromoCode } from './data';
import { loadFromBlob, saveToBlob } from './blob-persistence';

const initialPromos: PromoCode[] = [
    {
        id: 'promo-1',
        code: 'WELCOME10',
        discountType: 'percentage',
        discountValue: 0.10,
        applicableServiceIds: [],
        active: true,
        usageCount: 0
    },
    {
        id: 'promo-2',
        code: 'SAVE20',
        discountType: 'fixed',
        discountValue: 20,
        applicableServiceIds: [],
        active: true,
        usageCount: 5
    },
    {
        id: 'promo-3',
        code: 'DERMA20',
        discountType: 'percentage',
        discountValue: 0.20,
        applicableServiceIds: [],
        applicableDepartmentIds: ['c1-Dermatology', 'c2-Dermatology', 'c3-Dermatology'],
        active: true,
        usageCount: 0
    },
    {
        id: 'promo-4',
        code: 'EXPIRED',
        discountType: 'fixed',
        discountValue: 5,
        applicableServiceIds: [],
        validUntil: '2023-01-01',
        active: true,
        usageCount: 0
    },
    {
        id: 'promo-5',
        code: 'FUTURE',
        discountType: 'fixed',
        discountValue: 5,
        applicableServiceIds: [],
        validFrom: '2030-01-01',
        active: true,
        usageCount: 0
    }
];

let promoStore: PromoCode[] = [...initialPromos];
let loaded = false;

async function ensureLoaded() {
    if (!loaded) {
        promoStore = await loadFromBlob<PromoCode[]>('promos', initialPromos);
        loaded = true;
    }
}

export const PromoStore = {
    getAll: async () => {
        await ensureLoaded();
        return promoStore;
    },

    getById: async (id: string) => {
        await ensureLoaded();
        return promoStore.find(p => p.id === id);
    },

    getByCode: async (code: string) => {
        await ensureLoaded();
        return promoStore.find(p => p.code.toUpperCase() === code.toUpperCase() && p.active);
    },

    add: async (promo: Omit<PromoCode, 'id' | 'usageCount'>) => {
        await ensureLoaded();
        const newPromo: PromoCode = {
            ...promo,
            id: `promo-${Date.now()}`,
            usageCount: 0,
            code: promo.code.toUpperCase()
        };
        promoStore.push(newPromo);
        await saveToBlob('promos', promoStore);
        return newPromo;
    },

    update: async (id: string, updates: Partial<PromoCode>) => {
        await ensureLoaded();
        const index = promoStore.findIndex(p => p.id === id);
        if (index === -1) return null;
        const updatedPromo = { ...promoStore[index], ...updates };
        if (updates.code) updatedPromo.code = updates.code.toUpperCase();
        promoStore[index] = updatedPromo;
        await saveToBlob('promos', promoStore);
        return updatedPromo;
    },

    delete: async (id: string) => {
        await ensureLoaded();
        const initialLength = promoStore.length;
        promoStore = promoStore.filter(p => p.id !== id);
        if (promoStore.length < initialLength) {
            await saveToBlob('promos', promoStore);
            return true;
        }
        return false;
    },

    incrementUsage: async (id: string) => {
        await ensureLoaded();
        const index = promoStore.findIndex(p => p.id === id);
        if (index !== -1) {
            promoStore[index].usageCount++;
            await saveToBlob('promos', promoStore);
        }
    }
};

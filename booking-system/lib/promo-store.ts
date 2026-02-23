import { PromoCode } from './data';

// In-memory store for promo codes
let promoStore: PromoCode[] = [];

// Seed some initial data for testing
const initialPromos: PromoCode[] = [
    {
        id: 'promo-1',
        code: 'WELCOME10',
        discountType: 'percentage',
        discountValue: 0.10, // 10%
        applicableServiceIds: [], // All services
        active: true,
        usageCount: 0
    },
    {
        id: 'promo-2',
        code: 'SAVE20',
        discountType: 'fixed',
        discountValue: 20, // $20
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
        applicableDepartmentIds: ['c1-Dermatology', 'c2-Dermatology', 'c3-Dermatology'], // IDs from data.ts generator
        active: true,
        usageCount: 0
    },
    {
        id: 'promo-4',
        code: 'EXPIRED',
        discountType: 'fixed',
        discountValue: 5,
        applicableServiceIds: [],
        validUntil: '2023-01-01', // Past date
        active: true,
        usageCount: 0
    },
    {
        id: 'promo-5',
        code: 'FUTURE',
        discountType: 'fixed',
        discountValue: 5,
        applicableServiceIds: [],
        validFrom: '2030-01-01', // Future date
        active: true,
        usageCount: 0
    }
];
promoStore = [...initialPromos];

export const PromoStore = {
    getAll: () => {
        return promoStore;
    },

    getById: (id: string) => {
        return promoStore.find(p => p.id === id);
    },

    getByCode: (code: string) => {
        return promoStore.find(p => p.code.toUpperCase() === code.toUpperCase() && p.active);
    },

    add: (promo: Omit<PromoCode, 'id' | 'usageCount'>) => {
        const newPromo: PromoCode = {
            ...promo,
            id: `promo-${Date.now()}`,
            usageCount: 0,
            code: promo.code.toUpperCase()
        };
        promoStore.push(newPromo);
        return newPromo;
    },

    update: (id: string, updates: Partial<PromoCode>) => {
        const index = promoStore.findIndex(p => p.id === id);
        if (index === -1) return null;

        const updatedPromo = { ...promoStore[index], ...updates };
        if (updates.code) updatedPromo.code = updates.code.toUpperCase();

        promoStore[index] = updatedPromo;
        return updatedPromo;
    },

    delete: (id: string) => {
        const initialLength = promoStore.length;
        promoStore = promoStore.filter(p => p.id !== id);
        return promoStore.length < initialLength;
    },

    incrementUsage: (id: string) => {
        const index = promoStore.findIndex(p => p.id === id);
        if (index !== -1) {
            promoStore[index].usageCount++;
        }
    }
};

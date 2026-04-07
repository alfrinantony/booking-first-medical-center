import { loadFromBlob, saveToBlob } from './blob-persistence';

export interface PublicHoliday {
    id: string;
    date: string; // YYYY-MM-DD
    name: string;
    isPublicHoliday: boolean;
    createdAt: string;
}

let holidays: PublicHoliday[] = [];

async function ensureStoreLoaded() {
    holidays = await loadFromBlob<PublicHoliday[]>('hr-calendar', []);
}

async function saveStore() {
    await saveToBlob('hr-calendar', holidays);
}

export const HRCalendarStore = {
    getAll: async (): Promise<PublicHoliday[]> => {
        await ensureStoreLoaded();
        // Sort ascending by date
        return [...holidays].sort((a, b) => a.date.localeCompare(b.date));
    },

    getForMonthYear: async (month: number, year: number): Promise<PublicHoliday[]> => {
        await ensureStoreLoaded();
        const prefix = `${year}-${String(month).padStart(2, '0')}-`;
        return holidays.filter(h => h.date.startsWith(prefix) && h.isPublicHoliday);
    },

    add: async (data: { date: string; name: string }): Promise<PublicHoliday> => {
        await ensureStoreLoaded();
        const now = new Date().toISOString();
        const newRecord: PublicHoliday = {
            id: `hol-${Date.now()}`,
            date: data.date,
            name: data.name,
            isPublicHoliday: true,
            createdAt: now
        };
        holidays.push(newRecord);
        await saveStore();
        return newRecord;
    },

    delete: async (id: string): Promise<boolean> => {
        await ensureStoreLoaded();
        const initialLength = holidays.length;
        holidays = holidays.filter(h => h.id !== id);
        if (holidays.length < initialLength) {
            await saveStore();
            return true;
        }
        return false;
    }
};

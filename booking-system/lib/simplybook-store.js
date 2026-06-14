"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimplybookStore = void 0;
/**
 * SimplyBook Bookings Store
 * Persists webhook-received SimplyBook bookings in Azure Blob Storage.
 * Pattern mirrors bookings-store.ts
 */
const blob_persistence_1 = require("./blob-persistence");
const BLOB_KEY = 'simplybook-bookings';
const INITIAL = [];
let records = [];
let loaded = false;
async function ensureLoaded() {
    if (!loaded) {
        records = await (0, blob_persistence_1.loadFromBlob)(BLOB_KEY, INITIAL);
        loaded = true;
    }
}
function invalidateCache() {
    loaded = false;
}
exports.SimplybookStore = {
    getAll: async () => {
        await ensureLoaded();
        return [...records].sort((a, b) => new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime());
    },
    getByDateRange: async (from, to) => {
        await ensureLoaded();
        return records
            .filter(r => r.date >= from && r.date <= to)
            .sort((a, b) => new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime());
    },
    getByDate: async (date) => {
        await ensureLoaded();
        return records
            .filter(r => r.date === date)
            .sort((a, b) => a.time.localeCompare(b.time));
    },
    getById: async (sbId) => {
        await ensureLoaded();
        return records.find(r => r.sbId === sbId);
    },
    /**
     * Upsert a booking record (insert or update based on sbId).
     */
    upsert: async (record) => {
        await ensureLoaded();
        const idx = records.findIndex(r => r.sbId === record.sbId);
        if (idx >= 0) {
            records[idx] = { ...records[idx], ...record, updatedAt: new Date().toISOString() };
        }
        else {
            records.push({ ...record, receivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        }
        await (0, blob_persistence_1.saveToBlob)(BLOB_KEY, records);
        return idx >= 0 ? records[idx] : records[records.length - 1];
    },
    /**
     * Batch upsert many records and save once — much faster than calling upsert() N times.
     * Each call to upsert() saves the whole blob; this does it in ONE write.
     */
    upsertMany: async (incoming) => {
        await ensureLoaded();
        const now = new Date().toISOString();
        for (const record of incoming) {
            const idx = records.findIndex(r => r.sbId === record.sbId);
            if (idx >= 0) {
                records[idx] = { ...records[idx], ...record, updatedAt: now };
            }
            else {
                records.push({ ...record, receivedAt: now, updatedAt: now });
            }
        }
        await (0, blob_persistence_1.saveToBlob)(BLOB_KEY, records); // ONE save for all records
    },
    /**
     * Mark a booking as cancelled.
     */
    cancel: async (sbId) => {
        await ensureLoaded();
        const idx = records.findIndex(r => r.sbId === sbId);
        if (idx >= 0) {
            records[idx].status = 'cancelled';
            records[idx].updatedAt = new Date().toISOString();
            await (0, blob_persistence_1.saveToBlob)(BLOB_KEY, records);
        }
    },
    /**
     * Get summary stats for a given date.
     */
    getStats: async (date) => {
        await ensureLoaded();
        const subset = date ? records.filter(r => r.date === date) : records;
        return {
            total: subset.filter(r => r.status !== 'cancelled').length,
            confirmed: subset.filter(r => r.status === 'confirmed').length,
            cancelled: subset.filter(r => r.status === 'cancelled').length,
            pending: subset.filter(r => r.status === 'pending').length,
        };
    },
};

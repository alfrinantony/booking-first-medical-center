"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogsStore = void 0;
const blob_persistence_1 = require("./blob-persistence");
let logs = [];
let loaded = false;
async function ensureLoaded() {
    if (!loaded) {
        logs = await (0, blob_persistence_1.loadFromBlob)('logs', []);
        loaded = true;
    }
}
exports.LogsStore = {
    getAll: async () => {
        await ensureLoaded();
        return [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    },
    add: async (entry) => {
        await ensureLoaded();
        const newLog = {
            id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            timestamp: new Date().toISOString(),
            ...entry
        };
        logs.unshift(newLog); // Add to beginning
        await (0, blob_persistence_1.saveToBlob)('logs', logs);
        return newLog;
    }
};

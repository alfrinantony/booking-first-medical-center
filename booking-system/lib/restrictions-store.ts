// ─────────────────────────────────────────────────────────────
// Restrictions Store — No-show & Peak-slot restrictions with Azure Blob persistence
// ─────────────────────────────────────────────────────────────

import { loadFromBlob, saveToBlob } from './blob-persistence';
import { ServicesStore } from './services-store';

// ─── Types ───────────────────────────────────────────────────────────

export interface ClientRestriction {
    noShowDates: string[];    // ISO dates of no-show occurrences
    noShowExempt: boolean;    // Exempt from no-show peak restrictions
    voiceAgentBlocked: boolean; // Blocked from voice agent booking
}

interface RestrictionsData {
    peakDays: number[];       // 0=Sun – 6=Sat
    peakSlots: string[];      // e.g. ["10:00 AM", "10:30 AM", ...]
    noShowRestrictionDays: number;
    clients: Record<string, ClientRestriction>;
}

// ─── In-memory store ──────────────────────────────────────────────────

let peakDays: number[] = [];
let peakSlots: string[] = [];
let noShowRestrictionDays = 7;
let clients: Record<string, ClientRestriction> = {};
function getDefaultRestriction(): ClientRestriction {
    return { noShowDates: [], noShowExempt: false, voiceAgentBlocked: false };
}

async function ensureRestrictionsLoaded() {
    
        const data = await loadFromBlob<RestrictionsData>('restrictions', {
            peakDays: [], peakSlots: [], noShowRestrictionDays: 7, clients: {},
        });
        peakDays = data.peakDays;
        peakSlots = data.peakSlots;
        noShowRestrictionDays = data.noShowRestrictionDays;
        clients = data.clients;
        
}

async function saveRestrictions() {
    await saveToBlob<RestrictionsData>('restrictions', { peakDays, peakSlots, noShowRestrictionDays, clients });
}

// ─── Store ───────────────────────────────────────────────────────────

export const RestrictionsStore = {
    setPeakConfig: async (days: number[], slots: string[]) => {
        await ensureRestrictionsLoaded();
        peakDays = days;
        peakSlots = slots;
        await saveRestrictions();
    },

    setNoShowRestrictionDays: async (days: number) => {
        await ensureRestrictionsLoaded();
        noShowRestrictionDays = days;
        await saveRestrictions();
    },

    recordNoShow: async (clientId: string) => {
        await ensureRestrictionsLoaded();
        const existing = clients[clientId] || getDefaultRestriction();
        const today = new Date().toISOString().split('T')[0];
        clients[clientId] = { ...existing, noShowDates: [...existing.noShowDates, today] };
        await saveRestrictions();
    },

    setNoShowExempt: async (clientId: string, exempt: boolean) => {
        await ensureRestrictionsLoaded();
        const existing = clients[clientId] || getDefaultRestriction();
        clients[clientId] = { ...existing, noShowExempt: exempt };
        await saveRestrictions();
    },

    setVoiceAgentBlocked: async (clientId: string, blocked: boolean) => {
        await ensureRestrictionsLoaded();
        const existing = clients[clientId] || getDefaultRestriction();
        clients[clientId] = { ...existing, voiceAgentBlocked: blocked };
        await saveRestrictions();
    },

    getClientRestriction: async (clientId: string): Promise<ClientRestriction> => {
        await ensureRestrictionsLoaded();
        return clients[clientId] || getDefaultRestriction();
    },

    isSlotRestricted: async (clientId: string, date: Date, slot: string, serviceId?: string): Promise<boolean> => {
        await ensureRestrictionsLoaded();
        const restriction = clients[clientId] || getDefaultRestriction();

        if (restriction.noShowExempt) return false;

        const windowDays = noShowRestrictionDays;
        const now = new Date();
        const windowStart = new Date(now);
        windowStart.setDate(windowStart.getDate() - windowDays);
        const windowStartStr = windowStart.toISOString().split('T')[0];

        const recentNoShows = restriction.noShowDates.filter(d => d >= windowStartStr);
        if (recentNoShows.length === 0) return false;

        let localPeakDays = peakDays;
        let localPeakSlots = peakSlots;

        if (serviceId) {
            try {
                const service = ServicesStore.getServiceById(serviceId);
                if (service?.peakDays && service.peakDays.length > 0) localPeakDays = service.peakDays;
                if (service?.peakSlots && service.peakSlots.length > 0) localPeakSlots = service.peakSlots;
            } catch { /* fallback to clinic-wide */ }
        }

        if (localPeakDays.length === 0 && localPeakSlots.length === 0) return false;

        const dayOfWeek = date.getDay();
        const isDayPeak = localPeakDays.length === 0 || localPeakDays.includes(dayOfWeek);
        const isSlotPeak = localPeakSlots.length === 0 || localPeakSlots.includes(slot);

        return isDayPeak && isSlotPeak;
    },

    isVoiceBlocked: async (clientId: string): Promise<boolean> => {
        await ensureRestrictionsLoaded();
        const restriction = clients[clientId] || getDefaultRestriction();
        return restriction.voiceAgentBlocked;
    },

    getState: async () => {
        await ensureRestrictionsLoaded();
        return { peakDays, peakSlots, noShowRestrictionDays, clients };
    },
};

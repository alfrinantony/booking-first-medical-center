import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ServicesStore } from './services-store';

// ─── Types ───────────────────────────────────────────────────────────

export interface ClientRestriction {
    noShowDates: string[];    // ISO dates of no-show occurrences
    noShowExempt: boolean;    // Exempt from no-show peak restrictions
    voiceAgentBlocked: boolean; // Blocked from voice agent booking
}

interface RestrictionsState {
    // Clinic-wide peak config
    peakDays: number[];       // 0=Sun – 6=Sat
    peakSlots: string[];      // e.g. ["10:00 AM", "10:30 AM", ...]
    noShowRestrictionDays: number; // How many days the restriction lasts (default 7)

    // Per-client restrictions
    clients: Record<string, ClientRestriction>;

    // Actions
    setPeakConfig: (days: number[], slots: string[]) => void;
    setNoShowRestrictionDays: (days: number) => void;
    recordNoShow: (clientId: string) => void;
    setNoShowExempt: (clientId: string, exempt: boolean) => void;
    setVoiceAgentBlocked: (clientId: string, blocked: boolean) => void;
    getClientRestriction: (clientId: string) => ClientRestriction;
    isSlotRestricted: (clientId: string, date: Date, slot: string, serviceId?: string) => boolean;
    isVoiceBlocked: (clientId: string) => boolean;
}

// ─── Helper ──────────────────────────────────────────────────────────

function getDefaultRestriction(): ClientRestriction {
    return { noShowDates: [], noShowExempt: false, voiceAgentBlocked: false };
}

// ─── Store ───────────────────────────────────────────────────────────

export const useRestrictionsStore = create<RestrictionsState>()(
    persist(
        (set, get) => ({
            peakDays: [],
            peakSlots: [],
            noShowRestrictionDays: 7,
            clients: {},

            setPeakConfig: (days, slots) => set({ peakDays: days, peakSlots: slots }),

            setNoShowRestrictionDays: (days) => set({ noShowRestrictionDays: days }),

            recordNoShow: (clientId) => set((state) => {
                const existing = state.clients[clientId] || getDefaultRestriction();
                const today = new Date().toISOString().split('T')[0];
                return {
                    clients: {
                        ...state.clients,
                        [clientId]: {
                            ...existing,
                            noShowDates: [...existing.noShowDates, today]
                        }
                    }
                };
            }),

            setNoShowExempt: (clientId, exempt) => set((state) => {
                const existing = state.clients[clientId] || getDefaultRestriction();
                return {
                    clients: {
                        ...state.clients,
                        [clientId]: { ...existing, noShowExempt: exempt }
                    }
                };
            }),

            setVoiceAgentBlocked: (clientId, blocked) => set((state) => {
                const existing = state.clients[clientId] || getDefaultRestriction();
                return {
                    clients: {
                        ...state.clients,
                        [clientId]: { ...existing, voiceAgentBlocked: blocked }
                    }
                };
            }),

            getClientRestriction: (clientId) => {
                return get().clients[clientId] || getDefaultRestriction();
            },

            isSlotRestricted: (clientId, date, slot, serviceId?) => {
                const state = get();
                const restriction = state.clients[clientId] || getDefaultRestriction();

                // 1. Exempt clients skip all checks
                if (restriction.noShowExempt) return false;

                // 2. Check for recent no-shows within restriction window
                const windowDays = state.noShowRestrictionDays;
                const now = new Date();
                const windowStart = new Date(now);
                windowStart.setDate(windowStart.getDate() - windowDays);
                const windowStartStr = windowStart.toISOString().split('T')[0];

                const recentNoShows = restriction.noShowDates.filter(d => d >= windowStartStr);
                if (recentNoShows.length === 0) return false;

                // 3. Determine which peak config to use (procedure-specific > clinic-wide)
                let peakDays = state.peakDays;
                let peakSlots = state.peakSlots;

                if (serviceId) {
                    try {
                        const service = ServicesStore.getServiceById(serviceId);
                        if (service?.peakDays && service.peakDays.length > 0) {
                            peakDays = service.peakDays;
                        }
                        if (service?.peakSlots && service.peakSlots.length > 0) {
                            peakSlots = service.peakSlots;
                        }
                    } catch { /* fallback to clinic-wide */ }
                }

                // 4. If no peak config defined, no restriction
                if (peakDays.length === 0 && peakSlots.length === 0) return false;

                // 5. Check if this date/slot falls within peak
                const dayOfWeek = date.getDay();
                const isDayPeak = peakDays.length === 0 || peakDays.includes(dayOfWeek);
                const isSlotPeak = peakSlots.length === 0 || peakSlots.includes(slot);

                // Restricted if BOTH day and slot are peak
                return isDayPeak && isSlotPeak;
            },

            isVoiceBlocked: (clientId) => {
                const restriction = get().clients[clientId] || getDefaultRestriction();
                return restriction.voiceAgentBlocked;
            }
        }),
        {
            name: 'restrictions-storage'
        }
    )
);

// ─── Server-side helper (non-hook access) ────────────────────────────

export const RestrictionsStore = {
    getState: () => useRestrictionsStore.getState(),
    isSlotRestricted: (clientId: string, date: Date, slot: string, serviceId?: string) =>
        useRestrictionsStore.getState().isSlotRestricted(clientId, date, slot, serviceId),
    isVoiceBlocked: (clientId: string) =>
        useRestrictionsStore.getState().isVoiceBlocked(clientId),
    recordNoShow: (clientId: string) =>
        useRestrictionsStore.getState().recordNoShow(clientId),
};

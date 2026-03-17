export interface Schedule {
    clinicId: string;
    doctorId: string;
    date: string; // YYYY-MM-DD
    slots: string[];
}

// In-memory store for demo purposes
// In production, this would be a database
let schedules: Schedule[] = [];

// Helper to get today's date in YYYY-MM-DD
const getToday = () => new Date().toISOString().split('T')[0];

export const Scheduler = {
    /**
     * Get schedule for a doctor on a specific date.
     * If clinicId is provided, returns branch-specific schedule.
     * If clinicId is omitted (backward compat for booking flow), returns UNION of all branch schedules.
     */
    getSchedule: (doctorId: string, date: string, clinicId?: string): string[] => {
        if (clinicId) {
            const schedule = schedules.find(s => s.clinicId === clinicId && s.doctorId === doctorId && s.date === date);
            return schedule ? schedule.slots : [];
        }
        // Backward compat: union of all branch schedules for this doctor+date
        const allSlots = new Set<string>();
        schedules
            .filter(s => s.doctorId === doctorId && s.date === date)
            .forEach(s => s.slots.forEach(slot => allSlots.add(slot)));
        return Array.from(allSlots);
    },

    /**
     * Set schedule for a doctor on a specific date for a specific branch.
     * clinicId defaults to 'default' for backward compat.
     */
    setSchedule: (doctorId: string, date: string, slots: string[], clinicId: string = 'default'): Schedule => {
        const existingIndex = schedules.findIndex(s => s.clinicId === clinicId && s.doctorId === doctorId && s.date === date);

        if (existingIndex >= 0) {
            schedules[existingIndex].slots = slots;
            return schedules[existingIndex];
        } else {
            const newSchedule = { clinicId, doctorId, date, slots };
            schedules.push(newSchedule);
            return newSchedule;
        }
    },

    /**
     * Get schedules from OTHER branches for the same doctor on the same date.
     * Returns array of { clinicId, slots } for each other branch that has a schedule.
     */
    getOtherBranchSlots: (doctorId: string, date: string, excludeClinicId: string): { clinicId: string; slots: string[] }[] => {
        return schedules
            .filter(s => s.doctorId === doctorId && s.date === date && s.clinicId !== excludeClinicId && s.clinicId !== 'default')
            .map(s => ({ clinicId: s.clinicId, slots: s.slots }));
    },

    /**
     * Get all schedules (used by booking catalog to expose availability)
     */
    getAllSchedules: (): Schedule[] => {
        return schedules;
    },

    // Initialize mock data if empty
    initMockData: () => {
        if (schedules.length === 0) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const dateStr = tomorrow.toISOString().split('T')[0];

            schedules.push({
                clinicId: 'clinic-1',
                doctorId: 'Cardiology-doc-0',
                date: dateStr,
                slots: ['12:00 PM', '12:30 PM', '02:00 PM', '02:30 PM']
            });
        }
    }
};

// Initialize on load
Scheduler.initMockData();

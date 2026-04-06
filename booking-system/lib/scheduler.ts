import { loadFromBlob, saveToBlob } from './blob-persistence';

export interface Schedule {
    clinicId: string;
    doctorId: string;
    date: string; // YYYY-MM-DD
    slots: string[];
}

let schedules: Schedule[] = [];

async function ensureScheduleLoaded() {
    const data = await loadFromBlob<{ schedules: Schedule[] }>('clinician-schedules', null as any);
    if (data && Array.isArray(data.schedules)) {
        schedules = data.schedules;
    } else {
        // Run first time mock initialization if blob is completely empty
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
            await saveSchedule();
        }
    }
}

async function saveSchedule() {
    await saveToBlob('clinician-schedules', { schedules });
}

export const Scheduler = {
    /**
     * Get schedule for a doctor on a specific date.
     */
    getSchedule: async (doctorId: string, date: string, clinicId?: string): Promise<string[]> => {
        await ensureScheduleLoaded();
        if (clinicId) {
            const schedule = schedules.find(s => s.clinicId === clinicId && s.doctorId === doctorId && s.date === date);
            return schedule ? schedule.slots : [];
        }
        // Backward compat: union of all branch schedules
        const allSlots = new Set<string>();
        schedules
            .filter(s => s.doctorId === doctorId && s.date === date)
            .forEach(s => s.slots.forEach(slot => allSlots.add(slot)));
        return Array.from(allSlots);
    },

    /**
     * Set schedule for a doctor on a specific date for a specific branch.
     */
    setSchedule: async (doctorId: string, date: string, slots: string[], clinicId: string = 'default'): Promise<Schedule> => {
        await ensureScheduleLoaded();
        const existingIndex = schedules.findIndex(s => s.clinicId === clinicId && s.doctorId === doctorId && s.date === date);

        let finalSchedule: Schedule;
        if (existingIndex >= 0) {
            schedules[existingIndex].slots = slots;
            finalSchedule = schedules[existingIndex];
        } else {
            const newSchedule = { clinicId, doctorId, date, slots };
            schedules.push(newSchedule);
            finalSchedule = newSchedule;
        }

        await saveSchedule();
        return finalSchedule;
    },

    /**
     * Get schedules from OTHER branches for the same doctor on the same date.
     */
    getOtherBranchSlots: async (doctorId: string, date: string, excludeClinicId: string): Promise<{ clinicId: string; slots: string[] }[]> => {
        await ensureScheduleLoaded();
        return schedules
            .filter(s => s.doctorId === doctorId && s.date === date && s.clinicId !== excludeClinicId && s.clinicId !== 'default')
            .map(s => ({ clinicId: s.clinicId, slots: s.slots }));
    },

    /**
     * Get all schedules
     */
    getAllSchedules: async (): Promise<Schedule[]> => {
        await ensureScheduleLoaded();
        return schedules;
    }
};

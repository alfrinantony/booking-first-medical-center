export interface Schedule {
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
    // Get schedule for a doctor on a specific date
    getSchedule: (doctorId: string, date: string): string[] => {
        const schedule = schedules.find(s => s.doctorId === doctorId && s.date === date);
        return schedule ? schedule.slots : [];
    },

    // Set schedule for a doctor on a specific date
    setSchedule: (doctorId: string, date: string, slots: string[]): Schedule => {
        const existingIndex = schedules.findIndex(s => s.doctorId === doctorId && s.date === date);

        if (existingIndex >= 0) {
            schedules[existingIndex].slots = slots;
            return schedules[existingIndex];
        } else {
            const newSchedule = { doctorId, date, slots };
            schedules.push(newSchedule);
            return newSchedule;
        }
    },

    // Initialize mock data if empty
    initMockData: () => {
        if (schedules.length === 0) {
            // Example: Dr. Cardiology Specialist 1 is fully booked tomorrow morning
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const dateStr = tomorrow.toISOString().split('T')[0];

            schedules.push({
                doctorId: 'Cardiology-doc-0',
                date: dateStr,
                slots: ['12:00 PM', '12:30 PM', '02:00 PM', '02:30 PM'] // Only afternoon avail
            });
        }
    }
};

// Initialize on load
Scheduler.initMockData();

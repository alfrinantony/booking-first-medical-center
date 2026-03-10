// ─────────────────────────────────────────────────────────────
// HR Shift Store — Shift scheduling, clinician auto-shifts,
//                  attendance comparison
// ─────────────────────────────────────────────────────────────

import { HRStore, WORKPLACES } from './hr-store';
import { HRAttendanceStore, AttendanceRecord } from './hr-attendance-store';
import { BookingsStore } from './bookings-store';
import { clinics } from './data';
import { loadFromBlob, saveToBlob } from './blob-persistence';

// ── Types ──

export type ShiftStatus = 'SCHEDULED' | 'CHECKED_IN' | 'COMPLETED' | 'ABSENT' | 'OFF_DUTY';

export interface ShiftTemplate {
    id: string;
    name: string;           // e.g. "Morning", "Evening", "Full Day"
    startTime: string;      // "09:00"
    endTime: string;        // "14:00"
    breakMinutes: number;   // 60
    expectedHours: number;  // net hours after break
    color: string;          // UI badge color
}

export interface ShiftAssignment {
    id: string;
    employeeId: string;
    date: string;           // ISO YYYY-MM-DD
    shiftTemplateId: string;
    shiftName: string;      // denormalized
    branchId: string;
    branchName: string;
    startTime: string;
    endTime: string;
    expectedHours: number;
    breakMinutes: number;
    status: ShiftStatus;
    isClinicianAutoShift: boolean;  // true if auto-generated from bookings
    appointmentCount?: number;       // for clinician shifts
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ShiftAttendanceComparison {
    employeeId: string;
    employeeName: string;
    employeeCode: string;
    branchName: string;
    // Shift info
    shiftName: string;
    scheduledStart: string;
    scheduledEnd: string;
    expectedHours: number;
    // Attendance info
    actualPunchIn: string | null;
    actualPunchOut: string | null;
    actualHours: number;
    // Variance
    varianceHours: number;    // actual - expected (negative = under)
    status: 'ON_TIME' | 'LATE_ARRIVAL' | 'EARLY_LEAVE' | 'ABSENT' | 'NOT_SCHEDULED' | 'OVERTIME';
}

// ── Seed Data ──
// Clinic operation: 10 AM – 10 PM (22:00)
// Flexible hours: employees may start 1hr early (09:00) or finish 1hr late (23:00)

const defaultTemplates: ShiftTemplate[] = [
    {
        id: 'tpl-early',
        name: 'Early Morning',
        startTime: '09:00',   // 1hr before clinic opens
        endTime: '17:00',
        breakMinutes: 60,
        expectedHours: 7,
        color: 'amber',
    },
    {
        id: 'tpl-standard',
        name: 'Standard Day',
        startTime: '10:00',
        endTime: '19:00',
        breakMinutes: 60,
        expectedHours: 8,
        color: 'blue',
    },
    {
        id: 'tpl-late',
        name: 'Late Shift',
        startTime: '14:00',
        endTime: '23:00',   // 1hr after clinic closes
        breakMinutes: 60,
        expectedHours: 8,
        color: 'indigo',
    },
    {
        id: 'tpl-extended',
        name: 'Extended Day',
        startTime: '09:00',   // 1hr before open
        endTime: '23:00',     // 1hr after close
        breakMinutes: 90,
        expectedHours: 11.5,
        color: 'emerald',
    },
    {
        id: 'tpl-mid',
        name: 'Mid Shift',
        startTime: '11:00',
        endTime: '20:00',
        breakMinutes: 60,
        expectedHours: 8,
        color: 'purple',
    },
];

// Sample assignments: each employee gets a DIFFERENT shift each day
const dates = ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06'];

// Flexible daily rotation per employee (index into defaultTemplates)
// This mimics realistic varied scheduling
const scheduleGrid: Record<string, (number | null)[]> = {
    //                     Sun  Mon  Tue  Wed  Thu  Fri  (dates[0]–[5])
    'emp-001': /* Ahmed */[0, 1, 2, 0, 1, null], // Off Friday
    'emp-002': /* Fatima*/[1, 2, 0, 1, 3, null], // Off Friday
    'emp-003': /* Ravi  */[2, 0, 1, 4, 0, 2], // Off Saturday
};

function buildSeedAssignments(): ShiftAssignment[] {
    const assignments: ShiftAssignment[] = [];
    const employees = [
        { id: 'emp-001', name: 'Ahmed Al Mansouri', code: 'FMC-001', branchId: 'clinic-1', branchName: 'Al Muraqabat Branch', weeklyOff: 'Friday' },
        { id: 'emp-002', name: 'Fatima Hassan', code: 'FMC-002', branchId: 'clinic-2', branchName: 'Al Qiyadah Branch', weeklyOff: 'Friday' },
        { id: 'emp-003', name: 'Ravi Kumar', code: 'FMC-003', branchId: 'clinic-3', branchName: 'Silicon Oasis Branch', weeklyOff: 'Saturday' },
    ];

    for (let di = 0; di < dates.length; di++) {
        const dt = dates[di];
        const dayName = new Date(dt).toLocaleDateString('en-US', { weekday: 'long' });

        for (const emp of employees) {
            const isOff = emp.weeklyOff === dayName;
            const tplIdx = scheduleGrid[emp.id]?.[di];
            const tpl = (tplIdx !== null && tplIdx !== undefined && !isOff) ? defaultTemplates[tplIdx] : null;

            assignments.push({
                id: `shift-${emp.id}-${dt}`,
                employeeId: emp.id,
                date: dt,
                shiftTemplateId: tpl ? tpl.id : '',
                shiftName: isOff ? 'Day Off' : (tpl ? tpl.name : 'Day Off'),
                branchId: emp.branchId,
                branchName: emp.branchName,
                startTime: tpl ? tpl.startTime : '',
                endTime: tpl ? tpl.endTime : '',
                expectedHours: tpl ? tpl.expectedHours : 0,
                breakMinutes: tpl ? tpl.breakMinutes : 0,
                status: (isOff || !tpl) ? 'OFF_DUTY' : 'SCHEDULED',
                isClinicianAutoShift: false,
                notes: isOff ? `Weekly off (${emp.weeklyOff})` : (tpl ? `Flexible: ${tpl.startTime}–${tpl.endTime}` : ''),
                createdAt: `${dt}T00:00:00Z`,
                updatedAt: `${dt}T00:00:00Z`,
            });
        }
    }
    return assignments;
}

// ── In-memory data ──

let shiftTemplates: ShiftTemplate[] = [...defaultTemplates];
let shiftAssignments: ShiftAssignment[] = buildSeedAssignments();
let shiftLoaded = false;

interface ShiftBlobData { templates: ShiftTemplate[]; assignments: ShiftAssignment[] }

async function ensureShiftLoaded() {
    if (!shiftLoaded) {
        const data = await loadFromBlob<ShiftBlobData>('hr-shifts', null as any);
        if (data) {
            shiftTemplates = data.templates;
            shiftAssignments = data.assignments;
        }
        shiftLoaded = true;
    }
}

async function saveShift() {
    await saveToBlob<ShiftBlobData>('hr-shifts', { templates: shiftTemplates, assignments: shiftAssignments });
}

// ── Helpers ──

function timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

function minutesToHours(mins: number): number {
    return Math.round((mins / 60) * 100) / 100;
}

// ── Store ──

export const HRShiftStore = {

    // ═══ Shift Templates ═══

    async getTemplates(): Promise<ShiftTemplate[]> {
        await ensureShiftLoaded();
        return [...shiftTemplates];
    },

    async getTemplateById(id: string): Promise<ShiftTemplate | undefined> {
        await ensureShiftLoaded();
        return shiftTemplates.find(t => t.id === id);
    },

    async addTemplate(data: Omit<ShiftTemplate, 'id'>): Promise<ShiftTemplate> {
        await ensureShiftLoaded();
        const template: ShiftTemplate = {
            ...data,
            id: `tpl-${Date.now()}`,
        };
        shiftTemplates.push(template);
        await saveShift();
        return template;
    },

    async updateTemplate(id: string, updates: Partial<Omit<ShiftTemplate, 'id'>>): Promise<ShiftTemplate | null> {
        await ensureShiftLoaded();
        const idx = shiftTemplates.findIndex(t => t.id === id);
        if (idx === -1) return null;
        shiftTemplates[idx] = { ...shiftTemplates[idx], ...updates };
        await saveShift();
        return shiftTemplates[idx];
    },

    async deleteTemplate(id: string): Promise<boolean> {
        await ensureShiftLoaded();
        const len = shiftTemplates.length;
        shiftTemplates = shiftTemplates.filter(t => t.id !== id);
        if (shiftTemplates.length < len) { await saveShift(); return true; }
        return false;
    },

    // ═══ Shift Assignments ═══

    async getAssignments(filters?: {
        date?: string;
        startDate?: string;
        endDate?: string;
        branchId?: string;
        employeeId?: string;
        status?: ShiftStatus;
    }): Promise<ShiftAssignment[]> {
        await ensureShiftLoaded();
        let result = [...shiftAssignments];

        if (filters?.date) {
            result = result.filter(a => a.date === filters.date);
        }
        if (filters?.startDate) {
            result = result.filter(a => a.date >= filters.startDate!);
        }
        if (filters?.endDate) {
            result = result.filter(a => a.date <= filters.endDate!);
        }
        if (filters?.branchId) {
            result = result.filter(a => a.branchId === filters.branchId);
        }
        if (filters?.employeeId) {
            result = result.filter(a => a.employeeId === filters.employeeId);
        }
        if (filters?.status) {
            result = result.filter(a => a.status === filters.status);
        }

        return result;
    },

    async assignShift(data: {
        employeeId: string;
        date: string;
        shiftTemplateId: string;
        branchId: string;
        startTime?: string;
        endTime?: string;
        breakMinutes?: number;
        notes?: string;
    }): Promise<ShiftAssignment> {
        await ensureShiftLoaded();
        const now = new Date().toISOString();
        const template = shiftTemplates.find(t => t.id === data.shiftTemplateId);
        const branch = WORKPLACES.find(w => w.id === data.branchId);

        shiftAssignments = shiftAssignments.filter(
            a => !(a.employeeId === data.employeeId && a.date === data.date)
        );

        const start = data.startTime || template?.startTime || '09:00';
        const end = data.endTime || template?.endTime || '18:00';
        const brk = data.breakMinutes ?? template?.breakMinutes ?? 0;

        const totalMin = timeToMinutes(end) - timeToMinutes(start);
        const netHours = minutesToHours(Math.max(0, totalMin - brk));

        const isCustom = !!(data.startTime || data.endTime);
        const shiftLabel = isCustom
            ? `Custom (${start}–${end})`
            : (template?.name || 'Custom');

        const assignment: ShiftAssignment = {
            id: `shift-${data.employeeId}-${data.date}`,
            employeeId: data.employeeId,
            date: data.date,
            shiftTemplateId: data.shiftTemplateId || '',
            shiftName: shiftLabel,
            branchId: data.branchId,
            branchName: branch?.name || data.branchId,
            startTime: start,
            endTime: end,
            expectedHours: netHours,
            breakMinutes: brk,
            status: 'SCHEDULED',
            isClinicianAutoShift: false,
            notes: data.notes || '',
            createdAt: now,
            updatedAt: now,
        };

        shiftAssignments.push(assignment);
        await saveShift();
        return assignment;
    },

    async updateAssignment(id: string, updates: Partial<Omit<ShiftAssignment, 'id' | 'createdAt'>>): Promise<ShiftAssignment | null> {
        await ensureShiftLoaded();
        const idx = shiftAssignments.findIndex(a => a.id === id);
        if (idx === -1) return null;
        shiftAssignments[idx] = {
            ...shiftAssignments[idx],
            ...updates,
            updatedAt: new Date().toISOString(),
        };
        await saveShift();
        return shiftAssignments[idx];
    },

    async deleteAssignment(id: string): Promise<boolean> {
        await ensureShiftLoaded();
        const len = shiftAssignments.length;
        shiftAssignments = shiftAssignments.filter(a => a.id !== id);
        if (shiftAssignments.length < len) { await saveShift(); return true; }
        return false;
    },

    // ═══ Clinician Auto-Shift Generation ═══

    async generateClinicianShifts(date: string, branchId?: string): Promise<{
        generated: number;
        shifts: ShiftAssignment[];
    }> {
        await ensureShiftLoaded();
        const allBookings = await BookingsStore.getByFilters({ date });
        const generated: ShiftAssignment[] = [];
        const now = new Date().toISOString();

        const doctorBookings: Record<string, { slots: string[]; clinicId: string; count: number }> = {};
        for (const b of allBookings) {
            if (b.status === 'cancelled') continue;
            if (branchId && b.clinicId !== branchId) continue;

            if (!doctorBookings[b.doctorId]) {
                doctorBookings[b.doctorId] = { slots: [], clinicId: b.clinicId, count: 0 };
            }
            doctorBookings[b.doctorId].slots.push(b.slot);
            doctorBookings[b.doctorId].count++;
        }

        for (const [doctorId, data] of Object.entries(doctorBookings)) {
            if (data.slots.length === 0) continue;

            let doctorName = doctorId;
            for (const clinic of clinics) {
                for (const dept of clinic.departments) {
                    const doc = dept.doctors.find(d => d.id === doctorId);
                    if (doc) { doctorName = doc.name; break; }
                }
            }

            const sortedSlots = data.slots.sort((a, b) => {
                return timeToMinutes(convertTo24(a)) - timeToMinutes(convertTo24(b));
            });

            const firstSlot24 = convertTo24(sortedSlots[0]);
            const lastSlot24 = convertTo24(sortedSlots[sortedSlots.length - 1]);
            const shiftStart = addMinutesToTime(firstSlot24, -30);
            const shiftEnd = addMinutesToTime(lastSlot24, 60);

            const startMin = timeToMinutes(shiftStart);
            const endMin = timeToMinutes(shiftEnd);
            const totalMin = endMin - startMin;
            const breakMin = totalMin > 300 ? 60 : 0;
            const expectedHours = minutesToHours(totalMin - breakMin);

            const empId = `clinician-${doctorId}`;

            shiftAssignments = shiftAssignments.filter(
                a => !(a.employeeId === empId && a.date === date && a.isClinicianAutoShift)
            );

            const branch = WORKPLACES.find(w => w.id === data.clinicId);

            const assignment: ShiftAssignment = {
                id: `cshift-${doctorId}-${date}`,
                employeeId: empId,
                date,
                shiftTemplateId: '',
                shiftName: `Auto: ${doctorName}`,
                branchId: data.clinicId,
                branchName: branch?.name || data.clinicId,
                startTime: shiftStart,
                endTime: shiftEnd,
                expectedHours,
                breakMinutes: breakMin,
                status: 'SCHEDULED',
                isClinicianAutoShift: true,
                appointmentCount: data.count,
                notes: `Auto-generated from ${data.count} appointment(s)`,
                createdAt: now,
                updatedAt: now,
            };

            shiftAssignments.push(assignment);
            generated.push(assignment);
        }

        await saveShift();
        return { generated: generated.length, shifts: generated };
    },

    // ═══ Shift vs Attendance Comparison ═══

    async compareAttendanceVsShift(date: string): Promise<ShiftAttendanceComparison[]> {
        await ensureShiftLoaded();
        const dayAssignments = shiftAssignments.filter(a => a.date === date && a.status !== 'OFF_DUTY');
        const dayAttendance = await HRAttendanceStore.getAll({ date });
        const comparisons: ShiftAttendanceComparison[] = [];

        const attendanceMap: Record<string, AttendanceRecord> = {};
        for (const att of dayAttendance) {
            attendanceMap[att.employeeId] = att;
        }

        // Pre-load employees
        const allEmployees = await HRStore.getAll();
        const employeeMap = new Map(allEmployees.map(e => [e.id, e]));

        for (const shift of dayAssignments) {
            const emp = employeeMap.get(shift.employeeId);
            const att = attendanceMap[shift.employeeId];

            let status: ShiftAttendanceComparison['status'] = 'ABSENT';
            let actualHours = 0;
            let actualPunchIn: string | null = null;
            let actualPunchOut: string | null = null;

            if (att) {
                actualPunchIn = att.punchIn;
                actualPunchOut = att.punchOut;
                actualHours = att.totalHours;

                if (att.punchIn && att.punchOut) {
                    const scheduledStartMin = timeToMinutes(shift.startTime);
                    const punchInMin = timeToMinutes(att.punchIn);
                    const scheduledEndMin = timeToMinutes(shift.endTime);
                    const punchOutMin = timeToMinutes(att.punchOut);

                    if (punchInMin > scheduledStartMin + 15) {
                        status = 'LATE_ARRIVAL';
                    } else if (punchOutMin < scheduledEndMin - 15) {
                        status = 'EARLY_LEAVE';
                    } else if (actualHours > shift.expectedHours + 0.5) {
                        status = 'OVERTIME';
                    } else {
                        status = 'ON_TIME';
                    }
                }
            }

            const varianceHours = Math.round((actualHours - shift.expectedHours) * 100) / 100;

            comparisons.push({
                employeeId: shift.employeeId,
                employeeName: emp ? `${emp.firstName} ${emp.lastName}` : shift.shiftName,
                employeeCode: emp?.employeeCode || '',
                branchName: shift.branchName,
                shiftName: shift.shiftName,
                scheduledStart: shift.startTime,
                scheduledEnd: shift.endTime,
                expectedHours: shift.expectedHours,
                actualPunchIn,
                actualPunchOut,
                actualHours,
                varianceHours,
                status,
            });
        }

        return comparisons;
    },

    // ═══ Clinician Availability Check (for booking integration) ═══

    async isClinicianAvailable(doctorId: string, date: string): Promise<{
        available: boolean;
        reason?: string;
        shift?: ShiftAssignment;
    }> {
        await ensureShiftLoaded();
        for (const clinic of clinics) {
            for (const dept of clinic.departments) {
                const doc = dept.doctors.find(d => d.id === doctorId);
                if (doc) {
                    if (doc.status === 'not_working') {
                        return { available: false, reason: 'Clinician is not currently working' };
                    }
                    if (doc.daysOff && doc.daysOff.length > 0) {
                        const dayOfWeek = new Date(date).getDay();
                        if (doc.daysOff.includes(dayOfWeek)) {
                            return { available: false, reason: `Clinician is off on ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek]}` };
                        }
                    }
                    break;
                }
            }
        }

        const empId = `clinician-${doctorId}`;
        const assignment = shiftAssignments.find(
            a => (a.employeeId === empId || a.employeeId === doctorId) && a.date === date
        );

        if (assignment) {
            if (assignment.status === 'OFF_DUTY') {
                return { available: false, reason: 'Clinician is off duty', shift: assignment };
            }
            return { available: true, shift: assignment };
        }

        return { available: true };
    },

    // ═══ Summary for a date ═══

    async getDaySummary(date: string) {
        await ensureShiftLoaded();
        const assignments = shiftAssignments.filter(a => a.date === date);
        return {
            total: assignments.length,
            scheduled: assignments.filter(a => a.status === 'SCHEDULED').length,
            checkedIn: assignments.filter(a => a.status === 'CHECKED_IN').length,
            completed: assignments.filter(a => a.status === 'COMPLETED').length,
            absent: assignments.filter(a => a.status === 'ABSENT').length,
            offDuty: assignments.filter(a => a.status === 'OFF_DUTY').length,
            clinicianAuto: assignments.filter(a => a.isClinicianAutoShift).length,
        };
    },
};

// ── Time helpers ──

function convertTo24(slot: string): string {
    // "10:00 AM" → "10:00", "02:00 PM" → "14:00"
    const match = slot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return slot; // Already 24h format
    let h = parseInt(match[1]);
    const m = match[2];
    const period = match[3].toUpperCase();
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
}

function addMinutesToTime(time24: string, minutes: number): string {
    const totalMin = timeToMinutes(time24) + minutes;
    const clamped = Math.max(0, Math.min(totalMin, 23 * 60 + 59));
    const h = Math.floor(clamped / 60);
    const m = clamped % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

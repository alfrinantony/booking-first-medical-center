// ─────────────────────────────────────────────────────────────
// HR Attendance Store — Employee attendance data & processing
// ─────────────────────────────────────────────────────────────

import { loadFromBlob, saveToBlob } from './blob-persistence';

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'EARLY_LEAVE' | 'HALF_DAY' | 'ON_LEAVE' | 'DAY_OFF';
export type PunchSource = 'BIOMETRIC' | 'MANUAL';

export interface Shift {
    punchIn: string;  // HH:mm
    punchOut: string; // HH:mm
}

export interface AttendanceRecord {
    id: string;
    employeeId: string;
    date: string;           // YYYY-MM-DD
    punchIn: string | null; // HH:mm (24h) — first punch of the day
    punchOut: string | null; // last punch of the day
    shifts: Shift[];         // individual shift segments
    isSplitDuty: boolean;    // true if multiple separate shifts in one day
    rawHours: number;        // total hours before break deduction
    breakDeducted: number;   // hours deducted as break (1 if >5h continuous, 0 if split)
    totalHours: number;      // net working hours (rawHours - breakDeducted)
    status: AttendanceStatus;
    source: PunchSource;
    notes: string;
    createdAt: string;
    updatedAt: string;
}

export interface AttendanceAlert {
    id: string;
    employeeId: string;
    employeeName: string;
    type: 'LATE' | 'ABSENT' | 'EARLY_LEAVE';
    date: string;
    message: string;
    read: boolean;
    createdAt: string;
}

export interface DeviceConfig {
    id: string;
    name: string;
    serialNumber: string;
    host: string;
    port: number;
    branchId: string;        // Assigned branch (matches WORKPLACES[].id)
    branchName: string;      // Display label
    status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
    lastSync: string | null;
    autoSyncEnabled: boolean;
    autoSyncIntervalMinutes: number;
}

export interface MonthlyTimesheet {
    employeeId: string;
    employeeName: string;
    employeeCode: string;
    month: number;
    year: number;
    records: AttendanceRecord[];
    totalWorkingDays: number;
    totalDaysPresent: number;
    totalHoursWorked: number;
    lateDays: number;
    absentDays: number;
    earlyLeaveDays: number;
    halfDays: number;
    onLeaveDays: number;
    averageHoursPerDay: number;
}

// ── Work policy defaults ──
export const WORK_POLICY = {
    workStartTime: '09:00',       // 9:00 AM
    workEndTime: '18:00',         // 6:00 PM
    lateThresholdMinutes: 15,     // Grace period
    halfDayHours: 4,
    fullDayHours: 8,
    weeklyOffDays: [5, 6],        // Friday, Saturday (UAE)
    breakDeductionThresholdHours: 5, // Deduct break if continuous shift > 5 hours
    breakDeductionHours: 1,          // Hours to deduct as break
};

// ── Helpers ──
function timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

function computeShiftHours(punchIn: string, punchOut: string): number {
    const diff = timeToMinutes(punchOut) - timeToMinutes(punchIn);
    return Math.max(0, +(diff / 60).toFixed(2));
}

/**
 * Compute working hours with break deduction and split duty rules:
 * - If single continuous shift > 5 hours → deduct 1 hour break
 * - If split duty (multiple shifts in a day) → NO break deduction
 */
function computeWorkingHours(shifts: Shift[]): { rawHours: number; breakDeducted: number; totalHours: number; isSplitDuty: boolean } {
    if (shifts.length === 0) {
        return { rawHours: 0, breakDeducted: 0, totalHours: 0, isSplitDuty: false };
    }

    const rawHours = +shifts.reduce((sum, s) => sum + computeShiftHours(s.punchIn, s.punchOut), 0).toFixed(2);
    const isSplitDuty = shifts.length > 1;

    // Split duty → no break deduction
    if (isSplitDuty) {
        return { rawHours, breakDeducted: 0, totalHours: rawHours, isSplitDuty: true };
    }

    // Single continuous shift → deduct 1h break if > 5 hours
    const breakDeducted = rawHours > WORK_POLICY.breakDeductionThresholdHours
        ? WORK_POLICY.breakDeductionHours
        : 0;

    return {
        rawHours,
        breakDeducted,
        totalHours: +(rawHours - breakDeducted).toFixed(2),
        isSplitDuty: false,
    };
}

/** Build shifts from simple punchIn/punchOut (backward compat) */
function buildShifts(punchIn: string | null, punchOut: string | null): Shift[] {
    if (!punchIn || !punchOut) return [];
    return [{ punchIn, punchOut }];
}

function detectStatus(punchIn: string | null, punchOut: string | null, totalHours: number): AttendanceStatus {
    if (!punchIn && !punchOut) return 'ABSENT';
    if (!punchIn || !punchOut) return 'HALF_DAY';

    const startMin = timeToMinutes(WORK_POLICY.workStartTime);
    const inMin = timeToMinutes(punchIn);

    // Late check
    if (inMin > startMin + WORK_POLICY.lateThresholdMinutes) {
        return 'LATE';
    }
    // Early leave
    const endMin = timeToMinutes(WORK_POLICY.workEndTime);
    const outMin = timeToMinutes(punchOut);
    if (outMin < endMin - 30 && totalHours < WORK_POLICY.fullDayHours) {
        return 'EARLY_LEAVE';
    }
    // Half day
    if (totalHours > 0 && totalHours < WORK_POLICY.halfDayHours) {
        return 'HALF_DAY';
    }

    return 'PRESENT';
}

// ── Seed data ── (March 2026 for demo)
function generateSeedData(): AttendanceRecord[] {
    const records: AttendanceRecord[] = [];
    const employees = [
        { id: 'emp-001', code: 'FMC-001' },
        { id: 'emp-002', code: 'FMC-002' },
        { id: 'emp-003', code: 'FMC-003' },
    ];

    // Generate records for March 1-6, 2026
    for (let day = 1; day <= 6; day++) {
        const date = `2026-03-${String(day).padStart(2, '0')}`;
        const dayOfWeek = new Date(2026, 2, day).getDay(); // 0=Sun ... 6=Sat

        for (const emp of employees) {
            // Skip weekends (Fri=5, Sat=6)
            if (WORK_POLICY.weeklyOffDays.includes(dayOfWeek)) {
                records.push({
                    id: `att-${emp.code}-${date}`,
                    employeeId: emp.id,
                    date,
                    punchIn: null,
                    punchOut: null,
                    shifts: [],
                    isSplitDuty: false,
                    rawHours: 0,
                    breakDeducted: 0,
                    totalHours: 0,
                    status: 'DAY_OFF',
                    source: 'BIOMETRIC',
                    notes: 'Weekend',
                    createdAt: `${date}T00:00:00Z`,
                    updatedAt: `${date}T00:00:00Z`,
                });
                continue;
            }

            // Simulate different scenarios
            let shifts: Shift[];
            let notes = '';

            if (emp.id === 'emp-001') {
                // Ahmed — always on time, continuous shifts (break deducted)
                if (day === 3) {
                    shifts = [{ punchIn: '09:22', punchOut: '17:30' }]; // 8.13h raw → 7.13h net
                    notes = 'Traffic delay';
                } else {
                    shifts = [{ punchIn: '08:55', punchOut: '18:05' }]; // 9.17h raw → 8.17h net
                }
            } else if (emp.id === 'emp-002') {
                if (day === 3) {
                    // Fatima — split duty day (morning + evening)
                    shifts = [
                        { punchIn: '09:00', punchOut: '13:00' }, // 4h
                        { punchIn: '17:00', punchOut: '21:00' }, // 4h
                    ]; // 8h total, NO break deduction (split duty)
                    notes = 'Split duty — morning + evening shift';
                } else if (day === 4) {
                    shifts = [{ punchIn: '09:10', punchOut: '14:30' }]; // 5.33h raw → 4.33h net
                    notes = 'Doctor appointment';
                } else {
                    shifts = [{ punchIn: '08:50', punchOut: '18:00' }]; // 9.17h raw → 8.17h net
                }
            } else {
                // Ravi — absent one day, late another
                if (day === 2) {
                    shifts = [];
                    notes = 'No show';
                } else if (day === 5) {
                    shifts = [{ punchIn: '09:45', punchOut: '18:10' }]; // 8.42h raw → 7.42h net
                    notes = 'Bus delay';
                } else {
                    shifts = [{ punchIn: '08:58', punchOut: '18:02' }]; // 9.07h raw → 8.07h net
                }
            }

            const punchIn = shifts.length > 0 ? shifts[0].punchIn : null;
            const punchOut = shifts.length > 0 ? shifts[shifts.length - 1].punchOut : null;
            const { rawHours, breakDeducted, totalHours, isSplitDuty } = computeWorkingHours(shifts);
            const status = detectStatus(punchIn, punchOut, totalHours);

            records.push({
                id: `att-${emp.code}-${date}`,
                employeeId: emp.id,
                date,
                punchIn,
                punchOut,
                shifts,
                isSplitDuty,
                rawHours,
                breakDeducted,
                totalHours,
                status,
                source: 'BIOMETRIC',
                notes,
                createdAt: `${date}T${punchIn || '00:00'}:00Z`,
                updatedAt: `${date}T${punchOut || '00:00'}:00Z`,
            });
        }
    }

    return records;
}

let attendanceRecords: AttendanceRecord[] = generateSeedData();
let alerts: AttendanceAlert[] = [];
let nextId = 100;
let attLoaded = false;

interface AttBlobData { records: AttendanceRecord[]; alerts: AttendanceAlert[]; nextId: number; devices: DeviceConfig[] }

async function ensureAttLoaded() {
    if (!attLoaded) {
        const data = await loadFromBlob<AttBlobData>('hr-attendance', null as any);
        if (data) {
            attendanceRecords = data.records;
            alerts = data.alerts;
            nextId = data.nextId;
            devices = data.devices;
        }
        attLoaded = true;
    }
}

async function saveAtt() {
    await saveToBlob<AttBlobData>('hr-attendance', { records: attendanceRecords, alerts, nextId, devices });
}

// ── Device config ──
let devices: DeviceConfig[] = [
    {
        id: 'dev-001',
        name: 'SpeedFace-V5L — Al Muraqabat',
        serialNumber: 'SFVL-2024-00001',
        host: '192.168.1.200',
        port: 4370,
        branchId: 'clinic-1',
        branchName: 'Al Muraqabat Branch',
        status: 'ONLINE',
        lastSync: '2026-03-06T07:00:00Z',
        autoSyncEnabled: true,
        autoSyncIntervalMinutes: 15,
    },
    {
        id: 'dev-002',
        name: 'SpeedFace-V5L — Al Qiyadah',
        serialNumber: 'SFVL-2024-00002',
        host: '192.168.2.200',
        port: 4370,
        branchId: 'clinic-2',
        branchName: 'Al Qiyadah Branch',
        status: 'ONLINE',
        lastSync: '2026-03-06T07:00:00Z',
        autoSyncEnabled: true,
        autoSyncIntervalMinutes: 15,
    },
    {
        id: 'dev-003',
        name: 'SpeedFace-V5L — Silicon Oasis',
        serialNumber: 'SFVL-2024-00003',
        host: '192.168.3.200',
        port: 4370,
        branchId: 'clinic-3',
        branchName: 'Silicon Oasis Branch',
        status: 'ONLINE',
        lastSync: '2026-03-06T06:45:00Z',
        autoSyncEnabled: true,
        autoSyncIntervalMinutes: 15,
    },
];

// ── Store ──
export const HRAttendanceStore = {
    // ── Attendance CRUD ──
    async getAll(filters?: {
        employeeId?: string;
        date?: string;
        startDate?: string;
        endDate?: string;
        status?: AttendanceStatus;
    }): Promise<AttendanceRecord[]> {
        await ensureAttLoaded();
        let result = [...attendanceRecords];

        if (filters?.employeeId) {
            result = result.filter(r => r.employeeId === filters.employeeId);
        }
        if (filters?.date) {
            result = result.filter(r => r.date === filters.date);
        }
        if (filters?.startDate && filters?.endDate) {
            result = result.filter(r => r.date >= filters.startDate! && r.date <= filters.endDate!);
        }
        if (filters?.status) {
            result = result.filter(r => r.status === filters.status);
        }

        return result.sort((a, b) => b.date.localeCompare(a.date) || a.employeeId.localeCompare(b.employeeId));
    },

    async getById(id: string): Promise<AttendanceRecord | undefined> {
        await ensureAttLoaded();
        return attendanceRecords.find(r => r.id === id);
    },

    async create(data: Omit<AttendanceRecord, 'id' | 'totalHours' | 'rawHours' | 'breakDeducted' | 'isSplitDuty' | 'shifts' | 'status' | 'createdAt' | 'updatedAt'> & { status?: AttendanceStatus; shifts?: Shift[] }): Promise<AttendanceRecord> {
        await ensureAttLoaded();
        const shifts = data.shifts || buildShifts(data.punchIn, data.punchOut);
        const { rawHours, breakDeducted, totalHours, isSplitDuty } = computeWorkingHours(shifts);
        const status = data.status || detectStatus(data.punchIn, data.punchOut, totalHours);
        const now = new Date().toISOString();

        const record: AttendanceRecord = {
            id: `att-${++nextId}`,
            employeeId: data.employeeId,
            date: data.date,
            punchIn: data.punchIn,
            punchOut: data.punchOut,
            shifts,
            isSplitDuty,
            rawHours,
            breakDeducted,
            totalHours,
            status,
            source: data.source,
            notes: data.notes || '',
            createdAt: now,
            updatedAt: now,
        };

        attendanceRecords.push(record);
        await saveAtt();
        return record;
    },

    async update(id: string, updates: Partial<Pick<AttendanceRecord, 'punchIn' | 'punchOut' | 'notes' | 'status' | 'source'>> & { shifts?: Shift[] }): Promise<AttendanceRecord | null> {
        await ensureAttLoaded();
        const idx = attendanceRecords.findIndex(r => r.id === id);
        if (idx === -1) return null;

        const record = { ...attendanceRecords[idx], ...updates };

        // Recalculate hours and status if punches or shifts changed
        if (updates.punchIn !== undefined || updates.punchOut !== undefined || updates.shifts) {
            record.shifts = updates.shifts || buildShifts(record.punchIn, record.punchOut);
            const result = computeWorkingHours(record.shifts);
            record.rawHours = result.rawHours;
            record.breakDeducted = result.breakDeducted;
            record.totalHours = result.totalHours;
            record.isSplitDuty = result.isSplitDuty;
            if (!updates.status) {
                record.status = detectStatus(record.punchIn, record.punchOut, record.totalHours);
            }
        }

        record.updatedAt = new Date().toISOString();
        attendanceRecords[idx] = record;
        await saveAtt();
        return record;
    },

    async delete(id: string): Promise<boolean> {
        await ensureAttLoaded();
        const len = attendanceRecords.length;
        attendanceRecords = attendanceRecords.filter(r => r.id !== id);
        if (attendanceRecords.length < len) { await saveAtt(); return true; }
        return false;
    },

    // ── Timesheet ──
    async generateTimesheet(employeeId: string, month: number, year: number, employeeName: string, employeeCode: string): Promise<MonthlyTimesheet> {
        await ensureAttLoaded();
        const records = attendanceRecords.filter(r => {
            const d = new Date(r.date);
            return r.employeeId === employeeId && d.getMonth() + 1 === month && d.getFullYear() === year;
        });

        const daysInMonth = new Date(year, month, 0).getDate();
        let totalWorkingDays = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            const dow = new Date(year, month - 1, d).getDay();
            if (!WORK_POLICY.weeklyOffDays.includes(dow)) totalWorkingDays++;
        }

        const presentRecords = records.filter(r => !['ABSENT', 'DAY_OFF', 'ON_LEAVE'].includes(r.status));
        const totalHoursWorked = +records.reduce((sum, r) => sum + r.totalHours, 0).toFixed(2);

        return {
            employeeId,
            employeeName,
            employeeCode,
            month,
            year,
            records: records.sort((a, b) => a.date.localeCompare(b.date)),
            totalWorkingDays,
            totalDaysPresent: presentRecords.length,
            totalHoursWorked,
            lateDays: records.filter(r => r.status === 'LATE').length,
            absentDays: records.filter(r => r.status === 'ABSENT').length,
            earlyLeaveDays: records.filter(r => r.status === 'EARLY_LEAVE').length,
            halfDays: records.filter(r => r.status === 'HALF_DAY').length,
            onLeaveDays: records.filter(r => r.status === 'ON_LEAVE').length,
            averageHoursPerDay: presentRecords.length > 0 ? +(totalHoursWorked / presentRecords.length).toFixed(2) : 0,
        };
    },

    // ── Alerts ──
    async getAlerts(unreadOnly = false): Promise<AttendanceAlert[]> {
        await ensureAttLoaded();
        if (unreadOnly) return alerts.filter(a => !a.read);
        return [...alerts];
    },

    async generateAlerts(date: string, employees: { id: string; name: string }[]): Promise<AttendanceAlert[]> {
        await ensureAttLoaded();
        const todayRecords = attendanceRecords.filter(r => r.date === date);
        const newAlerts: AttendanceAlert[] = [];

        for (const emp of employees) {
            const record = todayRecords.find(r => r.employeeId === emp.id);

            if (!record || record.status === 'ABSENT') {
                newAlerts.push({
                    id: `alert-${Date.now()}-${emp.id}`,
                    employeeId: emp.id,
                    employeeName: emp.name,
                    type: 'ABSENT',
                    date,
                    message: `${emp.name} is absent today (${date})`,
                    read: false,
                    createdAt: new Date().toISOString(),
                });
            } else if (record.status === 'LATE') {
                newAlerts.push({
                    id: `alert-${Date.now()}-${emp.id}`,
                    employeeId: emp.id,
                    employeeName: emp.name,
                    type: 'LATE',
                    date,
                    message: `${emp.name} arrived late at ${record.punchIn} (expected by ${WORK_POLICY.workStartTime})`,
                    read: false,
                    createdAt: new Date().toISOString(),
                });
            } else if (record.status === 'EARLY_LEAVE') {
                newAlerts.push({
                    id: `alert-${Date.now()}-${emp.id}`,
                    employeeId: emp.id,
                    employeeName: emp.name,
                    type: 'EARLY_LEAVE',
                    date,
                    message: `${emp.name} left early at ${record.punchOut}`,
                    read: false,
                    createdAt: new Date().toISOString(),
                });
            }
        }

        alerts.push(...newAlerts);
        await saveAtt();
        return newAlerts;
    },

    async markAlertRead(id: string): Promise<void> {
        await ensureAttLoaded();
        const alert = alerts.find(a => a.id === id);
        if (alert) { alert.read = true; await saveAtt(); }
    },

    // ── Devices ──
    async getDevices(): Promise<DeviceConfig[]> {
        await ensureAttLoaded();
        return [...devices];
    },

    async getDevice(id: string): Promise<DeviceConfig | undefined> {
        await ensureAttLoaded();
        return devices.find(d => d.id === id);
    },

    async updateDevice(id: string, updates: Partial<DeviceConfig>): Promise<DeviceConfig | null> {
        await ensureAttLoaded();
        const idx = devices.findIndex(d => d.id === id);
        if (idx === -1) return null;
        devices[idx] = { ...devices[idx], ...updates };
        await saveAtt();
        return devices[idx];
    },

    async addDevice(data: Omit<DeviceConfig, 'id' | 'status' | 'lastSync'>): Promise<DeviceConfig> {
        await ensureAttLoaded();
        const device: DeviceConfig = {
            ...data,
            id: `dev-${Date.now()}`,
            status: 'UNKNOWN',
            lastSync: null,
        };
        devices.push(device);
        await saveAtt();
        return device;
    },

    async removeDevice(id: string): Promise<boolean> {
        await ensureAttLoaded();
        const len = devices.length;
        devices = devices.filter(d => d.id !== id);
        if (devices.length < len) { await saveAtt(); return true; }
        return false;
    },

    // ── Today's summary ──
    async getTodaySummary(date: string, employees?: { weeklyOffDays?: string[] }[]) {
        await ensureAttLoaded();
        const records = attendanceRecords.filter(r => r.date === date);

        // Count employees whose weekly off days include this date's day name
        let weeklyOff = records.filter(r => r.status === 'DAY_OFF').length;
        if (employees && employees.length > 0) {
            const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
            weeklyOff = employees.filter(e => (e.weeklyOffDays || []).includes(dayName)).length;
        }

        return {
            total: records.length,
            present: records.filter(r => r.status === 'PRESENT').length,
            late: records.filter(r => r.status === 'LATE').length,
            absent: records.filter(r => r.status === 'ABSENT').length,
            earlyLeave: records.filter(r => r.status === 'EARLY_LEAVE').length,
            halfDay: records.filter(r => r.status === 'HALF_DAY').length,
            onLeave: records.filter(r => r.status === 'ON_LEAVE').length,
            dayOff: records.filter(r => r.status === 'DAY_OFF').length,
            weeklyOff,
        };
    },

    // ── Bulk import (from device sync) ──
    async bulkImport(records: Omit<AttendanceRecord, 'id' | 'totalHours' | 'status' | 'createdAt' | 'updatedAt'>[]): Promise<number> {
        await ensureAttLoaded();
        let imported = 0;
        for (const data of records) {
            const exists = attendanceRecords.find(
                r => r.employeeId === data.employeeId && r.date === data.date
            );
            if (exists) continue;

            await this.create(data);
            imported++;
        }
        return imported;
    },
};

// ── Leave Management Store (UAE Labor Law compliant) ──

import { loadFromBlob, saveToBlob } from './blob-persistence';

export const LEAVE_TYPES = [
    'Annual Leave',
    'Sick Leave',
    'Maternity Leave',
    'Paternity Leave',
    'Parental Leave',
    'Emergency Leave',
    'Unpaid Leave',
    'Absent',
] as const;

export type LeaveType = typeof LEAVE_TYPES[number];

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface LeaveRequest {
    id: string;
    employeeId: string;
    leaveType: LeaveType;
    startDate: string; // ISO date
    endDate: string;   // ISO date
    totalDays: number;
    reason: string;
    status: LeaveStatus;
    approvedBy?: string;
    rejectedReason?: string;
    createdAt: string;
    updatedAt: string;
}

export interface LeavePlanning {
    id: string;
    employeeId: string;
    leaveType: LeaveType;
    plannedStartDate: string;
    plannedEndDate: string;
    plannedDays: number;
    notes: string;
    createdAt: string;
}

// ── UAE Labor Law Leave Entitlements ──
export const UAE_LEAVE_RULES = {
    annualLeave: {
        under1Year: 2, // 2 days per month
        over1Year: 30,  // 30 calendar days per year
    },
    sickLeave: {
        // Max 90 days per year after probation
        fullPayDays: 15,
        halfPayDays: 30,
        unpaidDays: 45,
        totalDays: 90,
    },
    maternityLeave: {
        fullPayDays: 45,
        halfPayDays: 15,
        totalDays: 60,
    },
    paternityLeave: {
        paidDays: 5, // within 6 months of child's birth
    },
    parentalLeave: {
        paidDays: 5, // consecutive or non-consecutive within 6 months
    },
    absentTermination: {
        nonConsecutiveDays: 20, // per year
        consecutiveDays: 7,     // can be terminated without notice
    },
};

// ── In-memory store ──
let leaveRequests: LeaveRequest[] = [
    {
        id: 'lr-001',
        employeeId: 'emp-001',
        leaveType: 'Annual Leave',
        startDate: '2026-03-15',
        endDate: '2026-03-19',
        totalDays: 5,
        reason: 'Family vacation',
        status: 'APPROVED',
        approvedBy: 'Admin',
        createdAt: '2026-02-20T10:00:00Z',
        updatedAt: '2026-02-21T09:00:00Z',
    },
    {
        id: 'lr-002',
        employeeId: 'emp-002',
        leaveType: 'Sick Leave',
        startDate: '2026-02-25',
        endDate: '2026-02-26',
        totalDays: 2,
        reason: 'Fever and flu',
        status: 'APPROVED',
        approvedBy: 'Admin',
        createdAt: '2026-02-24T08:00:00Z',
        updatedAt: '2026-02-24T09:00:00Z',
    },
    {
        id: 'lr-003',
        employeeId: 'emp-001',
        leaveType: 'Emergency Leave',
        startDate: '2026-04-10',
        endDate: '2026-04-11',
        totalDays: 2,
        reason: 'Family emergency',
        status: 'PENDING',
        createdAt: '2026-02-27T14:00:00Z',
        updatedAt: '2026-02-27T14:00:00Z',
    },
    {
        id: 'lr-004',
        employeeId: 'emp-003',
        leaveType: 'Annual Leave',
        startDate: '2026-05-01',
        endDate: '2026-05-10',
        totalDays: 10,
        reason: 'Travel to India',
        status: 'PENDING',
        createdAt: '2026-02-27T10:00:00Z',
        updatedAt: '2026-02-27T10:00:00Z',
    },
];

let leavePlannings: LeavePlanning[] = [
    {
        id: 'lp-001',
        employeeId: 'emp-001',
        leaveType: 'Annual Leave',
        plannedStartDate: '2026-06-01',
        plannedEndDate: '2026-06-14',
        plannedDays: 14,
        notes: 'Summer vacation planned',
        createdAt: '2026-01-15T00:00:00Z',
    },
];

let nextLeaveId = 5;
let nextPlanId = 2;
let leaveLoaded = false;

interface LeaveBlobData { requests: LeaveRequest[]; plannings: LeavePlanning[]; nextLeaveId: number; nextPlanId: number }

async function ensureLeaveLoaded() {
    if (!leaveLoaded) {
        const data = await loadFromBlob<LeaveBlobData>('hr-leave', null as any);
        if (data) {
            leaveRequests = data.requests;
            leavePlannings = data.plannings;
            nextLeaveId = data.nextLeaveId;
            nextPlanId = data.nextPlanId;
        }
        leaveLoaded = true;
    }
}

async function saveLeave() {
    await saveToBlob<LeaveBlobData>('hr-leave', { requests: leaveRequests, plannings: leavePlannings, nextLeaveId, nextPlanId });
}

// ── Leave helper functions ──

export async function getLeavesByEmployee(employeeId: string): Promise<LeaveRequest[]> {
    await ensureLeaveLoaded();
    return leaveRequests.filter(lr => lr.employeeId === employeeId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getPlanningsByEmployee(employeeId: string): Promise<LeavePlanning[]> {
    await ensureLeaveLoaded();
    return leavePlannings.filter(lp => lp.employeeId === employeeId)
        .sort((a, b) => new Date(a.plannedStartDate).getTime() - new Date(b.plannedStartDate).getTime());
}

export async function createLeaveRequest(data: Omit<LeaveRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<LeaveRequest> {
    await ensureLeaveLoaded();
    const lr: LeaveRequest = {
        ...data,
        id: `lr-${String(nextLeaveId++).padStart(3, '0')}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    leaveRequests.push(lr);
    await saveLeave();
    return lr;
}

export async function updateLeaveStatus(id: string, status: LeaveStatus, approvedBy?: string, rejectedReason?: string): Promise<LeaveRequest | null> {
    await ensureLeaveLoaded();
    const lr = leaveRequests.find(l => l.id === id);
    if (!lr) return null;
    lr.status = status;
    lr.updatedAt = new Date().toISOString();
    if (approvedBy) lr.approvedBy = approvedBy;
    if (rejectedReason) lr.rejectedReason = rejectedReason;
    await saveLeave();
    return lr;
}

export async function createLeavePlanning(data: Omit<LeavePlanning, 'id' | 'createdAt'>): Promise<LeavePlanning> {
    await ensureLeaveLoaded();
    const lp: LeavePlanning = {
        ...data,
        id: `lp-${String(nextPlanId++).padStart(3, '0')}`,
        createdAt: new Date().toISOString(),
    };
    leavePlannings.push(lp);
    await saveLeave();
    return lp;
}

export async function deleteLeavePlanning(id: string): Promise<boolean> {
    await ensureLeaveLoaded();
    const idx = leavePlannings.findIndex(lp => lp.id === id);
    if (idx === -1) return false;
    leavePlannings.splice(idx, 1);
    await saveLeave();
    return true;
}

// ── Leave balance calculation ──
export async function getLeaveBalance(employeeId: string) {
    await ensureLeaveLoaded();
    const requests = leaveRequests.filter(lr => lr.employeeId === employeeId && lr.status === 'APPROVED');

    const annualUsed = requests.filter(lr => lr.leaveType === 'Annual Leave').reduce((s, lr) => s + lr.totalDays, 0);
    const sickUsed = requests.filter(lr => lr.leaveType === 'Sick Leave').reduce((s, lr) => s + lr.totalDays, 0);
    const maternityUsed = requests.filter(lr => lr.leaveType === 'Maternity Leave').reduce((s, lr) => s + lr.totalDays, 0);
    const paternityUsed = requests.filter(lr => lr.leaveType === 'Paternity Leave').reduce((s, lr) => s + lr.totalDays, 0);
    const parentalUsed = requests.filter(lr => lr.leaveType === 'Parental Leave').reduce((s, lr) => s + lr.totalDays, 0);
    const emergencyUsed = requests.filter(lr => lr.leaveType === 'Emergency Leave').reduce((s, lr) => s + lr.totalDays, 0);
    const unpaidUsed = requests.filter(lr => lr.leaveType === 'Unpaid Leave').reduce((s, lr) => s + lr.totalDays, 0);
    const absentDays = requests.filter(lr => lr.leaveType === 'Absent').reduce((s, lr) => s + lr.totalDays, 0);

    const sickFullPay = Math.min(sickUsed, UAE_LEAVE_RULES.sickLeave.fullPayDays);
    const sickHalfPay = Math.min(Math.max(sickUsed - 15, 0), UAE_LEAVE_RULES.sickLeave.halfPayDays);
    const sickUnpaid = Math.max(sickUsed - 45, 0);

    const maternityFullPay = Math.min(maternityUsed, UAE_LEAVE_RULES.maternityLeave.fullPayDays);
    const maternityHalfPay = Math.min(Math.max(maternityUsed - 45, 0), UAE_LEAVE_RULES.maternityLeave.halfPayDays);

    const absentWarning = absentDays >= UAE_LEAVE_RULES.absentTermination.nonConsecutiveDays;

    return {
        annualUsed,
        sickUsed,
        sickFullPay,
        sickHalfPay,
        sickUnpaid,
        maternityUsed,
        maternityFullPay,
        maternityHalfPay,
        paternityUsed,
        parentalUsed,
        emergencyUsed,
        unpaidUsed,
        absentDays,
        absentWarning,
        pending: leaveRequests.filter(lr => lr.employeeId === employeeId && lr.status === 'PENDING').length,
    };
}

// ── Date range queries ──
export async function getLeavesByDateRange(startDate: string, endDate: string): Promise<LeaveRequest[]> {
    await ensureLeaveLoaded();
    return leaveRequests.filter(lr => {
        return lr.startDate <= endDate && lr.endDate >= startDate;
    });
}

export async function getAllLeaves(): Promise<LeaveRequest[]> {
    await ensureLeaveLoaded();
    return [...leaveRequests];
}

export async function isEmployeeOnApprovedLeave(employeeId: string, date: string): Promise<boolean> {
    await ensureLeaveLoaded();
    const targetDate = new Date(date).toISOString().split('T')[0];
    return leaveRequests.some(lr => 
        lr.employeeId === employeeId && 
        lr.status === 'APPROVED' && 
        lr.startDate <= targetDate && 
        lr.endDate >= targetDate
    );
}

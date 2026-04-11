import { loadFromBlob, saveToBlob } from './blob-persistence';
import type { MonthlyPayslip, OvertimeCompensation } from './hr-payroll-store';

export interface PayslipRecord {
    id: string;
    employeeId: string;
    month: number;
    year: number;
    
    // Form Inputs
    daysWorked: number;
    annualLeave: number;
    sickLeave: number;
    unpaidLeave: number;
    absentDays: number;
    phDays: number;
    offDays: number;
    cumSick: number;
    incomeProfitAch: number;
    pkgSalesAch: number;
    referralCount: number;
    responsibilityAllowanceAch?: number;
    blocked: boolean;
    expectedHours: number;
    actualHours: number;
    previousOT: number;
    otCompensation: OvertimeCompensation;
    advanceDeduction: number;
    advanceTotal: number;
    advanceRemaining: number;
    penaltyAmount: number;
    penaltyReason: string;
    damagesAmount: number;
    damagesReason: string;

    // Generated
    payslip: MonthlyPayslip | null;
    
    // Processed & Arrears Tracking
    pendingArrears: number;      // Brought forward from previous month(s)
    processedSalary: number;     // What was actually paid
    deficit: number;             // netSalary - processedSalary

    createdAt: string;
    updatedAt: string;
}

let payslips: PayslipRecord[] = [];

async function ensureStoreLoaded() {
    payslips = await loadFromBlob<PayslipRecord[]>('hr-payslips', []);
}

async function saveStore() {
    await saveToBlob('hr-payslips', payslips);
}

export const HRPayslipStore = {
    getForEmployeeMonth: async (employeeId: string, month: number, year: number): Promise<PayslipRecord | null> => {
        await ensureStoreLoaded();
        return payslips.find(p => p.employeeId === employeeId && p.month === month && p.year === year) || null;
    },

    getByMonth: async (month: number, year: number): Promise<PayslipRecord[]> => {
        await ensureStoreLoaded();
        return payslips.filter(p => p.month === month && p.year === year);
    },

    calculateTotalArrearsForEmployee: async (employeeId: string, beforeMonth: number, beforeYear: number): Promise<number> => {
        await ensureStoreLoaded();
        const records = payslips.filter(p => p.employeeId === employeeId);
        
        // Sum all generated netSalaries minus all processedSalaries
        // for any records BEFORE the target month/year.
        let totalDeficit = 0;
        for (const r of records) {
            // Check if record is strictly before the target date
            if (r.year < beforeYear || (r.year === beforeYear && r.month < beforeMonth)) {
                totalDeficit += (r.deficit || 0); // use explicit deficit on record
            }
        }
        return Math.round(totalDeficit * 100) / 100;
    },

    save: async (data: Omit<PayslipRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<PayslipRecord> => {
        await ensureStoreLoaded();
        const existingIndex = payslips.findIndex(p => p.employeeId === data.employeeId && p.month === data.month && p.year === data.year);
        
        const now = new Date().toISOString();
        if (existingIndex >= 0) {
            payslips[existingIndex] = {
                ...payslips[existingIndex],
                ...data,
                updatedAt: now
            };
            await saveStore();
            return payslips[existingIndex];
        } else {
            const newRecord: PayslipRecord = {
                ...data,
                id: `ps-${Date.now()}`,
                createdAt: now,
                updatedAt: now
            };
            payslips.push(newRecord);
            await saveStore();
            return newRecord;
        }
    }
};

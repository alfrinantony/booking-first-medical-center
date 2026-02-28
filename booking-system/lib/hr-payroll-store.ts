// ─────────────────────────────────────────────────────────────
// HR Payroll — Salary, leave, gratuity & EOS calculations
// (UAE Labor Law defaults)
// ─────────────────────────────────────────────────────────────

import { Employee } from './hr-store';

export type TerminationType = 'EMPLOYER_TERMINATION' | 'RESIGNATION' | 'END_OF_CONTRACT';
export type OvertimeCompensation = 'PAID' | 'TIME_BACK';

export interface SalaryBreakdown {
    basicSalary: number;
    housingAllowance: number;
    transportAllowance: number;
    otherAllowances: number;
    grossSalary: number;
    dailyRate: number;
}

export interface LeaveBalance {
    annualEntitlement: number;
    leavesTaken: number;
    sickLeavesTaken: number;
    remainingAnnualLeave: number;
    leaveEncashmentAmount: number;
}

export interface GratuityCalculation {
    yearsOfService: number;
    monthsOfService: number;
    basicSalary: number;
    dailyBasic: number;
    gratuityAmount: number;
    breakdown: string;
}

export interface EndOfServiceCalculation {
    terminationType: TerminationType;
    gratuity: GratuityCalculation;
    leaveEncashment: number;
    totalEOS: number;
}

// ── Helpers ──

function getYearsOfService(joiningDate: string, endDate?: string): number {
    const start = new Date(joiningDate);
    const end = endDate ? new Date(endDate) : new Date();
    const diffMs = end.getTime() - start.getTime();
    return diffMs / (1000 * 60 * 60 * 24 * 365.25);
}

function getMonthsOfService(joiningDate: string, endDate?: string): number {
    const start = new Date(joiningDate);
    const end = endDate ? new Date(endDate) : new Date();
    return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

// ── Calculation functions ──

export const HRPayroll = {
    /** Monthly salary breakdown */
    calculateSalary: (employee: Employee): SalaryBreakdown => {
        const gross = employee.basicSalary + employee.housingAllowance +
            employee.transportAllowance + employee.otherAllowances;
        return {
            basicSalary: employee.basicSalary,
            housingAllowance: employee.housingAllowance,
            transportAllowance: employee.transportAllowance,
            otherAllowances: employee.otherAllowances,
            grossSalary: gross,
            dailyRate: Math.round((gross / 30) * 100) / 100,
        };
    },

    /** Leave balance with encashment value */
    calculateLeaveBalance: (employee: Employee): LeaveBalance => {
        // Prorate entitlement if less than 1 year of service in current year
        const months = getMonthsOfService(employee.joiningDate);
        const currentYearMonths = Math.min(months, 12);
        const proratedEntitlement = months >= 12
            ? employee.annualLeaveEntitlement
            : Math.round((employee.annualLeaveEntitlement / 12) * currentYearMonths);

        const remaining = Math.max(0, proratedEntitlement - employee.leavesTaken);

        // Leave encashment is calculated from BASIC salary only
        const dailyBasic = employee.basicSalary / 30;

        return {
            annualEntitlement: proratedEntitlement,
            leavesTaken: employee.leavesTaken,
            sickLeavesTaken: employee.sickLeavesTaken,
            remainingAnnualLeave: remaining,
            leaveEncashmentAmount: Math.round(remaining * dailyBasic * 100) / 100,
        };
    },

    /** Leave salary: cost of N days of leave */
    calculateLeaveSalary: (employee: Employee, days: number): number => {
        const gross = employee.basicSalary + employee.housingAllowance +
            employee.transportAllowance + employee.otherAllowances;
        return Math.round((gross / 30) * days * 100) / 100;
    },

    /**
     * Gratuity per UAE Labor Law:
     * - First 5 years: 21 days basic salary per year
     * - After 5 years: 30 days basic salary per year
     * - Total gratuity shall not exceed 2 years salary
     */
    calculateGratuity: (employee: Employee, endDate?: string): GratuityCalculation => {
        const years = getYearsOfService(employee.joiningDate, endDate);
        const months = getMonthsOfService(employee.joiningDate, endDate);
        const dailyBasic = employee.basicSalary / 30;

        let gratuity = 0;
        let breakdown = '';

        if (years < 1) {
            gratuity = 0;
            breakdown = 'Less than 1 year of service — no gratuity applicable.';
        } else if (years <= 5) {
            // 21 days per year
            gratuity = dailyBasic * 21 * years;
            breakdown = `${years.toFixed(2)} years × 21 days × AED ${dailyBasic.toFixed(2)}/day`;
        } else {
            // First 5 years: 21 days/year
            const first5 = dailyBasic * 21 * 5;
            // Remaining years: 30 days/year
            const remaining = dailyBasic * 30 * (years - 5);
            gratuity = first5 + remaining;
            breakdown = `5 years × 21 days × AED ${dailyBasic.toFixed(2)} = AED ${first5.toFixed(2)} + ${(years - 5).toFixed(2)} years × 30 days × AED ${dailyBasic.toFixed(2)} = AED ${remaining.toFixed(2)}`;
        }

        // Cap at 2 years' basic salary
        const cap = employee.basicSalary * 24; // 2 years = 24 months
        if (gratuity > cap) {
            gratuity = cap;
            breakdown += ` (capped at 2 years basic salary: AED ${cap.toFixed(2)})`;
        }

        return {
            yearsOfService: Math.round(years * 100) / 100,
            monthsOfService: months,
            basicSalary: employee.basicSalary,
            dailyBasic: Math.round(dailyBasic * 100) / 100,
            gratuityAmount: Math.round(gratuity * 100) / 100,
            breakdown,
        };
    },

    /**
     * End of Service calculation:
     * - Employer termination: full gratuity
     * - Resignation (< 3 years): no gratuity
     * - Resignation (3-5 years): 1/3 gratuity
     * - Resignation (> 5 years): 2/3 gratuity
     * - End of contract: full gratuity
     */
    calculateEndOfService: (employee: Employee, terminationType: TerminationType, endDate?: string): EndOfServiceCalculation => {
        const gratuity = HRPayroll.calculateGratuity(employee, endDate);
        const leaveBalance = HRPayroll.calculateLeaveBalance(employee);

        let adjustedGratuity = gratuity.gratuityAmount;

        if (terminationType === 'RESIGNATION') {
            if (gratuity.yearsOfService < 1) {
                adjustedGratuity = 0;
            } else if (gratuity.yearsOfService < 3) {
                adjustedGratuity = 0;
            } else if (gratuity.yearsOfService < 5) {
                adjustedGratuity = adjustedGratuity * (1 / 3);
            } else {
                adjustedGratuity = adjustedGratuity * (2 / 3);
            }
            adjustedGratuity = Math.round(adjustedGratuity * 100) / 100;
        }

        return {
            terminationType,
            gratuity: { ...gratuity, gratuityAmount: adjustedGratuity },
            leaveEncashment: leaveBalance.leaveEncashmentAmount,
            totalEOS: Math.round((adjustedGratuity + leaveBalance.leaveEncashmentAmount) * 100) / 100,
        };
    },

    /**
     * Monthly Payslip — calculates salary based on days worked, leave, incentives.
     * Inputs: month/year, days worked, various leave days, achieved amounts for incentives.
     */
    calculateMonthlyPayslip: (
        employee: Employee,
        params: {
            month: number;        // 1-12
            year: number;
            totalCalendarDays: number; // e.g. 30 or 31
            daysWorked: number;
            annualLeaveDays: number;
            sickLeaveDays: number;
            unpaidLeaveDays: number;
            absentDays: number;
            phDays: number;          // Public Holiday days (full pay)
            // Cumulative sick leave days taken this year (for pay tier calc)
            cumulativeSickDaysThisYear: number;
            // Incentive achieved amounts
            incomeProfitAchieved: number;
            packageSalesAchieved: number;
            referralCount: number;
            // Override incentive block
            incentivesBlocked: boolean; // true if review threshold penalty is active
            // Working hours & overtime
            expectedHours: number;       // expected working hours this month
            actualHours: number;         // actual hours worked
            previousOvertimeHours: number; // carry-forward OT/UT from previous months (can be negative)
            overtimeCompensation: OvertimeCompensation; // 'PAID' or 'TIME_BACK'
            // Salary deductions — advance/loan, penalties, damages
            salaryAdvanceDeduction: number;   // loan/advance installment this month
            advanceTotalAmount: number;       // total loan/advance (info only)
            advanceRemainingBalance: number;  // remaining after this deduction (info only)
            penaltyDeduction: number;         // disciplinary penalty (capped at 5 days' wages)
            penaltyReason: string;            // description of penalty
            damagesDeduction: number;         // damages / property loss deduction
            damagesReason: string;            // description of damages
        }
    ): MonthlyPayslip => {
        const p = params;
        const dailyGross = (employee.basicSalary + employee.housingAllowance +
            employee.transportAllowance + (employee.workAllowance || 0) +
            (employee.trainingAllowance || 0) + employee.otherAllowances) / 30;

        // --- EARNINGS ---
        const workDaysSalary = round(dailyGross * p.daysWorked);
        const annualLeavePay = round(dailyGross * p.annualLeaveDays); // full pay
        const phDaysPay = round(dailyGross * p.phDays); // full pay for public holidays

        // Sick leave pay tiers (based on cumulative days this year)
        let sickPay = 0;
        const priorSick = p.cumulativeSickDaysThisYear - p.sickLeaveDays; // days before this month
        for (let i = 0; i < p.sickLeaveDays; i++) {
            const dayIdx = priorSick + i + 1;
            if (dayIdx <= 15) sickPay += dailyGross;          // full pay
            else if (dayIdx <= 45) sickPay += dailyGross / 2; // half pay
            // else unpaid (0)
        }
        sickPay = round(sickPay);

        // Work & training allowances (full month)
        const workAllowance = employee.workAllowance || 0;
        const trainingAllowance = employee.trainingAllowance || 0;

        // --- INCENTIVES ---
        let incomeProfitIncentive = 0;
        let packageSalesIncentive = 0;
        let referralIncentive = 0;

        if (!p.incentivesBlocked) {
            // Income/Profit incentive
            if (employee.incentiveSlabs && p.incomeProfitAchieved > 0) {
                const sorted = [...employee.incentiveSlabs].sort((a, b) => b.targetAmount - a.targetAmount);
                for (const slab of sorted) {
                    if (p.incomeProfitAchieved >= slab.targetAmount) {
                        incomeProfitIncentive = round(p.incomeProfitAchieved * slab.percentage / 100);
                        break;
                    }
                }
            }
            // Package sales incentive
            if (employee.packageSalesIncentiveSlabs && p.packageSalesAchieved > 0) {
                const sorted = [...employee.packageSalesIncentiveSlabs].sort((a, b) => b.targetAmount - a.targetAmount);
                for (const slab of sorted) {
                    if (p.packageSalesAchieved >= slab.targetAmount) {
                        packageSalesIncentive = round(p.packageSalesAchieved * slab.percentage / 100);
                        break;
                    }
                }
            }
            // Referral incentive (target = # of referrals, % applied on basic)
            if (employee.referralIncentiveSlabs && p.referralCount > 0) {
                const sorted = [...employee.referralIncentiveSlabs].sort((a, b) => b.targetAmount - a.targetAmount);
                for (const slab of sorted) {
                    if (p.referralCount >= slab.targetAmount) {
                        referralIncentive = round(employee.basicSalary * slab.percentage / 100);
                        break;
                    }
                }
            }
        }

        const totalIncentives = incomeProfitIncentive + packageSalesIncentive + referralIncentive;

        // --- HOURS & OVERTIME ---
        const overtimeHours = round(p.actualHours - p.expectedHours); // +ve = OT, -ve = UT
        const netOvertimeHours = round(overtimeHours + p.previousOvertimeHours);
        // Hourly rate based on gross (gross / 30 days / 8 hours)
        const hourlyRate = round(dailyGross / 8);
        // UAE standard OT = 1.25× hourly rate; only paid if net OT > 0 and mode is PAID
        let overtimeAmount = 0;
        if (p.overtimeCompensation === 'PAID' && netOvertimeHours > 0) {
            overtimeAmount = round(hourlyRate * 1.25 * netOvertimeHours);
        }

        // --- DEDUCTIONS ---
        const unpaidDeduction = round(dailyGross * p.unpaidLeaveDays);
        const absentDeduction = round(dailyGross * p.absentDays);

        // UAE Labor Law: penalty deductions ≤ 5 days' wages per month
        const fiveDaysWages = round(dailyGross * 5);
        const rawPenalty = Math.max(0, p.penaltyDeduction);
        const penaltyDeduction = round(Math.min(rawPenalty, fiveDaysWages));
        const penaltyCapped = rawPenalty > fiveDaysWages;

        const salaryAdvanceDeduction = round(Math.max(0, p.salaryAdvanceDeduction));
        const damagesDeduction = round(Math.max(0, p.damagesDeduction));

        // Sum all deductions before cap
        const rawTotalDeductions = unpaidDeduction + absentDeduction + penaltyDeduction + salaryAdvanceDeduction + damagesDeduction;

        // --- TOTALS ---
        const totalEarnings = workDaysSalary + annualLeavePay + phDaysPay + sickPay + workAllowance + trainingAllowance + totalIncentives + overtimeAmount;

        // UAE Labor Law: total deductions ≤ 50% of monthly wage
        const maxDeduction = round(totalEarnings * 0.5);
        const totalDeductions = round(Math.min(rawTotalDeductions, maxDeduction));
        const deductionsCapped = rawTotalDeductions > maxDeduction;

        const netSalary = round(totalEarnings - totalDeductions);

        // Build warnings array
        const deductionWarnings: string[] = [];
        if (penaltyCapped) deductionWarnings.push(`Penalty reduced from AED ${rawPenalty.toLocaleString()} to AED ${penaltyDeduction.toLocaleString()} (max 5 days' wages).`);
        if (deductionsCapped) deductionWarnings.push(`Total deductions reduced from AED ${rawTotalDeductions.toLocaleString()} to AED ${totalDeductions.toLocaleString()} (max 50% of earnings).`);

        return {
            month: p.month,
            year: p.year,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            employeeNumber: employee.employeeNumber || '',
            designation: employee.designation,
            department: employee.department,
            // Days
            totalCalendarDays: p.totalCalendarDays,
            daysWorked: p.daysWorked,
            annualLeaveDays: p.annualLeaveDays,
            sickLeaveDays: p.sickLeaveDays,
            unpaidLeaveDays: p.unpaidLeaveDays,
            absentDays: p.absentDays,
            phDays: p.phDays,
            // Earnings
            basicSalary: employee.basicSalary,
            housingAllowance: employee.housingAllowance,
            transportAllowance: employee.transportAllowance,
            workAllowance,
            trainingAllowance,
            otherAllowances: employee.otherAllowances,
            workDaysSalary,
            annualLeavePay,
            sickLeavePay: sickPay,
            phDaysPay,
            // Incentives
            incomeProfitIncentive,
            packageSalesIncentive,
            referralIncentive,
            totalIncentives,
            incentivesBlocked: p.incentivesBlocked,
            // Deductions
            unpaidDeduction,
            absentDeduction,
            salaryAdvanceDeduction,
            advanceTotalAmount: p.advanceTotalAmount,
            advanceRemainingBalance: p.advanceRemainingBalance,
            penaltyDeduction,
            penaltyReason: p.penaltyReason,
            penaltyCapped,
            damagesDeduction,
            damagesReason: p.damagesReason,
            totalDeductions,
            deductionsCapped,
            deductionWarnings,
            // Hours & Overtime
            expectedHours: p.expectedHours,
            actualHours: p.actualHours,
            overtimeHours,
            previousOvertimeHours: p.previousOvertimeHours,
            netOvertimeHours,
            overtimeCompensation: p.overtimeCompensation,
            overtimeAmount,
            hourlyRate,
            // Net
            totalEarnings,
            netSalary,
            dailyRate: round(dailyGross),
        };
    },
};

function round(n: number): number {
    return Math.round(n * 100) / 100;
}

export interface MonthlyPayslip {
    month: number;
    year: number;
    employeeName: string;
    employeeNumber: string;
    designation: string;
    department: string;
    totalCalendarDays: number;
    daysWorked: number;
    annualLeaveDays: number;
    sickLeaveDays: number;
    unpaidLeaveDays: number;
    absentDays: number;
    phDays: number;
    basicSalary: number;
    housingAllowance: number;
    transportAllowance: number;
    workAllowance: number;
    trainingAllowance: number;
    otherAllowances: number;
    workDaysSalary: number;
    annualLeavePay: number;
    sickLeavePay: number;
    phDaysPay: number;
    incomeProfitIncentive: number;
    packageSalesIncentive: number;
    referralIncentive: number;
    totalIncentives: number;
    incentivesBlocked: boolean;
    unpaidDeduction: number;
    absentDeduction: number;
    salaryAdvanceDeduction: number;
    advanceTotalAmount: number;
    advanceRemainingBalance: number;
    penaltyDeduction: number;
    penaltyReason: string;
    penaltyCapped: boolean;
    damagesDeduction: number;
    damagesReason: string;
    totalDeductions: number;
    deductionsCapped: boolean;
    deductionWarnings: string[];
    expectedHours: number;
    actualHours: number;
    overtimeHours: number;
    previousOvertimeHours: number;
    netOvertimeHours: number;
    overtimeCompensation: OvertimeCompensation;
    overtimeAmount: number;
    hourlyRate: number;
    totalEarnings: number;
    netSalary: number;
    dailyRate: number;
}

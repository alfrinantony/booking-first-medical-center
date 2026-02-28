'use client';

import React, { useState } from 'react';
import { Calculator, Printer, Clock, AlertTriangle } from 'lucide-react';
import type { Employee } from '@/lib/hr-store';
import { HRPayroll } from '@/lib/hr-payroll-store';
import type { MonthlyPayslip, OvertimeCompensation } from '@/lib/hr-payroll-store';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

function daysInMonth(m: number, y: number) {
    return new Date(y, m, 0).getDate();
}

export default function PayslipGenerator({ employee }: { employee: Employee }) {
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [daysWorked, setDaysWorked] = useState(22);
    const [annualLeave, setAnnualLeave] = useState(0);
    const [sickLeave, setSickLeave] = useState(0);
    const [unpaidLeave, setUnpaidLeave] = useState(0);
    const [absentDays, setAbsentDays] = useState(0);
    const [phDays, setPhDays] = useState(0);
    const [cumSick, setCumSick] = useState(employee.sickLeavesTaken || 0);
    const [incomeProfitAch, setIncomeProfitAch] = useState(0);
    const [pkgSalesAch, setPkgSalesAch] = useState(0);
    const [referralCount, setReferralCount] = useState(0);
    const [blocked, setBlocked] = useState(false);
    // Hours & Overtime
    const [expectedHours, setExpectedHours] = useState(240);
    const [actualHours, setActualHours] = useState(240);
    const [previousOT, setPreviousOT] = useState(0);
    const [otCompensation, setOtCompensation] = useState<OvertimeCompensation>('PAID');
    // Deductions — advance/loan, penalty, damages
    const [advanceDeduction, setAdvanceDeduction] = useState(0);
    const [advanceTotal, setAdvanceTotal] = useState(0);
    const [advanceRemaining, setAdvanceRemaining] = useState(0);
    const [penaltyAmount, setPenaltyAmount] = useState(0);
    const [penaltyReason, setPenaltyReason] = useState('');
    const [damagesAmount, setDamagesAmount] = useState(0);
    const [damagesReason, setDamagesReason] = useState('');

    const [payslip, setPayslip] = useState<MonthlyPayslip | null>(null);

    const generate = () => {
        const calDays = daysInMonth(month, year);
        const ps = HRPayroll.calculateMonthlyPayslip(employee, {
            month, year,
            totalCalendarDays: calDays,
            daysWorked, annualLeaveDays: annualLeave,
            sickLeaveDays: sickLeave, unpaidLeaveDays: unpaidLeave,
            absentDays, phDays,
            cumulativeSickDaysThisYear: cumSick,
            incomeProfitAchieved: incomeProfitAch,
            packageSalesAchieved: pkgSalesAch,
            referralCount, incentivesBlocked: blocked,
            expectedHours, actualHours,
            previousOvertimeHours: previousOT,
            overtimeCompensation: otCompensation,
            salaryAdvanceDeduction: advanceDeduction,
            advanceTotalAmount: advanceTotal,
            advanceRemainingBalance: advanceRemaining,
            penaltyDeduction: penaltyAmount,
            penaltyReason,
            damagesDeduction: damagesAmount,
            damagesReason,
        });
        setPayslip(ps);
    };

    const printPayslip = () => {
        const el = document.getElementById('payslip-print');
        if (!el) return;
        const w = window.open('', '_blank');
        if (!w) return;
        w.document.write(`<html><head><title>Payslip - ${employee.firstName} ${employee.lastName}</title>
        <style>
            body { font-family: 'Segoe UI', sans-serif; margin: 30px; color: #222; }
            h2 { margin: 0 0 4px; } h4 { margin: 10px 0 6px; color: #444; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
            th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; font-size: 13px; }
            th { background: #f5f5f5; } .right { text-align: right; }
            .total-row { font-weight: bold; background: #eef2ff; }
            .net-row { font-weight: bold; background: #dcfce7; font-size: 15px; }
            .header { border-bottom: 2px solid #4f46e5; padding-bottom: 10px; margin-bottom: 16px; }
            .warn { background: #fef3c7; border: 1px solid #f59e0b; padding: 6px 10px; margin: 8px 0; border-radius: 4px; font-size: 12px; color: #92400e; }
            @media print { body { margin: 15px; } }
        </style></head><body>${el.innerHTML}</body></html>`);
        w.document.close();
        w.print();
    };

    const inp = "w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm";

    return (
        <div className="space-y-6">
            {/* Input Form */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-indigo-600" /> Generate Monthly Payslip
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Month</label>
                        <select className={inp} value={month} onChange={e => setMonth(Number(e.target.value))}>
                            {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
                        <input type="number" className={inp} value={year} onChange={e => setYear(Number(e.target.value))} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Days Worked</label>
                        <input type="number" min="0" max="31" className={inp} value={daysWorked} onChange={e => setDaysWorked(Number(e.target.value))} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Calendar Days</label>
                        <input readOnly className={`${inp} bg-gray-100 dark:bg-gray-600`} value={daysInMonth(month, year)} />
                    </div>
                </div>

                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Leave Days This Month</p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Annual Leave</label>
                        <input type="number" min="0" className={inp} value={annualLeave} onChange={e => setAnnualLeave(Number(e.target.value))} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Sick Leave</label>
                        <input type="number" min="0" className={inp} value={sickLeave} onChange={e => setSickLeave(Number(e.target.value))} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Unpaid Leave</label>
                        <input type="number" min="0" className={inp} value={unpaidLeave} onChange={e => setUnpaidLeave(Number(e.target.value))} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Absent Days</label>
                        <input type="number" min="0" className={inp} value={absentDays} onChange={e => setAbsentDays(Number(e.target.value))} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">PH Days</label>
                        <input type="number" min="0" className={inp} value={phDays} onChange={e => setPhDays(Number(e.target.value))} />
                    </div>
                </div>

                <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Cumulative Sick Days (YTD)</label>
                    <input type="number" min="0" className={`${inp} w-32`} value={cumSick} onChange={e => setCumSick(Number(e.target.value))} />
                    <p className="text-xs text-gray-400 mt-1">Used for sick pay tier calculation: 1-15 full, 16-45 half, 46-90 unpaid</p>
                </div>

                {/* Working Hours & Overtime */}
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> Working Hours &amp; Overtime
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Expected Hours</label>
                        <input type="number" min="0" step="0.5" className={inp} value={expectedHours} onChange={e => setExpectedHours(Number(e.target.value))} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Actual Hours Worked</label>
                        <input type="number" min="0" step="0.5" className={inp} value={actualHours} onChange={e => setActualHours(Number(e.target.value))} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Prev. Month OT/UT (hrs)</label>
                        <input type="number" step="0.5" className={inp} value={previousOT} onChange={e => setPreviousOT(Number(e.target.value))} />
                        <p className="text-xs text-gray-400 mt-1">Negative = undertime carried</p>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">OT Compensation</label>
                        <select className={inp} value={otCompensation} onChange={e => setOtCompensation(e.target.value as OvertimeCompensation)}>
                            <option value="PAID">💰 Pay Overtime</option>
                            <option value="TIME_BACK">🔄 Time Back (within 3 weeks)</option>
                        </select>
                    </div>
                </div>

                {/* Salary Deductions */}
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Salary Deductions — Advance / Penalty / Damages
                </p>
                <div className="bg-red-50/50 dark:bg-red-900/5 border border-red-100 dark:border-red-900/20 rounded-lg p-4 mb-4">
                    {/* Salary Advance / Loan */}
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">💳 Salary Advance / Loan Installment</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">This Month Installment (AED)</label>
                            <input type="number" min="0" className={inp} value={advanceDeduction} onChange={e => setAdvanceDeduction(Number(e.target.value))} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Total Loan/Advance (AED)</label>
                            <input type="number" min="0" className={inp} value={advanceTotal} onChange={e => setAdvanceTotal(Number(e.target.value))} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Remaining Balance (AED)</label>
                            <input type="number" min="0" className={inp} value={advanceRemaining} onChange={e => setAdvanceRemaining(Number(e.target.value))} />
                        </div>
                    </div>

                    {/* Penalty */}
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">⚖️ Disciplinary Penalty</p>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Penalty Amount (AED)</label>
                            <input type="number" min="0" className={inp} value={penaltyAmount} onChange={e => setPenaltyAmount(Number(e.target.value))} />
                            <p className="text-xs text-amber-600 mt-1">⚠ Max 5 days&apos; wages per month (UAE Labor Law)</p>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Reason</label>
                            <input type="text" className={inp} placeholder="e.g. Lateness, rule breach..." value={penaltyReason} onChange={e => setPenaltyReason(e.target.value)} />
                        </div>
                    </div>

                    {/* Damages */}
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">🔧 Damages / Property Loss</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Damages Amount (AED)</label>
                            <input type="number" min="0" className={inp} value={damagesAmount} onChange={e => setDamagesAmount(Number(e.target.value))} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Reason</label>
                            <input type="text" className={inp} placeholder="e.g. Equipment damage..." value={damagesReason} onChange={e => setDamagesReason(e.target.value)} />
                        </div>
                    </div>

                    <p className="text-xs text-gray-400 mt-3 border-t border-red-100 dark:border-red-900/20 pt-2">
                        📋 UAE Labor Law: Total deductions (incl. loans &amp; damages) cannot exceed 50% of monthly wages.
                    </p>
                </div>

                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Incentives Achieved</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                            {employee.incentiveBasis || 'Income/Profit'} Achieved (AED)
                        </label>
                        <input type="number" min="0" className={inp} value={incomeProfitAch} onChange={e => setIncomeProfitAch(Number(e.target.value))} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Package Sales (AED)</label>
                        <input type="number" min="0" className={inp} value={pkgSalesAch} onChange={e => setPkgSalesAch(Number(e.target.value))} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Referral Count</label>
                        <input type="number" min="0" className={inp} value={referralCount} onChange={e => setReferralCount(Number(e.target.value))} />
                    </div>
                    <div className="flex items-end">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={blocked} onChange={e => setBlocked(e.target.checked)} />
                            <span className="text-red-600 font-medium">Incentives Blocked (review penalty)</span>
                        </label>
                    </div>
                </div>

                <button onClick={generate}
                    className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 text-sm font-semibold flex items-center gap-2">
                    <Calculator className="w-4 h-4" /> Generate Payslip
                </button>
            </div>

            {/* Payslip Output */}
            {payslip && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                            📄 Payslip — {MONTH_NAMES[payslip.month - 1]} {payslip.year}
                        </h3>
                        <button onClick={printPayslip}
                            className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-200 text-sm font-medium flex items-center gap-2">
                            <Printer className="w-4 h-4" /> Print
                        </button>
                    </div>

                    <div id="payslip-print">
                        <div className="header mb-4 border-b-2 border-indigo-600 pb-3">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Booking First Medical Center</h2>
                            <p className="text-sm text-gray-500">Payslip for {MONTH_NAMES[payslip.month - 1]} {payslip.year}</p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-sm">
                            <div><span className="text-gray-500">Name:</span> <strong>{payslip.employeeName}</strong></div>
                            <div><span className="text-gray-500">Emp #:</span> <strong>{payslip.employeeNumber || '-'}</strong></div>
                            <div><span className="text-gray-500">Designation:</span> <strong>{payslip.designation}</strong></div>
                            <div><span className="text-gray-500">Department:</span> <strong>{payslip.department}</strong></div>
                        </div>

                        {/* Days Summary */}
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Days Summary</h4>
                        <table className="w-full text-sm mb-4 border-collapse">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th className="text-left p-2 text-xs border">Calendar Days</th>
                                    <th className="text-left p-2 text-xs border">Days Worked</th>
                                    <th className="text-left p-2 text-xs border">Annual Leave</th>
                                    <th className="text-left p-2 text-xs border">Sick Leave</th>
                                    <th className="text-left p-2 text-xs border">Unpaid Leave</th>
                                    <th className="text-left p-2 text-xs border">Absent</th>
                                    <th className="text-left p-2 text-xs border">PH Days</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="p-2 border font-medium">{payslip.totalCalendarDays}</td>
                                    <td className="p-2 border font-medium text-green-700">{payslip.daysWorked}</td>
                                    <td className="p-2 border">{payslip.annualLeaveDays}</td>
                                    <td className="p-2 border">{payslip.sickLeaveDays}</td>
                                    <td className="p-2 border">{payslip.unpaidLeaveDays}</td>
                                    <td className="p-2 border text-red-600">{payslip.absentDays}</td>
                                    <td className="p-2 border text-blue-600 font-medium">{payslip.phDays}</td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Hours & Overtime Summary */}
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> Hours &amp; Overtime Summary
                        </h4>
                        <table className="w-full text-sm mb-4 border-collapse">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th className="text-left p-2 text-xs border">Expected Hours</th>
                                    <th className="text-left p-2 text-xs border">Actual Hours</th>
                                    <th className="text-left p-2 text-xs border">This Month OT/UT</th>
                                    <th className="text-left p-2 text-xs border">Prev. Balance</th>
                                    <th className="text-left p-2 text-xs border">Net OT/UT</th>
                                    <th className="text-left p-2 text-xs border">Compensation</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="p-2 border">{payslip.expectedHours}</td>
                                    <td className="p-2 border font-medium">{payslip.actualHours}</td>
                                    <td className={`p-2 border font-medium ${payslip.overtimeHours >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                        {payslip.overtimeHours > 0 ? '+' : ''}{payslip.overtimeHours} hrs
                                    </td>
                                    <td className={`p-2 border ${payslip.previousOvertimeHours >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                        {payslip.previousOvertimeHours > 0 ? '+' : ''}{payslip.previousOvertimeHours} hrs
                                    </td>
                                    <td className={`p-2 border font-bold ${payslip.netOvertimeHours >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                        {payslip.netOvertimeHours > 0 ? '+' : ''}{payslip.netOvertimeHours} hrs
                                    </td>
                                    <td className="p-2 border">
                                        {payslip.overtimeCompensation === 'PAID' ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30">
                                                💰 Paid
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30">
                                                🔄 Time Back
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        {payslip.overtimeCompensation === 'TIME_BACK' && payslip.netOvertimeHours > 0 && (
                            <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-300">
                                ℹ️ <strong>{payslip.netOvertimeHours} hours</strong> of overtime to be compensated as time back within 3 weeks.
                            </div>
                        )}

                        {/* Earnings & Deductions */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                            {/* Earnings */}
                            <div>
                                <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Earnings</h4>
                                <table className="w-full text-sm border-collapse">
                                    <tbody>
                                        <tr className="border-b"><td className="p-2">Work Days Salary ({payslip.daysWorked} days × AED {payslip.dailyRate})</td><td className="p-2 right text-right font-medium">{payslip.workDaysSalary.toLocaleString()}</td></tr>
                                        {payslip.annualLeaveDays > 0 && <tr className="border-b"><td className="p-2">Annual Leave Pay ({payslip.annualLeaveDays} days)</td><td className="p-2 text-right font-medium">{payslip.annualLeavePay.toLocaleString()}</td></tr>}
                                        {payslip.phDays > 0 && <tr className="border-b"><td className="p-2">🏖️ PH Days Pay ({payslip.phDays} days)</td><td className="p-2 text-right font-medium">{payslip.phDaysPay.toLocaleString()}</td></tr>}
                                        {payslip.sickLeaveDays > 0 && <tr className="border-b"><td className="p-2">Sick Leave Pay ({payslip.sickLeaveDays} days)</td><td className="p-2 text-right font-medium">{payslip.sickLeavePay.toLocaleString()}</td></tr>}
                                        {payslip.workAllowance > 0 && <tr className="border-b"><td className="p-2">Work Allowance</td><td className="p-2 text-right font-medium">{payslip.workAllowance.toLocaleString()}</td></tr>}
                                        {payslip.trainingAllowance > 0 && <tr className="border-b"><td className="p-2">Training Allowance</td><td className="p-2 text-right font-medium">{payslip.trainingAllowance.toLocaleString()}</td></tr>}
                                        {payslip.overtimeAmount > 0 && <tr className="border-b bg-amber-50 dark:bg-amber-900/10"><td className="p-2">⏰ Overtime Pay ({payslip.netOvertimeHours} hrs × AED {payslip.hourlyRate} × 1.25)</td><td className="p-2 text-right font-medium text-amber-700">{payslip.overtimeAmount.toLocaleString()}</td></tr>}
                                        {payslip.incomeProfitIncentive > 0 && <tr className="border-b bg-green-50 dark:bg-green-900/10"><td className="p-2">📈 Income/Profit Incentive</td><td className="p-2 text-right font-medium text-green-700">{payslip.incomeProfitIncentive.toLocaleString()}</td></tr>}
                                        {payslip.packageSalesIncentive > 0 && <tr className="border-b bg-green-50 dark:bg-green-900/10"><td className="p-2">📦 Package Sales Incentive</td><td className="p-2 text-right font-medium text-green-700">{payslip.packageSalesIncentive.toLocaleString()}</td></tr>}
                                        {payslip.referralIncentive > 0 && <tr className="border-b bg-green-50 dark:bg-green-900/10"><td className="p-2">🤝 Referral Incentive</td><td className="p-2 text-right font-medium text-green-700">{payslip.referralIncentive.toLocaleString()}</td></tr>}
                                        <tr className="bg-indigo-50 dark:bg-indigo-900/20 font-bold"><td className="p-2">Total Earnings</td><td className="p-2 text-right text-indigo-700">{payslip.totalEarnings.toLocaleString()}</td></tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Deductions */}
                            <div>
                                <h4 className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">Deductions</h4>
                                <table className="w-full text-sm border-collapse">
                                    <tbody>
                                        {payslip.unpaidDeduction > 0 && <tr className="border-b"><td className="p-2">Unpaid Leave ({payslip.unpaidLeaveDays} days)</td><td className="p-2 text-right font-medium text-red-600">{payslip.unpaidDeduction.toLocaleString()}</td></tr>}
                                        {payslip.absentDeduction > 0 && <tr className="border-b"><td className="p-2">Absent Days ({payslip.absentDays} days)</td><td className="p-2 text-right font-medium text-red-600">{payslip.absentDeduction.toLocaleString()}</td></tr>}
                                        {payslip.salaryAdvanceDeduction > 0 && (
                                            <tr className="border-b bg-orange-50 dark:bg-orange-900/10">
                                                <td className="p-2">
                                                    💳 Salary Advance / Loan Installment
                                                    {payslip.advanceTotalAmount > 0 && (
                                                        <span className="block text-xs text-gray-400">
                                                            Total: AED {payslip.advanceTotalAmount.toLocaleString()} · Remaining: AED {payslip.advanceRemainingBalance.toLocaleString()}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-2 text-right font-medium text-red-600">{payslip.salaryAdvanceDeduction.toLocaleString()}</td>
                                            </tr>
                                        )}
                                        {payslip.penaltyDeduction > 0 && (
                                            <tr className="border-b bg-amber-50 dark:bg-amber-900/10">
                                                <td className="p-2">
                                                    ⚖️ Disciplinary Penalty
                                                    {payslip.penaltyReason && <span className="block text-xs text-gray-400">{payslip.penaltyReason}</span>}
                                                    {payslip.penaltyCapped && <span className="block text-xs text-amber-600 font-medium">⚠ Capped at 5 days&apos; wages</span>}
                                                </td>
                                                <td className="p-2 text-right font-medium text-red-600">{payslip.penaltyDeduction.toLocaleString()}</td>
                                            </tr>
                                        )}
                                        {payslip.damagesDeduction > 0 && (
                                            <tr className="border-b bg-amber-50 dark:bg-amber-900/10">
                                                <td className="p-2">
                                                    🔧 Damages / Property Loss
                                                    {payslip.damagesReason && <span className="block text-xs text-gray-400">{payslip.damagesReason}</span>}
                                                </td>
                                                <td className="p-2 text-right font-medium text-red-600">{payslip.damagesDeduction.toLocaleString()}</td>
                                            </tr>
                                        )}
                                        {payslip.totalDeductions === 0 && <tr className="border-b"><td className="p-2 text-gray-400" colSpan={2}>No deductions</td></tr>}
                                        <tr className="bg-red-50 dark:bg-red-900/20 font-bold"><td className="p-2">Total Deductions</td><td className="p-2 text-right text-red-700">{payslip.totalDeductions.toLocaleString()}</td></tr>
                                    </tbody>
                                </table>

                                {/* Deduction Warnings */}
                                {payslip.deductionWarnings.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                        {payslip.deductionWarnings.map((w, i) => (
                                            <div key={i} className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg p-2.5 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                                                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                                <span>{w}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {payslip.incentivesBlocked && (
                                    <div className="mt-3 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded p-2 text-xs text-red-600">
                                        ⚠️ Incentives blocked — client review threshold not met
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Net Salary */}
                        <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700 rounded-xl p-4 text-center">
                            <p className="text-xs text-green-600 uppercase font-semibold mb-1">Net Salary Payable</p>
                            <p className="text-3xl font-bold text-green-700">AED {payslip.netSalary.toLocaleString()}</p>
                            <p className="text-xs text-green-500 mt-1">
                                Earnings AED {payslip.totalEarnings.toLocaleString()} − Deductions AED {payslip.totalDeductions.toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

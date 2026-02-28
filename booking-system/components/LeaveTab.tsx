'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CalendarDays, Clock, Trash2, AlertTriangle } from 'lucide-react';
import { LEAVE_TYPES, UAE_LEAVE_RULES } from '@/lib/hr-leave-store';
import type { Employee } from '@/lib/hr-store';
import type { LeaveRequest, LeavePlanning, LeaveType, LeaveStatus } from '@/lib/hr-leave-store';

export default function LeaveTab({ employeeId, employee }: { employeeId: string; employee: Employee | null }) {
    const [leaveData, setLeaveData] = useState<{ requests: LeaveRequest[]; plannings: LeavePlanning[]; balance: any; rules: any } | null>(null);
    const [showRequestForm, setShowRequestForm] = useState(false);
    const [showPlanForm, setShowPlanForm] = useState(false);
    const [loadingLeave, setLoadingLeave] = useState(true);

    // Request form
    const [reqType, setReqType] = useState<LeaveType>('Annual Leave');
    const [reqStart, setReqStart] = useState('');
    const [reqEnd, setReqEnd] = useState('');
    const [reqReason, setReqReason] = useState('');

    // Planning form
    const [planType, setPlanType] = useState<LeaveType>('Annual Leave');
    const [planStart, setPlanStart] = useState('');
    const [planEnd, setPlanEnd] = useState('');
    const [planNotes, setPlanNotes] = useState('');

    const loadLeave = useCallback(async () => {
        setLoadingLeave(true);
        try {
            const res = await fetch(`/api/admin/hr/leave?employeeId=${employeeId}`);
            if (res.ok) setLeaveData(await res.json());
        } catch { /* ignore */ }
        setLoadingLeave(false);
    }, [employeeId]);

    useEffect(() => { loadLeave(); }, [loadLeave]);

    const calcDays = (s: string, e: string) => {
        if (!s || !e) return 0;
        const diff = (new Date(e).getTime() - new Date(s).getTime()) / (1000 * 60 * 60 * 24);
        return Math.max(0, Math.ceil(diff) + 1);
    };

    const submitRequest = async () => {
        const days = calcDays(reqStart, reqEnd);
        if (!reqStart || !reqEnd || days <= 0) return;
        await fetch('/api/admin/hr/leave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'createRequest', employeeId, leaveType: reqType, startDate: reqStart, endDate: reqEnd, totalDays: days, reason: reqReason }),
        });
        setReqStart(''); setReqEnd(''); setReqReason(''); setShowRequestForm(false);
        loadLeave();
    };

    const updateStatus = async (id: string, status: LeaveStatus) => {
        await fetch('/api/admin/hr/leave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'updateStatus', id, status, approvedBy: 'Admin' }),
        });
        loadLeave();
    };

    const submitPlan = async () => {
        const days = calcDays(planStart, planEnd);
        if (!planStart || !planEnd || days <= 0) return;
        await fetch('/api/admin/hr/leave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'createPlanning', employeeId, leaveType: planType, plannedStartDate: planStart, plannedEndDate: planEnd, plannedDays: days, notes: planNotes }),
        });
        setPlanStart(''); setPlanEnd(''); setPlanNotes(''); setShowPlanForm(false);
        loadLeave();
    };

    const deletePlan = async (id: string) => {
        await fetch('/api/admin/hr/leave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'deletePlanning', id }),
        });
        loadLeave();
    };

    if (loadingLeave) return <div className="text-center py-12 text-gray-500">Loading leave data...</div>;
    if (!leaveData) return <div className="text-center py-12 text-red-500">Failed to load leave data</div>;

    const b = leaveData.balance;
    const annualEntitlement = employee?.annualLeaveEntitlement || 30;

    const statusColors: Record<string, string> = {
        PENDING: 'bg-yellow-100 text-yellow-800',
        APPROVED: 'bg-green-100 text-green-800',
        REJECTED: 'bg-red-100 text-red-800',
        CANCELLED: 'bg-gray-100 text-gray-600',
    };

    return (
        <div className="space-y-6">
            {/* UAE Labor Law Info Banner */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <h3 className="font-semibold text-blue-800 dark:text-blue-300 text-sm mb-2">🇦🇪 UAE Labor Law — Leave Entitlements</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-blue-700 dark:text-blue-400">
                    <div><strong>Annual:</strong> {annualEntitlement} days/year</div>
                    <div><strong>Sick:</strong> 90 days (15 full + 30 half + 45 unpaid)</div>
                    <div><strong>Maternity:</strong> 60 days (45 full + 15 half pay)</div>
                    <div><strong>Paternity/Parental:</strong> 5 paid days</div>
                </div>
            </div>

            {/* Absent Warning */}
            {b.absentWarning && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 rounded-xl p-4 flex items-center gap-3">
                    <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
                    <div>
                        <p className="font-semibold text-red-800 dark:text-red-300">⚠️ Absent Days Warning</p>
                        <p className="text-sm text-red-600 dark:text-red-400">This employee has {b.absentDays} absent days. UAE law allows termination without notice for 20+ non-consecutive or 7+ consecutive absent days per year.</p>
                    </div>
                </div>
            )}

            {/* Leave Balance Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
                    <p className="text-xs text-gray-500 mb-1">Annual Leave</p>
                    <p className="text-2xl font-bold text-indigo-600">{annualEntitlement - b.annualUsed}</p>
                    <p className="text-xs text-gray-400">{b.annualUsed} of {annualEntitlement} used</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
                    <p className="text-xs text-gray-500 mb-1">Sick Leave</p>
                    <p className="text-2xl font-bold text-amber-600">{b.sickUsed}</p>
                    <p className="text-xs text-gray-400">of 90 days used</p>
                    {b.sickUsed > 0 && (
                        <p className="text-xs text-amber-500 mt-1">{b.sickFullPay}d full + {b.sickHalfPay}d half + {b.sickUnpaid}d unpaid</p>
                    )}
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
                    <p className="text-xs text-gray-500 mb-1">Emergency / Other</p>
                    <p className="text-2xl font-bold text-purple-600">{b.emergencyUsed + b.unpaidUsed}</p>
                    <p className="text-xs text-gray-400">{b.emergencyUsed} emerg + {b.unpaidUsed} unpaid</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
                    <p className="text-xs text-gray-500 mb-1">Pending Requests</p>
                    <p className="text-2xl font-bold text-yellow-600">{b.pending}</p>
                    <p className="text-xs text-gray-400">awaiting approval</p>
                </div>
            </div>

            {/* Leave Requests Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <CalendarDays className="w-5 h-5 text-indigo-600" /> Leave Requests
                    </h3>
                    <button onClick={() => setShowRequestForm(!showRequestForm)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium">
                        + New Request
                    </button>
                </div>

                {/* New Request Form */}
                {showRequestForm && (
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 mb-4 border border-indigo-200 dark:border-indigo-700">
                        <h4 className="font-medium text-sm text-indigo-800 dark:text-indigo-300 mb-3">Submit Leave Request</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Leave Type</label>
                                <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={reqType} onChange={e => setReqType(e.target.value as LeaveType)}>
                                    {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
                                <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={reqStart} onChange={e => setReqStart(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
                                <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={reqEnd} onChange={e => setReqEnd(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Days</label>
                                <input readOnly className="w-full p-2 border rounded-md bg-gray-100 dark:bg-gray-600 text-sm"
                                    value={calcDays(reqStart, reqEnd)} />
                            </div>
                        </div>
                        <div className="mt-3">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Reason</label>
                            <textarea rows={2} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                value={reqReason} onChange={e => setReqReason(e.target.value)} placeholder="Reason for leave..." />
                        </div>

                        {/* Type-specific info */}
                        {reqType === 'Maternity Leave' && (
                            <div className="mt-2 text-xs text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/20 p-2 rounded">
                                ℹ️ 60 calendar days: 45 days full pay + 15 days half pay
                            </div>
                        )}
                        {reqType === 'Paternity Leave' && (
                            <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                                ℹ️ 5 paid days, can be consecutive or non-consecutive within 6 months of birth
                            </div>
                        )}
                        {reqType === 'Parental Leave' && (
                            <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                                ℹ️ 5 paid days for both working mothers and fathers, within 6 months of child&apos;s birth
                            </div>
                        )}
                        {reqType === 'Sick Leave' && (
                            <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                                ℹ️ Max 90 days/year after probation: 15 days full pay → 30 days half pay → 45 days unpaid
                            </div>
                        )}
                        {reqType === 'Absent' && (
                            <div className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                                ⚠️ Employee can be terminated without notice for 20+ non-consecutive or 7+ consecutive absent days/year
                            </div>
                        )}

                        <div className="flex justify-end gap-2 mt-3">
                            <button onClick={() => setShowRequestForm(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                            <button onClick={submitRequest} className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium">Submit Request</button>
                        </div>
                    </div>
                )}

                {/* Requests List */}
                {leaveData.requests.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Type</th>
                                    <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Dates</th>
                                    <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Days</th>
                                    <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Reason</th>
                                    <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {leaveData.requests.map(lr => (
                                    <tr key={lr.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                                        <td className="p-3 font-medium">{lr.leaveType}</td>
                                        <td className="p-3 text-gray-500">{lr.startDate} → {lr.endDate}</td>
                                        <td className="p-3 text-center">{lr.totalDays}</td>
                                        <td className="p-3 text-gray-500 max-w-[200px] truncate">{lr.reason}</td>
                                        <td className="p-3 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[lr.status]}`}>
                                                {lr.status}
                                            </span>
                                        </td>
                                        <td className="p-3 text-center">
                                            {lr.status === 'PENDING' && (
                                                <div className="flex gap-1 justify-center">
                                                    <button onClick={() => updateStatus(lr.id, 'APPROVED')}
                                                        className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                                                        ✓ Approve
                                                    </button>
                                                    <button onClick={() => updateStatus(lr.id, 'REJECTED')}
                                                        className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700">
                                                        ✗ Reject
                                                    </button>
                                                </div>
                                            )}
                                            {lr.status !== 'PENDING' && (
                                                <span className="text-xs text-gray-400">{lr.approvedBy ? `by ${lr.approvedBy}` : '—'}</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-center text-gray-400 py-6">No leave requests yet</p>
                )}
            </div>

            {/* Leave Planning Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Clock className="w-5 h-5 text-purple-600" /> Leave Planning
                    </h3>
                    <button onClick={() => setShowPlanForm(!showPlanForm)}
                        className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm font-medium">
                        + Plan Leave
                    </button>
                </div>

                {showPlanForm && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 mb-4 border border-purple-200 dark:border-purple-700">
                        <h4 className="font-medium text-sm text-purple-800 dark:text-purple-300 mb-3">Plan Future Leave</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Leave Type</label>
                                <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={planType} onChange={e => setPlanType(e.target.value as LeaveType)}>
                                    {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
                                <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={planStart} onChange={e => setPlanStart(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
                                <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={planEnd} onChange={e => setPlanEnd(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Days</label>
                                <input readOnly className="w-full p-2 border rounded-md bg-gray-100 dark:bg-gray-600 text-sm"
                                    value={calcDays(planStart, planEnd)} />
                            </div>
                        </div>
                        <div className="mt-3">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                            <input className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                value={planNotes} onChange={e => setPlanNotes(e.target.value)} placeholder="Optional notes..." />
                        </div>
                        <div className="flex justify-end gap-2 mt-3">
                            <button onClick={() => setShowPlanForm(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                            <button onClick={submitPlan} className="px-4 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 font-medium">Save Plan</button>
                        </div>
                    </div>
                )}

                {leaveData.plannings.length > 0 ? (
                    <div className="space-y-3">
                        {leaveData.plannings.map(lp => (
                            <div key={lp.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                                <div>
                                    <span className="text-sm font-medium text-purple-700 dark:text-purple-400">{lp.leaveType}</span>
                                    <span className="text-sm text-gray-500 ml-2">{lp.plannedStartDate} → {lp.plannedEndDate}</span>
                                    <span className="text-sm text-gray-400 ml-2">({lp.plannedDays} days)</span>
                                    {lp.notes && <p className="text-xs text-gray-400 mt-1">{lp.notes}</p>}
                                </div>
                                <button onClick={() => deletePlan(lp.id)}
                                    className="text-red-500 hover:text-red-700 text-sm">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-gray-400 py-6">No planned leaves</p>
                )}
            </div>
        </div>
    );
}

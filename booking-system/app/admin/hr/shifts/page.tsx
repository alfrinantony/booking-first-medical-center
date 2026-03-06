'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, Clock, Users, Calendar, Building, RefreshCw,
    Plus, Filter, CheckCircle,
    Zap, Coffee, UserCheck, UserX, BarChart3, ArrowUpDown, Edit3
} from 'lucide-react';

// ── Types ──

interface ShiftTemplate {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    expectedHours: number;
    color: string;
}

interface ShiftAssignment {
    id: string;
    employeeId: string;
    employeeName: string;
    employeeCode: string;
    designation: string;
    date: string;
    shiftTemplateId: string;
    shiftName: string;
    branchId: string;
    branchName: string;
    startTime: string;
    endTime: string;
    expectedHours: number;
    breakMinutes: number;
    status: string;
    isClinicianAutoShift: boolean;
    appointmentCount?: number;
    notes?: string;
}

interface Summary {
    total: number;
    scheduled: number;
    checkedIn: number;
    completed: number;
    absent: number;
    offDuty: number;
    clinicianAuto: number;
}

interface Comparison {
    employeeId: string;
    employeeName: string;
    employeeCode: string;
    branchName: string;
    shiftName: string;
    scheduledStart: string;
    scheduledEnd: string;
    expectedHours: number;
    actualPunchIn: string | null;
    actualPunchOut: string | null;
    actualHours: number;
    varianceHours: number;
    status: string;
}

const BRANCHES = [
    { id: '', name: 'All Branches' },
    { id: 'clinic-1', name: 'Al Muraqabat Branch' },
    { id: 'clinic-2', name: 'Al Qiyadah Branch' },
    { id: 'clinic-3', name: 'Silicon Oasis Branch' },
];

export default function ShiftSchedulePage() {
    const [selectedDate, setSelectedDate] = useState('2026-03-05');
    const [branchFilter, setBranchFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [activeTab, setActiveTab] = useState<'schedule' | 'compare'>('schedule');

    const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
    const [comparisons, setComparisons] = useState<Comparison[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    // Assign modal
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assignForm, setAssignForm] = useState({
        employeeId: '', shiftTemplateId: '', branchId: 'clinic-1', date: '',
        startTime: '09:00', endTime: '18:00', breakMinutes: 60, useCustomTime: false,
    });
    const [employees, setEmployees] = useState<{ id: string; name: string; code: string }[]>([]);

    // Live preview
    const previewHours = (() => {
        const [sh, sm] = assignForm.startTime.split(':').map(Number);
        const [eh, em] = assignForm.endTime.split(':').map(Number);
        const totalMin = (eh * 60 + em) - (sh * 60 + sm);
        return Math.round(Math.max(0, totalMin - assignForm.breakMinutes) / 60 * 100) / 100;
    })();

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ date: selectedDate, summary: 'true' });
            if (branchFilter) params.set('branchId', branchFilter);

            const [shiftRes, tplRes] = await Promise.all([
                fetch(`/api/admin/hr/shifts?${params}`),
                fetch('/api/admin/hr/shifts/templates'),
            ]);

            const shiftData = await shiftRes.json();
            setAssignments(shiftData.assignments || shiftData);
            setSummary(shiftData.summary || null);

            const tplData = await tplRes.json();
            setTemplates(Array.isArray(tplData) ? tplData : []);

            const cmpRes = await fetch(`/api/admin/hr/shifts/compare?date=${selectedDate}`);
            const cmpData = await cmpRes.json();
            setComparisons(cmpData.comparisons || []);
        } catch (err) {
            console.error('Failed to load shift data', err);
        } finally {
            setLoading(false);
        }
    }, [selectedDate, branchFilter]);

    useEffect(() => { loadData(); }, [loadData]);

    useEffect(() => {
        fetch('/api/admin/hr/employees')
            .then(r => r.json())
            .then(data => {
                const emps = (Array.isArray(data) ? data : data.employees || []).map((e: { id: string; firstName: string; lastName: string; employeeCode: string }) => ({
                    id: e.id,
                    name: `${e.firstName} ${e.lastName}`,
                    code: e.employeeCode,
                }));
                setEmployees(emps);
            })
            .catch(() => { });
    }, []);

    const handleGenerateClinicianShifts = async () => {
        setGenerating(true);
        try {
            const res = await fetch('/api/admin/hr/shifts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'generate-clinician-shifts', date: selectedDate, branchId: branchFilter || undefined }),
            });
            const data = await res.json();
            alert(`Generated ${data.generated} clinician shift(s) from booked appointments.`);
            await loadData();
        } catch {
            alert('Failed to generate clinician shifts');
        } finally {
            setGenerating(false);
        }
    };

    const handleAssignShift = async () => {
        if (!assignForm.employeeId || !assignForm.branchId) return;
        if (!assignForm.useCustomTime && !assignForm.shiftTemplateId) return;
        try {
            const payload: Record<string, unknown> = {
                employeeId: assignForm.employeeId,
                date: assignForm.date || selectedDate,
                shiftTemplateId: assignForm.shiftTemplateId || '',
                branchId: assignForm.branchId,
            };
            if (assignForm.useCustomTime || assignForm.startTime || assignForm.endTime) {
                payload.startTime = assignForm.startTime;
                payload.endTime = assignForm.endTime;
                payload.breakMinutes = assignForm.breakMinutes;
            }
            await fetch('/api/admin/hr/shifts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            setShowAssignModal(false);
            await loadData();
        } catch {
            alert('Failed to assign shift');
        }
    };

    const handleTemplateChange = (templateId: string) => {
        const tpl = templates.find(t => t.id === templateId);
        setAssignForm(prev => ({
            ...prev,
            shiftTemplateId: templateId,
            startTime: tpl?.startTime || prev.startTime,
            endTime: tpl?.endTime || prev.endTime,
            breakMinutes: tpl?.breakMinutes ?? prev.breakMinutes,
        }));
    };

    const filteredAssignments = assignments.filter(a => {
        if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
        return true;
    });

    const statusBadge: Record<string, string> = {
        SCHEDULED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        CHECKED_IN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
        COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        ABSENT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        OFF_DUTY: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    };

    const compStatusBadge: Record<string, string> = {
        ON_TIME: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
        LATE_ARRIVAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        EARLY_LEAVE: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
        ABSENT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        OVERTIME: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
        NOT_SCHEDULED: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    };

    // Group assignments by branch for the sidebar
    const branchGroups = filteredAssignments.reduce<Record<string, ShiftAssignment[]>>((acc, a) => {
        const key = a.branchName || 'Unassigned';
        if (!acc[key]) acc[key] = [];
        acc[key].push(a);
        return acc;
    }, {});

    const displayDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
    });

    return (
        <div className="p-4 md:p-6 max-w-[1500px] mx-auto">

            {/* ═══ Top Bar: Title + Filters + Actions ═══ */}
            <div className="flex flex-wrap items-center gap-4 mb-5">
                <div className="flex items-center gap-3 mr-auto">
                    <Link href="/admin/hr/attendance" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Shift Schedule</h1>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{displayDate}</p>
                    </div>
                </div>

                {/* Inline Filters */}
                <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <select
                    value={branchFilter}
                    onChange={e => setBranchFilter(e.target.value)}
                    className="px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-xs outline-none"
                >
                    {BRANCHES.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-xs outline-none"
                >
                    <option value="ALL">All Statuses</option>
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="CHECKED_IN">Checked In</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="ABSENT">Absent</option>
                    <option value="OFF_DUTY">Off Duty</option>
                </select>

                <button onClick={loadData} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>

                {/* Actions */}
                <button
                    onClick={handleGenerateClinicianShifts}
                    disabled={generating}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors text-xs font-medium"
                >
                    <Zap className={`w-3.5 h-3.5 ${generating ? 'animate-pulse' : ''}`} />
                    {generating ? 'Generating...' : 'Auto-Generate'}
                </button>
                <button
                    onClick={() => { setAssignForm({ ...assignForm, date: selectedDate }); setShowAssignModal(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-xs font-medium"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Assign Shift
                </button>
            </div>

            {/* ═══ Main Layout: Summary Left + Content Right ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">

                {/* ── Left Sidebar: Summary + Branch Breakdown ── */}
                <div className="space-y-4">

                    {/* Quick Stats */}
                    {summary && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Day Summary</h3>
                            <div className="grid grid-cols-2 gap-2">
                                <StatChip icon={<Users className="w-3.5 h-3.5" />} label="Total" value={summary.total} color="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20" />
                                <StatChip icon={<Calendar className="w-3.5 h-3.5" />} label="Scheduled" value={summary.scheduled} color="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" />
                                <StatChip icon={<UserCheck className="w-3.5 h-3.5" />} label="Checked In" value={summary.checkedIn} color="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" />
                                <StatChip icon={<CheckCircle className="w-3.5 h-3.5" />} label="Completed" value={summary.completed} color="text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20" />
                                <StatChip icon={<UserX className="w-3.5 h-3.5" />} label="Absent" value={summary.absent} color="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20" />
                                <StatChip icon={<Coffee className="w-3.5 h-3.5" />} label="Off Duty" value={summary.offDuty} color="text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800" />
                            </div>
                            {summary.clinicianAuto > 0 && (
                                <div className="mt-2 flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 rounded-lg px-3 py-2">
                                    <Zap className="w-3.5 h-3.5" />
                                    <span className="font-medium">{summary.clinicianAuto} Auto (Clinician)</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Branch Breakdown */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">By Branch</h3>
                        {Object.keys(branchGroups).length === 0 ? (
                            <p className="text-xs text-gray-400">No assignments</p>
                        ) : (
                            <div className="space-y-3">
                                {Object.entries(branchGroups).map(([branch, items]) => (
                                    <div key={branch}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                                <Building className="w-3 h-3 text-gray-400" />
                                                {branch}
                                            </span>
                                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{items.length}</span>
                                        </div>
                                        <div className="space-y-1">
                                            {items.map(a => (
                                                <div key={a.id} className="flex items-center justify-between text-[11px] px-2 py-1 rounded-md bg-gray-50 dark:bg-gray-750">
                                                    <span className="text-gray-700 dark:text-gray-300 truncate max-w-[120px]">{a.employeeName.split(' ')[0]}</span>
                                                    <span className="font-mono text-gray-500 dark:text-gray-400">
                                                        {a.status === 'OFF_DUTY' ? 'OFF' : `${a.startTime}–${a.endTime}`}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Shift Templates */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Shift Templates</h3>
                        <div className="space-y-1.5">
                            {templates.map(t => (
                                <div key={t.id} className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-750">
                                    <span className="font-medium text-gray-700 dark:text-gray-300">{t.name}</span>
                                    <span className="font-mono text-gray-500 dark:text-gray-400">{t.startTime}–{t.endTime}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Right Content: Table ── */}
                <div>
                    {/* Tabs */}
                    <div className="flex items-center gap-1 mb-3 bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg w-fit">
                        <button
                            onClick={() => setActiveTab('schedule')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === 'schedule'
                                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                                }`}
                        >
                            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Shift Assignments</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('compare')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === 'compare'
                                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                                }`}
                        >
                            <span className="flex items-center gap-1.5"><ArrowUpDown className="w-3.5 h-3.5" /> Shift vs Attendance</span>
                        </button>
                    </div>

                    {/* Assignments Table */}
                    {activeTab === 'schedule' && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
                                            <th className="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Employee</th>
                                            <th className="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Branch</th>
                                            <th className="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Shift</th>
                                            <th className="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time</th>
                                            <th className="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hours</th>
                                            <th className="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                            <th className="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {loading ? (
                                            <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                                                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1" />Loading...
                                            </td></tr>
                                        ) : filteredAssignments.length === 0 ? (
                                            <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                                                <Users className="w-6 h-6 mx-auto mb-1 opacity-50" />No shifts for this date
                                            </td></tr>
                                        ) : (
                                            filteredAssignments.map(a => (
                                                <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                                                    <td className="px-4 py-2.5">
                                                        <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{a.employeeName}</p>
                                                        <p className="text-[10px] text-gray-400">{a.employeeCode} · {a.designation}</p>
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                                                            <Building className="w-3 h-3" />{a.branchName}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <span className="font-medium text-sm text-gray-800 dark:text-gray-200">
                                                            {a.shiftName}
                                                        </span>
                                                        {a.isClinicianAutoShift && (
                                                            <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 font-bold">AUTO</span>
                                                        )}
                                                        {a.appointmentCount ? (
                                                            <p className="text-[10px] text-gray-400 mt-0.5">{a.appointmentCount} appt(s)</p>
                                                        ) : null}
                                                    </td>
                                                    <td className="px-4 py-2.5 font-mono text-sm">
                                                        {a.status === 'OFF_DUTY'
                                                            ? <span className="text-gray-400">—</span>
                                                            : <span className="text-gray-700 dark:text-gray-300">{a.startTime} → {a.endTime}</span>}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-sm">
                                                        {a.status === 'OFF_DUTY'
                                                            ? <span className="text-gray-400">—</span>
                                                            : (
                                                                <span className="font-bold text-gray-800 dark:text-gray-200">
                                                                    {a.expectedHours}h
                                                                    {a.breakMinutes > 0 && <span className="text-[10px] text-gray-400 font-normal ml-0.5">({a.breakMinutes}m)</span>}
                                                                </span>
                                                            )}
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadge[a.status] || 'bg-gray-100 text-gray-600'}`}>
                                                            {a.status.replace('_', ' ')}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 max-w-[180px] truncate">{a.notes || '—'}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Comparison Table */}
                    {activeTab === 'compare' && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-indigo-600" />
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Shift vs Actual Attendance</h3>
                                <span className="text-[10px] text-gray-400 ml-1">Biometric punch data comparison</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
                                            <th className="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Employee</th>
                                            <th className="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Shift</th>
                                            <th className="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Scheduled</th>
                                            <th className="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actual</th>
                                            <th className="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Expected</th>
                                            <th className="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actual Hrs</th>
                                            <th className="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Variance</th>
                                            <th className="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {loading ? (
                                            <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                                                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1" />Loading...
                                            </td></tr>
                                        ) : comparisons.length === 0 ? (
                                            <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                                                <BarChart3 className="w-6 h-6 mx-auto mb-1 opacity-50" />No comparison data
                                            </td></tr>
                                        ) : (
                                            comparisons.map(c => (
                                                <tr key={c.employeeId} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                                                    <td className="px-4 py-2.5">
                                                        <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{c.employeeName}</p>
                                                        <p className="text-[10px] text-gray-400">{c.employeeCode} · {c.branchName}</p>
                                                    </td>
                                                    <td className="px-4 py-2.5 font-medium text-sm">{c.shiftName}</td>
                                                    <td className="px-4 py-2.5 font-mono text-sm text-gray-600 dark:text-gray-400">{c.scheduledStart} → {c.scheduledEnd}</td>
                                                    <td className="px-4 py-2.5 font-mono text-sm">
                                                        {c.actualPunchIn && c.actualPunchOut
                                                            ? <span className="text-gray-700 dark:text-gray-300">{c.actualPunchIn} → {c.actualPunchOut}</span>
                                                            : <span className="text-red-500">No data</span>}
                                                    </td>
                                                    <td className="px-4 py-2.5 font-bold text-sm">{c.expectedHours}h</td>
                                                    <td className="px-4 py-2.5 font-bold text-sm">{c.actualHours}h</td>
                                                    <td className="px-4 py-2.5 font-mono text-sm">
                                                        <span className={c.varianceHours >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                                                            {c.varianceHours >= 0 ? '+' : ''}{c.varianceHours}h
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${compStatusBadge[c.status] || 'bg-gray-100 text-gray-600'}`}>
                                                            {c.status.replace(/_/g, ' ')}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ Assign Shift Modal ═══ */}
            {showAssignModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowAssignModal(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                            <Plus className="w-5 h-5 text-indigo-600" />
                            Assign Shift
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Employee</label>
                                <select
                                    value={assignForm.employeeId}
                                    onChange={e => setAssignForm({ ...assignForm, employeeId: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm outline-none"
                                >
                                    <option value="">Select employee...</option>
                                    {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Branch</label>
                                    <select
                                        value={assignForm.branchId}
                                        onChange={e => setAssignForm({ ...assignForm, branchId: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm outline-none"
                                    >
                                        {BRANCHES.filter(b => b.id).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                                    <input
                                        type="date"
                                        value={assignForm.date || selectedDate}
                                        onChange={e => setAssignForm({ ...assignForm, date: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Shift Template <span className="text-gray-400 font-normal">(pre-fills times)</span></label>
                                <select
                                    value={assignForm.shiftTemplateId}
                                    onChange={e => handleTemplateChange(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm outline-none"
                                >
                                    <option value="">— Custom Time (no template) —</option>
                                    {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.startTime}–{t.endTime})</option>)}
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="useCustomTime" checked={assignForm.useCustomTime}
                                    onChange={e => setAssignForm({ ...assignForm, useCustomTime: e.target.checked })}
                                    className="rounded border-gray-300"
                                />
                                <label htmlFor="useCustomTime" className="text-sm text-gray-600 dark:text-gray-400">Override with custom times</label>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> Start Time
                                    </label>
                                    <input type="time" value={assignForm.startTime}
                                        onChange={e => setAssignForm({ ...assignForm, startTime: e.target.value, useCustomTime: true })}
                                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm outline-none font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> End Time
                                    </label>
                                    <input type="time" value={assignForm.endTime}
                                        onChange={e => setAssignForm({ ...assignForm, endTime: e.target.value, useCustomTime: true })}
                                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm outline-none font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                                        <Coffee className="w-3 h-3" /> Break (min)
                                    </label>
                                    <input type="number" min={0} max={180} step={15} value={assignForm.breakMinutes}
                                        onChange={e => setAssignForm({ ...assignForm, breakMinutes: parseInt(e.target.value) || 0, useCustomTime: true })}
                                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm outline-none font-mono"
                                    />
                                </div>
                            </div>
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3 flex items-center justify-between">
                                <span className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">Expected Working Hours</span>
                                <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{previewHours}h</span>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setShowAssignModal(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">Cancel</button>
                            <button onClick={handleAssignShift}
                                disabled={!assignForm.employeeId || !assignForm.branchId}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40">
                                <CheckCircle className="w-4 h-4" />Assign Shift
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Compact Stat Chip ──

function StatChip({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
    return (
        <div className={`flex items-center gap-2 rounded-lg px-2.5 py-2 ${color}`}>
            {icon}
            <div className="min-w-0">
                <p className="text-lg font-bold leading-tight">{value}</p>
                <p className="text-[10px] opacity-75 leading-tight">{label}</p>
            </div>
        </div>
    );
}

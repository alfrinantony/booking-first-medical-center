'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    Clock, Users, AlertTriangle, CheckCircle, XCircle, RefreshCw,
    Plus, ChevronRight, Filter, ArrowLeft, Wifi, WifiOff,
    Calendar, FileSpreadsheet, Settings2, UserX, Timer, Bell, Minus, SplitSquareVertical,
    Building, Coffee
} from 'lucide-react';

interface AttendanceRecord {
    id: string;
    employeeId: string;
    employeeName: string;
    employeeCode: string;
    date: string;
    punchIn: string | null;
    punchOut: string | null;
    shifts: { punchIn: string; punchOut: string }[];
    isSplitDuty: boolean;
    rawHours: number;
    breakDeducted: number;
    totalHours: number;
    status: string;
    source: string;
    notes: string;
    branchId: string;
    branchName: string;
}

interface Summary {
    total: number;
    present: number;
    late: number;
    absent: number;
    earlyLeave: number;
    halfDay: number;
    onLeave: number;
    dayOff: number;
    weeklyOff: number;
}

interface BranchBreakdown {
    branchId: string;
    branchName: string;
    present: number;
    late: number;
    absent: number;
    total: number;
}

interface AlertItem {
    id: string;
    employeeName: string;
    type: string;
    date: string;
    message: string;
    read: boolean;
}

const STATUS_BADGES: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    PRESENT: { label: 'Present', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: <CheckCircle className="w-3 h-3" /> },
    LATE: { label: 'Late', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: <Timer className="w-3 h-3" /> },
    ABSENT: { label: 'Absent', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: <XCircle className="w-3 h-3" /> },
    EARLY_LEAVE: { label: 'Early Leave', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: <AlertTriangle className="w-3 h-3" /> },
    HALF_DAY: { label: 'Half Day', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: <Clock className="w-3 h-3" /> },
    ON_LEAVE: { label: 'On Leave', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', icon: <Calendar className="w-3 h-3" /> },
    DAY_OFF: { label: 'Day Off', color: 'bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-400', icon: <Calendar className="w-3 h-3" /> },
};

export default function AttendanceDashboardPage() {
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [alerts, setAlerts] = useState<AlertItem[]>([]);
    const [selectedDate, setSelectedDate] = useState('2026-03-05');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [branchBreakdown, setBranchBreakdown] = useState<BranchBreakdown[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [deviceOnline, setDeviceOnline] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showAlerts, setShowAlerts] = useState(false);
    const [employees, setEmployees] = useState<{ id: string; name: string; code: string }[]>([]);

    // Add form
    const [addForm, setAddForm] = useState({
        employeeId: '',
        date: selectedDate,
        punchIn: '09:00',
        punchOut: '18:00',
        notes: '',
    });

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [attRes, alertRes, empRes, syncRes] = await Promise.all([
                fetch(`/api/admin/hr/attendance?date=${selectedDate}&summary=today`),
                fetch(`/api/admin/hr/attendance/alerts?generate=true&date=${selectedDate}`),
                fetch('/api/admin/hr/employees'),
                fetch('/api/admin/hr/attendance/sync'),
            ]);

            const attData = await attRes.json();
            setRecords(attData.records || attData);
            setSummary(attData.summary || null);
            setBranchBreakdown(attData.branchBreakdown || []);

            const alertData = await alertRes.json();
            setAlerts(alertData.alerts || []);

            if (empRes.ok) {
                const empData = await empRes.json();
                const list = Array.isArray(empData) ? empData : empData.employees || [];
                setEmployees(list.map((e: Record<string, string>) => ({
                    id: e.id,
                    name: `${e.firstName} ${e.lastName}`,
                    code: e.employeeCode,
                })));
            }

            const syncData = await syncRes.json();
            setDeviceOnline(syncData.deviceStatus === 'ONLINE');
        } catch (err) {
            console.error('Failed to load attendance data', err);
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await fetch('/api/admin/hr/attendance/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ startDate: selectedDate, endDate: selectedDate }),
            });
            await res.json();
            await loadData();
        } catch (err) {
            console.error('Sync failed', err);
        } finally {
            setSyncing(false);
        }
    };

    const handleAddRecord = async () => {
        try {
            await fetch('/api/admin/hr/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...addForm, source: 'MANUAL' }),
            });
            setShowAddModal(false);
            setAddForm({ employeeId: '', date: selectedDate, punchIn: '09:00', punchOut: '18:00', notes: '' });
            await loadData();
        } catch (err) {
            console.error('Failed to add record', err);
        }
    };

    const filteredRecords = records.filter(r => {
        if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
        if (searchQuery && !r.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !r.employeeCode.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    const unreadAlerts = alerts.filter(a => !a.read);

    return (
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <Link href="/admin/hr" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Attendance Dashboard</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">ZKTeco SpeedFace-V5L Integration</p>
                    </div>
                    {/* Device status */}
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${deviceOnline
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                        {deviceOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                        {deviceOnline ? 'Device Online' : 'Device Offline'}
                        {deviceOnline && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowAlerts(!showAlerts)}
                        className="relative p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        <Bell className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        {unreadAlerts.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                {unreadAlerts.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors text-sm font-medium"
                    >
                        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Syncing...' : 'Sync Device'}
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        Manual Entry
                    </button>
                </div>
            </div>

            {/* Alerts Panel */}
            {showAlerts && unreadAlerts.length > 0 && (
                <div className="mb-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Attendance Alerts ({unreadAlerts.length})
                    </h3>
                    <div className="space-y-2">
                        {unreadAlerts.slice(0, 5).map(alert => (
                            <div key={alert.id} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-3 border border-amber-100 dark:border-amber-900/30">
                                <div className="flex items-center gap-3">
                                    <span className={`w-2 h-2 rounded-full ${alert.type === 'ABSENT' ? 'bg-red-500' : alert.type === 'LATE' ? 'bg-amber-500' : 'bg-orange-500'}`} />
                                    <p className="text-sm text-gray-700 dark:text-gray-300">{alert.message}</p>
                                </div>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded ${alert.type === 'ABSENT' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                                    {alert.type}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                    <SummaryCard label="Present" value={summary.present} color="emerald" icon={<CheckCircle className="w-5 h-5" />} />
                    <SummaryCard label="Late" value={summary.late} color="amber" icon={<Timer className="w-5 h-5" />} />
                    <SummaryCard label="Absent" value={summary.absent} color="red" icon={<UserX className="w-5 h-5" />} />
                    <SummaryCard label="Early Leave" value={summary.earlyLeave} color="orange" icon={<AlertTriangle className="w-5 h-5" />} />
                    <SummaryCard label="Half Day" value={summary.halfDay} color="blue" icon={<Clock className="w-5 h-5" />} />
                    <SummaryCard label="On Leave" value={summary.onLeave} color="purple" icon={<Calendar className="w-5 h-5" />} />
                    <SummaryCard label="Weekly OFF" value={summary.weeklyOff} color="gray" icon={<Coffee className="w-5 h-5" />} />
                </div>
            )}

            {/* Branch Breakdown */}
            {branchBreakdown.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Building className="w-4 h-4" />
                        Attendance by Branch
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {branchBreakdown.map(branch => (
                            <div key={branch.branchId} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                                            <Building className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{branch.branchName}</p>
                                            <p className="text-[10px] text-gray-500 dark:text-gray-400">{branch.total} employees</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 text-center">
                                        <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{branch.present}</p>
                                        <p className="text-[10px] text-gray-500">Present</p>
                                    </div>
                                    <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />
                                    <div className="flex-1 text-center">
                                        <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{branch.late}</p>
                                        <p className="text-[10px] text-gray-500">Late</p>
                                    </div>
                                    <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />
                                    <div className="flex-1 text-center">
                                        <p className="text-lg font-bold text-red-600 dark:text-red-400">{branch.absent}</p>
                                        <p className="text-[10px] text-gray-500">Absent</p>
                                    </div>
                                </div>
                                {/* Branch presence bar */}
                                <div className="mt-3 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-500 rounded-full transition-all"
                                        style={{ width: `${branch.total > 0 ? (branch.present / branch.total) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Filters & Quick Links */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                        />
                    </div>
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="pl-9 pr-8 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none appearance-none"
                        >
                            <option value="ALL">All Status</option>
                            <option value="PRESENT">Present</option>
                            <option value="LATE">Late</option>
                            <option value="ABSENT">Absent</option>
                            <option value="EARLY_LEAVE">Early Leave</option>
                            <option value="HALF_DAY">Half Day</option>
                        </select>
                    </div>
                    <input
                        type="text"
                        placeholder="Search employee..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none w-48"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/admin/hr/attendance/timesheet"
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <FileSpreadsheet className="w-4 h-4" /> Timesheets <ChevronRight className="w-3 h-3" />
                    </Link>
                    <Link href="/admin/hr/attendance/devices"
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <Settings2 className="w-4 h-4" /> Devices <ChevronRight className="w-3 h-3" />
                    </Link>
                </div>
            </div>

            {/* Attendance Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
                                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Employee</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Branch</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Punch In</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Punch Out</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Hours</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Status</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Source</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Notes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        Loading attendance data...
                                    </td>
                                </tr>
                            ) : filteredRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                                        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        No attendance records for this date
                                    </td>
                                </tr>
                            ) : filteredRecords.map(record => {
                                const badge = STATUS_BADGES[record.status] || STATUS_BADGES.PRESENT;
                                return (
                                    <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                                        <td className="px-4 py-3">
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-gray-100">{record.employeeName}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{record.employeeCode}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                                <Building className="w-3 h-3" />
                                                {record.branchName || '—'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {record.isSplitDuty ? (
                                                <div className="space-y-0.5">
                                                    {record.shifts.map((s: { punchIn: string; punchOut: string }, i: number) => (
                                                        <div key={i} className="flex items-center gap-1">
                                                            <span className="font-mono text-gray-700 dark:text-gray-300 text-xs">
                                                                {s.punchIn}
                                                            </span>
                                                            <span className="text-gray-400 text-[10px]">→</span>
                                                            <span className="font-mono text-gray-700 dark:text-gray-300 text-xs">
                                                                {s.punchOut}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="font-mono text-gray-700 dark:text-gray-300">
                                                    {record.punchIn || '—'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {record.isSplitDuty ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                                                    <SplitSquareVertical className="w-3 h-3" />
                                                    Split Duty
                                                </span>
                                            ) : (
                                                <span className="font-mono text-gray-700 dark:text-gray-300">
                                                    {record.punchOut || '—'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {record.totalHours > 0 ? (
                                                <div>
                                                    <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                                                        {record.totalHours}h
                                                    </span>
                                                    {record.breakDeducted > 0 && (
                                                        <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400" title={`${record.rawHours}h raw - ${record.breakDeducted}h break`}>
                                                            <Minus className="w-2.5 h-2.5" />{record.breakDeducted}h brk
                                                        </span>
                                                    )}
                                                    {record.isSplitDuty && (
                                                        <span className="ml-1 text-[10px] text-violet-500 dark:text-violet-400">
                                                            (no break)
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-gray-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
                                                {badge.icon}
                                                {badge.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${record.source === 'BIOMETRIC'
                                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                                                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                                                {record.source === 'BIOMETRIC' ? '🔒 Biometric' : '✏️ Manual'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs max-w-[200px] truncate">
                                            {record.notes || '—'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Manual Record Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Add Manual Attendance</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Employee</label>
                                <select
                                    value={addForm.employeeId}
                                    onChange={(e) => setAddForm({ ...addForm, employeeId: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">Select employee</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.name} ({emp.code})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                                <input
                                    type="date"
                                    value={addForm.date}
                                    onChange={(e) => setAddForm({ ...addForm, date: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Punch In</label>
                                    <input
                                        type="time"
                                        value={addForm.punchIn}
                                        onChange={(e) => setAddForm({ ...addForm, punchIn: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Punch Out</label>
                                    <input
                                        type="time"
                                        value={addForm.punchOut}
                                        onChange={(e) => setAddForm({ ...addForm, punchOut: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                                <input
                                    type="text"
                                    value={addForm.notes}
                                    onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                                    placeholder="Reason for manual entry"
                                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddRecord}
                                disabled={!addForm.employeeId}
                                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                            >
                                Add Record
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Summary card component
function SummaryCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
    const colorMap: Record<string, string> = {
        emerald: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400',
        amber: 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400',
        red: 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400',
        orange: 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400',
        blue: 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400',
        purple: 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400',
        gray: 'bg-gray-50 dark:bg-gray-900/10 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400',
    };

    return (
        <div className={`rounded-xl border p-4 ${colorMap[color] || colorMap.blue}`}>
            <div className="flex items-center justify-between mb-2">
                {icon}
                <span className="text-2xl font-bold">{value}</span>
            </div>
            <p className="text-xs font-medium opacity-80">{label}</p>
        </div>
    );
}

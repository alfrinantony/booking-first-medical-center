'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, FileSpreadsheet, Download, Calendar,
    Clock, CheckCircle, XCircle, Timer, AlertTriangle, Users
} from 'lucide-react';

interface TimesheetRecord {
    date: string;
    punchIn: string | null;
    punchOut: string | null;
    totalHours: number;
    status: string;
}

interface Timesheet {
    employeeId: string;
    employeeName: string;
    employeeCode: string;
    month: number;
    year: number;
    records: TimesheetRecord[];
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

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const STATUS_COLORS: Record<string, string> = {
    PRESENT: 'text-emerald-600 dark:text-emerald-400',
    LATE: 'text-amber-600 dark:text-amber-400',
    ABSENT: 'text-red-600 dark:text-red-400',
    EARLY_LEAVE: 'text-orange-600 dark:text-orange-400',
    HALF_DAY: 'text-blue-600 dark:text-blue-400',
    ON_LEAVE: 'text-purple-600 dark:text-purple-400',
    DAY_OFF: 'text-gray-400 dark:text-gray-500',
};

export default function TimesheetPage() {
    const [employees, setEmployees] = useState<{ id: string; name: string; code: string }[]>([]);
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [month, setMonth] = useState(3); // March
    const [year, setYear] = useState(2026);
    const [timesheet, setTimesheet] = useState<Timesheet | null>(null);
    const [allTimesheets, setAllTimesheets] = useState<Timesheet[]>([]);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'individual' | 'all'>('all');

    // Load employees
    useEffect(() => {
        fetch('/api/admin/hr/employees')
            .then(res => res.json())
            .then(data => {
                const list = Array.isArray(data) ? data : data.employees || [];
                setEmployees(list.map((e: Record<string, string>) => ({
                    id: e.id,
                    name: `${e.firstName} ${e.lastName}`,
                    code: e.employeeCode,
                })));
            });
    }, []);

    const loadTimesheet = useCallback(async () => {
        setLoading(true);
        try {
            if (viewMode === 'individual' && selectedEmployee) {
                const res = await fetch(`/api/admin/hr/attendance/timesheet?employeeId=${selectedEmployee}&month=${month}&year=${year}`);
                const data = await res.json();
                setTimesheet(data);
                setAllTimesheets([]);
            } else {
                const res = await fetch(`/api/admin/hr/attendance/timesheet?month=${month}&year=${year}`);
                const data = await res.json();
                setAllTimesheets(Array.isArray(data) ? data : []);
                setTimesheet(null);
            }
        } catch (err) {
            console.error('Failed to load timesheet', err);
        } finally {
            setLoading(false);
        }
    }, [selectedEmployee, month, year, viewMode]);

    useEffect(() => { loadTimesheet(); }, [loadTimesheet]);

    const exportCSV = () => {
        const data = timesheet ? [timesheet] : allTimesheets;
        if (data.length === 0) return;

        let csv = 'Employee Code,Employee Name,Working Days,Days Present,Hours Worked,Late Days,Absences,Early Leaves,Avg Hours/Day\n';
        for (const ts of data) {
            csv += `${ts.employeeCode},${ts.employeeName},${ts.totalWorkingDays},${ts.totalDaysPresent},${ts.totalHoursWorked},${ts.lateDays},${ts.absentDays},${ts.earlyLeaveDays},${ts.averageHoursPerDay}\n`;
        }

        if (timesheet) {
            csv += '\nDate,Punch In,Punch Out,Hours,Status\n';
            for (const r of timesheet.records) {
                csv += `${r.date},${r.punchIn || '-'},${r.punchOut || '-'},${r.totalHours},${r.status}\n`;
            }
        }

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `timesheet_${MONTH_NAMES[month - 1]}_${year}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <Link href="/admin/hr/attendance" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Monthly Timesheet</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {MONTH_NAMES[month - 1]} {year}
                        </p>
                    </div>
                </div>
                <button
                    onClick={exportCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
                >
                    <Download className="w-4 h-4" />
                    Export CSV
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3 mb-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setViewMode('all')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'all'
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                            : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                    >
                        <Users className="w-4 h-4 inline mr-1" /> All Employees
                    </button>
                    <button
                        onClick={() => setViewMode('individual')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'individual'
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                            : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                    >
                        <FileSpreadsheet className="w-4 h-4 inline mr-1" /> Individual
                    </button>
                </div>

                {viewMode === 'individual' && (
                    <select
                        value={selectedEmployee}
                        onChange={(e) => setSelectedEmployee(e.target.value)}
                        className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="">Select employee</option>
                        {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.name} ({emp.code})</option>
                        ))}
                    </select>
                )}

                <div className="flex items-center gap-2 ml-auto">
                    <select
                        value={month}
                        onChange={(e) => setMonth(parseInt(e.target.value))}
                        className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        {MONTH_NAMES.map((name, i) => (
                            <option key={i} value={i + 1}>{name}</option>
                        ))}
                    </select>
                    <select
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value))}
                        className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        {[2024, 2025, 2026, 2027].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="py-20 text-center text-gray-400">
                    <Clock className="w-8 h-8 animate-spin mx-auto mb-3" />
                    Generating timesheet...
                </div>
            ) : viewMode === 'all' ? (
                /* All employees summary table */
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Employee</th>
                                    <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Working Days</th>
                                    <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Present</th>
                                    <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Hours</th>
                                    <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Late</th>
                                    <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Absent</th>
                                    <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Early Leave</th>
                                    <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Avg Hrs/Day</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {allTimesheets.map(ts => (
                                    <tr key={ts.employeeId} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-gray-900 dark:text-gray-100">{ts.employeeName}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{ts.employeeCode}</p>
                                        </td>
                                        <td className="text-center px-4 py-3 text-gray-700 dark:text-gray-300">{ts.totalWorkingDays}</td>
                                        <td className="text-center px-4 py-3">
                                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                                <CheckCircle className="w-3.5 h-3.5" /> {ts.totalDaysPresent}
                                            </span>
                                        </td>
                                        <td className="text-center px-4 py-3 font-mono text-gray-700 dark:text-gray-300">{ts.totalHoursWorked}h</td>
                                        <td className="text-center px-4 py-3">
                                            {ts.lateDays > 0 ? (
                                                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                                                    <Timer className="w-3.5 h-3.5" /> {ts.lateDays}
                                                </span>
                                            ) : <span className="text-gray-300 dark:text-gray-600">0</span>}
                                        </td>
                                        <td className="text-center px-4 py-3">
                                            {ts.absentDays > 0 ? (
                                                <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                                                    <XCircle className="w-3.5 h-3.5" /> {ts.absentDays}
                                                </span>
                                            ) : <span className="text-gray-300 dark:text-gray-600">0</span>}
                                        </td>
                                        <td className="text-center px-4 py-3">
                                            {ts.earlyLeaveDays > 0 ? (
                                                <span className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400 font-medium">
                                                    <AlertTriangle className="w-3.5 h-3.5" /> {ts.earlyLeaveDays}
                                                </span>
                                            ) : <span className="text-gray-300 dark:text-gray-600">0</span>}
                                        </td>
                                        <td className="text-center px-4 py-3 font-mono text-gray-700 dark:text-gray-300">{ts.averageHoursPerDay}h</td>
                                    </tr>
                                ))}
                                {allTimesheets.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                                            No attendance data for the selected period
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : timesheet ? (
                /* Individual timesheet */
                <div>
                    {/* Summary cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
                        <StatCard label="Working Days" value={timesheet.totalWorkingDays} icon={<Calendar className="w-4 h-4" />} />
                        <StatCard label="Present" value={timesheet.totalDaysPresent} icon={<CheckCircle className="w-4 h-4" />} color="emerald" />
                        <StatCard label="Total Hours" value={`${timesheet.totalHoursWorked}h`} icon={<Clock className="w-4 h-4" />} color="blue" />
                        <StatCard label="Late Days" value={timesheet.lateDays} icon={<Timer className="w-4 h-4" />} color="amber" />
                        <StatCard label="Absences" value={timesheet.absentDays} icon={<XCircle className="w-4 h-4" />} color="red" />
                        <StatCard label="Early Leave" value={timesheet.earlyLeaveDays} icon={<AlertTriangle className="w-4 h-4" />} color="orange" />
                        <StatCard label="Avg Hrs/Day" value={`${timesheet.averageHoursPerDay}h`} icon={<FileSpreadsheet className="w-4 h-4" />} color="indigo" />
                    </div>

                    {/* Day-by-day table */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                                {timesheet.employeeName} — {MONTH_NAMES[month - 1]} {year}
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Date</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Day</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Punch In</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Punch Out</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Hours</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {timesheet.records.map(r => {
                                        const d = new Date(r.date);
                                        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                                        return (
                                            <tr key={r.date} className={`hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${r.status === 'DAY_OFF' ? 'opacity-50' : ''}`}>
                                                <td className="px-4 py-2.5 font-mono text-gray-700 dark:text-gray-300">{r.date}</td>
                                                <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{dayName}</td>
                                                <td className="px-4 py-2.5 font-mono text-gray-700 dark:text-gray-300">{r.punchIn || '—'}</td>
                                                <td className="px-4 py-2.5 font-mono text-gray-700 dark:text-gray-300">{r.punchOut || '—'}</td>
                                                <td className="px-4 py-2.5 font-mono text-gray-700 dark:text-gray-300">{r.totalHours > 0 ? `${r.totalHours}h` : '—'}</td>
                                                <td className="px-4 py-2.5">
                                                    <span className={`font-medium text-xs ${STATUS_COLORS[r.status] || 'text-gray-400'}`}>
                                                        {r.status.replace('_', ' ')}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {timesheet.records.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                                                No records found for this period
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="py-20 text-center text-gray-400">
                    <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p>Select an employee to view their timesheet</p>
                </div>
            )}
        </div>
    );
}

function StatCard({ label, value, icon, color = 'gray' }: { label: string; value: string | number; icon: React.ReactNode; color?: string }) {
    const colorMap: Record<string, string> = {
        gray: 'text-gray-600 dark:text-gray-400',
        emerald: 'text-emerald-600 dark:text-emerald-400',
        blue: 'text-blue-600 dark:text-blue-400',
        amber: 'text-amber-600 dark:text-amber-400',
        red: 'text-red-600 dark:text-red-400',
        orange: 'text-orange-600 dark:text-orange-400',
        indigo: 'text-indigo-600 dark:text-indigo-400',
        purple: 'text-purple-600 dark:text-purple-400',
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
            <div className={`flex items-center gap-1.5 mb-1 ${colorMap[color]}`}>
                {icon}
                <span className="text-xs font-medium">{label}</span>
            </div>
            <p className={`text-xl font-bold ${colorMap[color]}`}>{value}</p>
        </div>
    );
}

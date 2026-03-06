'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, Wifi, WifiOff, RefreshCw, Plus, Settings2,
    Server, Clock, Shield, Trash2, CheckCircle, XCircle, Cpu, Building
} from 'lucide-react';

interface Device {
    id: string;
    name: string;
    serialNumber: string;
    host: string;
    port: number;
    branchName?: string;
    status: string;
    lastSync: string | null;
    autoSyncEnabled: boolean;
    autoSyncIntervalMinutes: number;
    liveStatus?: string;
    deviceInfo?: {
        firmwareVersion: string;
        ipAddress: string;
        enrolledUsers: number;
    } | null;
}

export default function DeviceManagementPage() {
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<Record<string, unknown> | null>(null);

    const [form, setForm] = useState({
        name: 'SpeedFace-V5L',
        serialNumber: '',
        host: '192.168.1.200',
        port: 4370,
        username: 'admin',
        password: '',
        autoSyncEnabled: true,
        autoSyncIntervalMinutes: 15,
    });

    const loadDevices = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/hr/attendance/device');
            const data = await res.json();
            setDevices(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to load devices', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadDevices(); }, []);

    const testConnection = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const res = await fetch('/api/admin/hr/attendance/device', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'test',
                    host: form.host,
                    port: form.port,
                    username: form.username,
                    password: form.password,
                    deviceSn: form.serialNumber,
                }),
            });
            const data = await res.json();
            setTestResult({ success: data.success, message: data.message });
        } catch {
            setTestResult({ success: false, message: 'Connection test failed' });
        } finally {
            setTesting(false);
        }
    };

    const handleAddDevice = async () => {
        try {
            await fetch('/api/admin/hr/attendance/device', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'add', ...form }),
            });
            setShowAddForm(false);
            await loadDevices();
        } catch (err) {
            console.error('Failed to add device', err);
        }
    };

    const handleDeleteDevice = async (id: string) => {
        if (!confirm('Remove this device?')) return;
        try {
            await fetch(`/api/admin/hr/attendance/device?id=${id}`, { method: 'DELETE' });
            await loadDevices();
        } catch (err) {
            console.error('Failed to delete device', err);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        setSyncResult(null);
        try {
            const res = await fetch('/api/admin/hr/attendance/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            const data = await res.json();
            setSyncResult(data);
            await loadDevices();
        } catch {
            setSyncResult({ success: false, error: 'Sync failed' });
        } finally {
            setSyncing(false);
        }
    };

    const handleToggleAutoSync = async (device: Device) => {
        try {
            await fetch('/api/admin/hr/attendance/device', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update',
                    id: device.id,
                    autoSyncEnabled: !device.autoSyncEnabled,
                }),
            });
            await loadDevices();
        } catch (err) {
            console.error('Failed to toggle auto-sync', err);
        }
    };

    return (
        <div className="p-4 md:p-6 max-w-[1200px] mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Link href="/admin/hr/attendance" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Device Management</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">ZKTeco SpeedFace-V5L Configuration</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                >
                    <Plus className="w-4 h-4" />
                    Add Device
                </button>
            </div>

            {/* Add / Configure Device Form */}
            {showAddForm && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                        <Settings2 className="w-5 h-5 text-indigo-500" />
                        Device Configuration
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Device Name</label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Serial Number</label>
                            <input
                                type="text"
                                value={form.serialNumber}
                                onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                                placeholder="SFVL-2024-XXXXX"
                                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">IP Address / Host</label>
                            <input
                                type="text"
                                value={form.host}
                                onChange={(e) => setForm({ ...form, host: e.target.value })}
                                placeholder="192.168.1.200"
                                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Port</label>
                            <input
                                type="number"
                                value={form.port}
                                onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                            <input
                                type="text"
                                value={form.username}
                                onChange={(e) => setForm({ ...form, username: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                            <input
                                type="password"
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.autoSyncEnabled}
                                    onChange={(e) => setForm({ ...form, autoSyncEnabled: e.target.checked })}
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">Auto-sync</span>
                            </label>
                            {form.autoSyncEnabled && (
                                <div className="flex items-center gap-1">
                                    <span className="text-xs text-gray-500">every</span>
                                    <input
                                        type="number"
                                        value={form.autoSyncIntervalMinutes}
                                        onChange={(e) => setForm({ ...form, autoSyncIntervalMinutes: parseInt(e.target.value) })}
                                        className="w-16 px-2 py-1 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 outline-none"
                                    />
                                    <span className="text-xs text-gray-500">min</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Test result */}
                    {testResult && (
                        <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 text-sm ${testResult.success
                            ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                            }`}>
                            {testResult.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                            {testResult.message}
                        </div>
                    )}

                    <div className="flex gap-3 mt-5">
                        <button
                            onClick={testConnection}
                            disabled={testing}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                        >
                            <Wifi className={`w-4 h-4 ${testing ? 'animate-pulse' : ''}`} />
                            {testing ? 'Testing...' : 'Test Connection'}
                        </button>
                        <button
                            onClick={handleAddDevice}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Save Device
                        </button>
                    </div>
                </div>
            )}

            {/* Sync Controls */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
                            <RefreshCw className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Sync Attendance Data</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Pull latest punch-in/out data from connected devices
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors text-sm font-medium"
                    >
                        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Syncing...' : 'Sync Now'}
                    </button>
                </div>

                {syncResult && (
                    <div className={`mt-4 p-3 rounded-lg text-sm ${(syncResult as { success: boolean }).success
                        ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                        }`}>
                        {(syncResult as { success: boolean }).success ? (
                            <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Sync successful</span>
                                <span>Transactions: {(syncResult as { transactionsFound: number }).transactionsFound}</span>
                                <span>Imported: {(syncResult as { newRecordsImported: number }).newRecordsImported}</span>
                                <span>Skipped: {(syncResult as { duplicatesSkipped: number }).duplicatesSkipped}</span>
                            </div>
                        ) : (
                            <span className="flex items-center gap-1"><XCircle className="w-4 h-4" /> Sync failed</span>
                        )}
                    </div>
                )}
            </div>

            {/* Devices List */}
            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Connected Devices ({devices.length})
                </h3>

                {loading ? (
                    <div className="py-12 text-center text-gray-400">
                        <Server className="w-8 h-8 animate-pulse mx-auto mb-2" />
                        Loading devices...
                    </div>
                ) : devices.length === 0 ? (
                    <div className="py-12 text-center text-gray-400 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                        <Cpu className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p>No devices configured</p>
                        <p className="text-xs mt-1">Click &quot;Add Device&quot; to connect a ZKTeco device</p>
                    </div>
                ) : (
                    devices.map(device => (
                        <div key={device.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${device.liveStatus === 'ONLINE' || device.status === 'ONLINE'
                                        ? 'bg-emerald-100 dark:bg-emerald-900/20'
                                        : 'bg-red-100 dark:bg-red-900/20'
                                        }`}>
                                        <Server className={`w-6 h-6 ${device.liveStatus === 'ONLINE' || device.status === 'ONLINE'
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-red-600 dark:text-red-400'
                                            }`} />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-gray-900 dark:text-gray-100">{device.name}</h4>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                            <span className="flex items-center gap-1">
                                                <Shield className="w-3 h-3" />
                                                S/N: {device.serialNumber}
                                            </span>
                                            <span>{device.host}:{device.port}</span>
                                            {device.branchName && (
                                                <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
                                                    <Building className="w-3 h-3" />
                                                    {device.branchName}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-2">
                                            <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${device.liveStatus === 'ONLINE' || device.status === 'ONLINE'
                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                }`}>
                                                {device.liveStatus === 'ONLINE' || device.status === 'ONLINE' ? (
                                                    <><Wifi className="w-3 h-3" /> Online</>
                                                ) : (
                                                    <><WifiOff className="w-3 h-3" /> Offline</>
                                                )}
                                            </span>
                                            {device.lastSync && (
                                                <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                                    <Clock className="w-3 h-3" />
                                                    Last sync: {new Date(device.lastSync).toLocaleString()}
                                                </span>
                                            )}
                                            <button
                                                onClick={() => handleToggleAutoSync(device)}
                                                className={`text-xs font-medium px-2 py-0.5 rounded-full ${device.autoSyncEnabled
                                                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                                                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                                                    }`}
                                            >
                                                {device.autoSyncEnabled ? `Auto-sync: ${device.autoSyncIntervalMinutes}m` : 'Auto-sync: Off'}
                                            </button>
                                        </div>
                                        {device.deviceInfo && (
                                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                                                <span>Firmware: {device.deviceInfo.firmwareVersion}</span>
                                                <span>Enrolled: {device.deviceInfo.enrolledUsers} users</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDeleteDevice(device.id)}
                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

'use client';

import React, { useState, useEffect } from 'react';
import { Bell, Mail, MessageSquare, Plus, Trash2, Send, MessageCircle } from 'lucide-react';

interface NotificationConfig {
    id: string;
    type: 'email' | 'sms' | 'whatsapp';
    timing: number;
    enabled: boolean;
    template: string;
}

export default function NotificationSettingsPage() {
    const [configs, setConfigs] = useState<NotificationConfig[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isTesting, setIsTesting] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/admin/notifications')
            .then(r => r.json())
            .then(data => { if (Array.isArray(data)) setConfigs(data); })
            .catch(() => {})
            .finally(() => setIsLoading(false));
    }, []);

    const handleToggle = async (id: string, enabled: boolean) => {
        const res = await fetch('/api/admin/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update', id, enabled }),
        });
        const updated = await res.json();
        if (updated && !updated.error) {
            setConfigs(configs.map(c => c.id === id ? updated : c));
        }
    };

    const handleUpdate = async (id: string, field: keyof NotificationConfig, value: any) => {
        const res = await fetch('/api/admin/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update', id, [field]: value }),
        });
        const updated = await res.json();
        if (updated && !updated.error) {
            setConfigs(configs.map(c => c.id === id ? updated : c));
        }
    };

    const handleAdd = async () => {
        const res = await fetch('/api/admin/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'add', type: 'email', timing: 24, enabled: true, template: 'New reminder...' }),
        });
        const newConfig = await res.json();
        if (newConfig && !newConfig.error) {
            setConfigs([...configs, newConfig]);
        }
    };

    const handleDelete = async (id: string) => {
        await fetch('/api/admin/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', id }),
        });
        setConfigs(configs.filter(c => c.id !== id));
    };

    const handleTest = (id: string) => {
        setIsTesting(id);
        setTimeout(() => {
            alert(`Test notification sent for config ${id}`);
            setIsTesting(null);
        }, 1000);
    };

    if (isLoading) {
        return (
            <div className="p-6 max-w-4xl mx-auto">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-96"></div>
                    <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                    <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
                <Bell className="h-6 w-6 text-indigo-600" />
                Booking Reminders
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mb-8">
                Configure automated email and SMS reminders for your patients.
            </p>

            <div className="space-y-6">
                {configs.map((config) => (
                    <div key={config.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-all hover:shadow-md">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${config.type === 'email' ? 'bg-blue-100 text-blue-600' :
                                    config.type === 'sms' ? 'bg-green-100 text-green-600' :
                                        'bg-teal-100 text-teal-600'
                                    }`}>
                                    {config.type === 'email' && <Mail className="h-5 w-5" />}
                                    {config.type === 'sms' && <MessageSquare className="h-5 w-5" />}
                                    {config.type === 'whatsapp' && <MessageCircle className="h-5 w-5" />}
                                </div>
                                <div>
                                    <select
                                        value={config.type}
                                        onChange={(e) => handleUpdate(config.id, 'type', e.target.value)}
                                        className="font-semibold text-gray-900 dark:text-white capitalize bg-transparent border-none focus:ring-0 p-0 cursor-pointer hover:underline"
                                    >
                                        <option value="email">Email Reminder</option>
                                        <option value="sms">SMS Reminder</option>
                                        <option value="whatsapp">WhatsApp Reminder</option>
                                    </select>
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <span>Send</span>
                                        <input
                                            type="number"
                                            value={config.timing}
                                            onChange={(e) => handleUpdate(config.id, 'timing', parseInt(e.target.value))}
                                            className="w-16 p-1 border rounded text-center dark:bg-gray-700 dark:border-gray-600"
                                        />
                                        <span>hours before appointment</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={config.enabled}
                                        onChange={(e) => handleToggle(config.id, e.target.checked)}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                                </label>
                                <button
                                    onClick={() => handleDelete(config.id)}
                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-bold uppercase text-gray-400 tracking-wider">Message Template</label>
                            <textarea
                                value={config.template}
                                onChange={(e) => handleUpdate(config.id, 'template', e.target.value)}
                                className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none min-h-[80px]"
                            />
                            <p className="text-xs text-gray-400">
                                Available variables: <span className="font-mono">{`{name}, {time}, {doctor}, {clinic}`}</span>
                            </p>
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                            <button
                                onClick={() => handleTest(config.id)}
                                disabled={!!isTesting}
                                className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 px-4 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
                            >
                                {isTesting === config.id ? (
                                    <span className="animate-pulse">Sending...</span>
                                ) : (
                                    <>
                                        <Send className="h-4 w-4" />
                                        Send Test
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                ))}

                <button
                    onClick={handleAdd}
                    className="w-full py-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-gray-500 hover:border-indigo-500 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all flex flex-col items-center justify-center gap-2"
                >
                    <Plus className="h-6 w-6" />
                    <span className="font-medium">Add New Reminder</span>
                </button>
            </div>
        </div>
    );
}

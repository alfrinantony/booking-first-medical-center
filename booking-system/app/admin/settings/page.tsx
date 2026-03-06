'use client';

import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '@/lib/settings-store';
import { useRestrictionsStore } from '@/lib/restrictions-store';
import { timeSlots } from '@/lib/data';
import { Save, Eye, EyeOff, Bell, Activity, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useEMRStore } from '@/lib/emr-store';

export default function SettingsPage() {
    const { settings, updateSettings } = useSettingsStore();
    const { peakDays, peakSlots, noShowRestrictionDays, setPeakConfig, setNoShowRestrictionDays } = useRestrictionsStore();
    const [formData, setFormData] = useState(settings);
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
    const [isClient, setIsClient] = useState(false);
    const [localPeakDays, setLocalPeakDays] = useState<number[]>(peakDays);
    const [localPeakSlots, setLocalPeakSlots] = useState<string[]>(peakSlots);
    const [localRestrictionDays, setLocalRestrictionDays] = useState(noShowRestrictionDays);

    // EMR Integration state (must be at top level for stable hook ordering)
    const emrStoreState = useEMRStore.getState();
    const [emrUrl, setEmrUrl] = useState(emrStoreState.config.endpointUrl);
    const [emrKey, setEmrKey] = useState(emrStoreState.config.apiKey);
    const [emrEnabled, setEmrEnabled] = useState(emrStoreState.config.enabled);
    const [emrMaskContacts, setEmrMaskContacts] = useState(emrStoreState.config.maskContacts ?? true);
    const [showEmrKey, setShowEmrKey] = useState(false);
    const [emrTesting, setEmrTesting] = useState(false);
    const [emrTestResult, setEmrTestResult] = useState<{ success: boolean; message: string } | null>(null);

    useEffect(() => {
        setFormData(settings);
        setIsClient(true);
    }, [settings]);

    if (!isClient) return <div className="p-8">Loading settings...</div>;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        updateSettings(formData);
        alert('Settings saved successfully!');
    };

    const toggleSecret = (field: string) => {
        setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }));
    };

    const renderInput = (label: string, name: keyof typeof settings, type: 'text' | 'password' = 'text', placeholder = '') => (
        <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {label}
            </label>
            <div className="relative">
                <input
                    type={type === 'password' && showSecrets[name] ? 'text' : type}
                    name={name}
                    value={formData[name] || ''}
                    onChange={handleChange}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                />
                {type === 'password' && (
                    <button
                        type="button"
                        onClick={() => toggleSecret(name)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                        {showSecrets[name] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Settings</h1>
                    <p className="text-gray-600 dark:text-gray-400">Configure application settings and integrations.</p>
                </div>
                <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <Save className="w-4 h-4" />
                    Save Changes
                </button>
            </div>

            <form onSubmit={handleSave} className="space-y-8">
                {/* General Settings */}
                <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4 border-b pb-2">General Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {renderInput('Company Name', 'companyName')}
                        {renderInput('Contact Email', 'contactEmail', 'text')}
                    </div>
                </section>

                {/* Notification Channels */}
                <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-6 border-b pb-2">
                        <h2 className="text-lg font-medium text-gray-900 dark:text-white">Notification Channels</h2>
                        <Link
                            href="/admin/settings/notifications"
                            className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                            <Bell className="w-4 h-4" />
                            Manage Notification Rules
                        </Link>
                    </div>

                    <div className="space-y-8">
                        {/* Email */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Email Configuration (SMTP)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {renderInput('SMTP Host', 'emailHost')}
                                {renderInput('SMTP Port', 'emailPort')}
                                {renderInput('SMTP User', 'emailUser')}
                                {renderInput('SMTP Password', 'emailPass', 'password')}
                            </div>
                        </div>

                        {/* SMS */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">SMS Configuration (Twilio)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {renderInput('Twilio Account SID', 'twilioSid')}
                                {renderInput('Twilio Auth Token', 'twilioAuthToken', 'password')}
                                {renderInput('Twilio From Number', 'twilioFrom')}
                            </div>
                        </div>

                        {/* WhatsApp */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">WhatsApp Configuration (Meta)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {renderInput('Meta Phone ID', 'metaPhoneId')}
                                {renderInput('WhatsApp Access Token', 'whatsappAccessToken', 'password')}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Peak Schedule & No-Show Restrictions */}
                {(() => {
                    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

                    const toggleDay = (day: number) => {
                        setLocalPeakDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
                    };
                    const toggleSlot = (slot: string) => {
                        setLocalPeakSlots(prev => prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot]);
                    };
                    const savePeakConfig = () => {
                        setPeakConfig(localPeakDays, localPeakSlots);
                        setNoShowRestrictionDays(localRestrictionDays);
                        alert('Peak schedule & restrictions saved!');
                    };

                    return (
                        <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                            <div className="flex justify-between items-center mb-6 border-b pb-2">
                                <h2 className="text-lg font-medium text-gray-900 dark:text-white">🚫 Peak Schedule & No-Show Restrictions</h2>
                                <button type="button" onClick={savePeakConfig} className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm">
                                    <Save className="w-3 h-3" /> Save Peak Config
                                </button>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                Clients with a no-show will be restricted from booking during these peak days and time slots.
                            </p>

                            <div className="space-y-6">
                                {/* Peak Days */}
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Peak Days</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {dayLabels.map((label, idx) => (
                                            <button key={idx} type="button" onClick={() => toggleDay(idx)}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${localPeakDays.includes(idx)
                                                    ? 'bg-orange-100 dark:bg-orange-900/30 border-orange-500 text-orange-700 dark:text-orange-300'
                                                    : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-orange-300'
                                                    }`}>
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Peak Time Slots */}
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Peak Time Slots</h3>
                                    <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                        {timeSlots.map(slot => (
                                            <button key={slot} type="button" onClick={() => toggleSlot(slot)}
                                                className={`px-2 py-1.5 rounded text-xs font-medium border transition-all ${localPeakSlots.includes(slot)
                                                    ? 'bg-orange-100 dark:bg-orange-900/30 border-orange-500 text-orange-700 dark:text-orange-300'
                                                    : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 hover:border-orange-300'
                                                    }`}>
                                                {slot}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Restriction Duration */}
                                <div className="max-w-xs">
                                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Restriction Duration (Days)</h3>
                                    <input type="number" min="1" max="90" value={localRestrictionDays}
                                        onChange={e => setLocalRestrictionDays(Number(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm" />
                                    <p className="text-xs text-gray-400 mt-1">How many days the no-show peak restriction lasts (default: 7)</p>
                                </div>
                            </div>
                        </section>
                    );
                })()}


                {/* EMR Integration */}
                {(() => {
                    const saveEmrConfig = () => {
                        useEMRStore.getState().updateConfig({ endpointUrl: emrUrl, apiKey: emrKey, enabled: emrEnabled, maskContacts: emrMaskContacts });
                        alert('EMR configuration saved!');
                    };

                    const testEmrConnection = async () => {
                        setEmrTesting(true);
                        setEmrTestResult(null);
                        // Temporarily update config so test uses latest values
                        useEMRStore.getState().updateConfig({ endpointUrl: emrUrl, apiKey: emrKey });
                        const result = await useEMRStore.getState().testConnection();
                        setEmrTestResult(result);
                        setEmrTesting(false);
                    };

                    return (
                        <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                            <div className="flex justify-between items-center mb-6 border-b pb-2">
                                <h2 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-teal-600" /> EMR Integration
                                </h2>
                                <div className="flex items-center gap-3">
                                    <button type="button" onClick={testEmrConnection} disabled={emrTesting || !emrUrl}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm disabled:opacity-40 transition-colors">
                                        {emrTesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                                        Test Connection
                                    </button>
                                    <button type="button" onClick={saveEmrConfig}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm">
                                        <Save className="w-3 h-3" /> Save EMR Config
                                    </button>
                                </div>
                            </div>

                            {emrTestResult && (
                                <div className={`mb-4 p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${emrTestResult.success
                                    ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                    : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                                    }`}>
                                    {emrTestResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                    {emrTestResult.message}
                                </div>
                            )}

                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                Configure the external Electronic Medical Records system to push client registration documents.
                            </p>

                            {/* Enable Toggle */}
                            <div className="mb-4">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <div className={`relative w-11 h-6 rounded-full transition-colors ${emrEnabled ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                                        onClick={() => setEmrEnabled(!emrEnabled)}>
                                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${emrEnabled ? 'translate-x-5' : ''}`} />
                                    </div>
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {emrEnabled ? 'EMR Integration Enabled' : 'EMR Integration Disabled'}
                                    </span>
                                </label>
                            </div>

                            {/* Mask Contact Info Toggle */}
                            <div className="mb-5">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <div className={`relative w-11 h-6 rounded-full transition-colors ${emrMaskContacts ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                                        onClick={() => setEmrMaskContacts(!emrMaskContacts)}>
                                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${emrMaskContacts ? 'translate-x-5' : ''}`} />
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            {emrMaskContacts ? 'Mask Contact Info on Export' : 'Contact Info Visible on Export'}
                                        </span>
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                            When enabled, mobile number, WhatsApp number, and email will be masked when sending client details to external systems.
                                        </p>
                                    </div>
                                </label>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Endpoint URL */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">EMR Endpoint URL</label>
                                    <input type="text" value={emrUrl} onChange={e => setEmrUrl(e.target.value)}
                                        placeholder="https://emr-api.example.com/api/patients"
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 dark:bg-gray-700 dark:text-white sm:text-sm" />
                                </div>

                                {/* API Key */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key</label>
                                    <div className="relative">
                                        <input type={showEmrKey ? 'text' : 'password'} value={emrKey} onChange={e => setEmrKey(e.target.value)}
                                            placeholder="Enter EMR API key"
                                            className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 dark:bg-gray-700 dark:text-white sm:text-sm" />
                                        <button type="button" onClick={() => setShowEmrKey(!showEmrKey)}
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600">
                                            {showEmrKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Webhook Info */}
                            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600">
                                <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">Client Export Webhook</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                    External systems can pull masked client data via this endpoint:
                                </p>
                                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-teal-700 dark:text-teal-400 block overflow-x-auto">
                                    GET /api/admin/clients/export?apiKey=YOUR_KEY
                                </code>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                    Contact info is always masked on this endpoint. Use the API Key above for authentication.
                                </p>
                            </div>
                        </section>
                    );
                })()}

                {/* Integration APIs */}
                <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-6 border-b pb-2">Integration APIs</h2>

                    <div className="space-y-8">
                        {/* Stripe */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">💳 Stripe (Payments)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {renderInput('Publishable Key', 'stripePublishableKey')}
                                {renderInput('Secret Key', 'stripeSecretKey', 'password')}
                            </div>
                        </div>

                        {/* OpenAI */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">🧠 OpenAI (Voice Assistant)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {renderInput('API Key', 'openaiApiKey', 'password')}
                            </div>
                        </div>

                        {/* CRM */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">📋 CRM / High Level</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {renderInput('API Key', 'crmApiKey', 'password')}
                                {renderInput('Endpoint URL', 'crmEndpoint', 'text', 'https://api.gohighlevel.com/v1')}
                            </div>
                        </div>

                        {/* Google Maps */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">🗺️ Google Maps</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {renderInput('API Key', 'googleMapsApiKey', 'password')}
                            </div>
                        </div>

                        {/* Meta / Facebook */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">📱 Meta / Facebook</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {renderInput('App ID', 'metaAppId')}
                                {renderInput('App Secret', 'metaAppSecret', 'password')}
                                {renderInput('Messenger Access Token', 'messengerAccessToken', 'password')}
                                {renderInput('Webhook Verify Token', 'verifyToken')}
                            </div>
                        </div>
                    </div>
                </section>
            </form>
        </div>
    );
}

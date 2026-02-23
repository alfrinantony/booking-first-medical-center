'use client';

import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '@/lib/settings-store';
import { Save, Eye, EyeOff, Bell } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
    const { settings, updateSettings } = useSettingsStore();
    const [formData, setFormData] = useState(settings);
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
    const [isClient, setIsClient] = useState(false);

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

                        {/* LiveAvatar */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">🤖 LiveAvatar (AI Avatar)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {renderInput('API Key', 'liveAvatarApiKey', 'password')}
                                {renderInput('Avatar ID', 'liveAvatarAvatarId')}
                                {renderInput('Mode', 'liveAvatarMode', 'text', 'LITE')}
                            </div>
                        </div>

                        {/* LiveKit */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">📹 LiveKit (Video / Real-time)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {renderInput('API Key', 'livekitApiKey', 'password')}
                                {renderInput('API Secret', 'livekitApiSecret', 'password')}
                                {renderInput('Server URL', 'livekitUrl', 'text', 'wss://your-server.livekit.cloud')}
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

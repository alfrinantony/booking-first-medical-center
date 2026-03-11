'use client';

import React, { useState, useEffect } from 'react';
import { AppSettings } from '@/lib/settings-store';
import { timeSlots, clinics as allClinics } from '@/lib/data';
import { Save, Eye, EyeOff, Bell, Activity, Loader2, CheckCircle2, XCircle, Star, Cloud, Bot, CreditCard, Megaphone, Phone, Server, Fingerprint, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { EMRConfig } from '@/lib/emr-store';

const DEFAULT_SETTINGS: AppSettings = {
    companyName: 'First Medical Center LLC', contactEmail: 'admin@bookingfirst.com',
    emailHost: 'smtp.gmail.com', emailPort: 587, emailUser: '', emailPass: '',
    twilioSid: '', twilioAuthToken: '', twilioFrom: '',
    metaAppId: '', metaAppSecret: '', metaPhoneId: '', metaPageId: '', metaIgUserId: '', messengerAccessToken: '', whatsappAccessToken: '', verifyToken: 'my_secure_verify_token',
    stripePublishableKey: '', stripeSecretKey: '', openaiApiKey: '',
    crmApiKey: '', crmEndpoint: '', googleMapsApiKey: '',
    zktecoHost: '192.168.1.200', zktecoPort: 4370, zktecoUsername: 'admin', zktecoPassword: '', zktecoDeviceSn: 'SFVL-2024-00001',
    workStartTime: '09:00', lateThresholdMinutes: 15, halfDayHours: 4, fullDayHours: 8,
    googleReviewUrls: {},
    // New fields
    metricoolApiToken: '', metricoolUserId: '', metricoolBlogId: '',
    livekitApiKey: '', livekitApiSecret: '', livekitUrl: '',
    liveAvatarApiKey: '', liveAvatarAvatarId: '', liveAvatarMode: 'LITE',
    azureOpenaiEndpoint: '', azureOpenaiApiKey: '', azureOpenaiDeployment: 'gpt-4o-mini',
    azureStorageConnectionString: '', azureStorageContainer: 'fmc-documents',
    googleAdsCustomerId: '',
    metaAdsAccountId: '', metaAdsAccessToken: '',
    openaiCallCenterApiKey: '', callAgentApiKey: '',
};

export default function SettingsPage() {
    const [formData, setFormData] = useState<AppSettings>(DEFAULT_SETTINGS);
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
    const [isClient, setIsClient] = useState(false);
    const [localPeakDays, setLocalPeakDays] = useState<number[]>([]);
    const [localPeakSlots, setLocalPeakSlots] = useState<string[]>([]);
    const [localRestrictionDays, setLocalRestrictionDays] = useState(7);

    // EMR Integration state
    const [emrUrl, setEmrUrl] = useState('');
    const [emrKey, setEmrKey] = useState('');
    const [emrEnabled, setEmrEnabled] = useState(false);
    const [emrMaskContacts, setEmrMaskContacts] = useState(true);
    const [showEmrKey, setShowEmrKey] = useState(false);
    const [emrTesting, setEmrTesting] = useState(false);
    const [emrTestResult, setEmrTestResult] = useState<{ success: boolean; message: string } | null>(null);

    useEffect(() => {
        setIsClient(true);
        // Load settings
        fetch('/api/admin/settings').then(r => r.json()).then(s => setFormData(s)).catch(() => {});
        // Load restrictions
        fetch('/api/admin/restrictions').then(r => r.json()).then(d => {
            setLocalPeakDays(d.peakDays || []);
            setLocalPeakSlots(d.peakSlots || []);
            setLocalRestrictionDays(d.noShowRestrictionDays || 7);
        }).catch(() => {});
        // Load EMR config
        fetch('/api/admin/emr').then(r => r.json()).then((c: EMRConfig) => {
            setEmrUrl(c.endpointUrl || '');
            setEmrKey(c.apiKey || '');
            setEmrEnabled(c.enabled || false);
            setEmrMaskContacts(c.maskContacts ?? true);
        }).catch(() => {});
    }, []);

    if (!isClient) return <div className="p-8">Loading settings...</div>;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        await fetch('/api/admin/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
        });
        alert('Settings saved successfully!');
    };

    const toggleSecret = (field: string) => {
        setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }));
    };

    type ScalarSettingsKey = { [K in keyof AppSettings]: AppSettings[K] extends string | number ? K : never }[keyof AppSettings];
    const renderInput = (label: string, name: ScalarSettingsKey, type: 'text' | 'password' = 'text', placeholder = '') => (
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

    // Section component for consistent styling
    const Section = ({ icon, title, color, children, extra }: { icon: React.ReactNode; title: string; color?: string; children: React.ReactNode; extra?: React.ReactNode }) => (
        <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-6 border-b border-gray-200 dark:border-gray-700 pb-3">
                <h2 className={`text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2 ${color || ''}`}>
                    {icon} {title}
                </h2>
                {extra}
            </div>
            {children}
        </section>
    );

    const SubSection = ({ label, children }: { label: string; children: React.ReactNode }) => (
        <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">{label}</h3>
            {children}
        </div>
    );

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Settings</h1>
                    <p className="text-gray-600 dark:text-gray-400">Configure application settings, API keys, and integrations.</p>
                </div>
                <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <Save className="w-4 h-4" />
                    Save All
                </button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">

                {/* ── 1. General Information ── */}
                <Section icon="🏢" title="General Information">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {renderInput('Company Name', 'companyName')}
                        {renderInput('Contact Email', 'contactEmail', 'text')}
                    </div>
                </Section>

                {/* ── 2. Communication ── */}
                <Section icon={<Phone className="w-5 h-5 text-blue-600" />} title="Communication">
                    <div className="space-y-8">
                        <div className="flex justify-end -mt-4 mb-2">
                            <Link href="/admin/settings/notifications"
                                className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                                <Bell className="w-4 h-4" /> Manage Notification Rules
                            </Link>
                        </div>

                        <SubSection label="📧 Email Configuration (SMTP)">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {renderInput('SMTP Host', 'emailHost')}
                                {renderInput('SMTP Port', 'emailPort')}
                                {renderInput('SMTP User', 'emailUser')}
                                {renderInput('SMTP Password', 'emailPass', 'password')}
                            </div>
                        </SubSection>

                        <SubSection label="📱 SMS Configuration (Twilio)">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {renderInput('Twilio Account SID', 'twilioSid')}
                                {renderInput('Twilio Auth Token', 'twilioAuthToken', 'password')}
                                {renderInput('Twilio From Number', 'twilioFrom')}
                            </div>
                        </SubSection>

                        <SubSection label="💬 WhatsApp Configuration (Meta)">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {renderInput('Meta Phone ID', 'metaPhoneId')}
                                {renderInput('WhatsApp Access Token', 'whatsappAccessToken', 'password')}
                            </div>
                        </SubSection>
                    </div>
                </Section>

                {/* ── 3. AI & Voice Assistants ── */}
                <Section icon={<Bot className="w-5 h-5 text-purple-600" />} title="AI & Voice Assistants">
                    <div className="space-y-8">
                        <SubSection label="🧠 Azure OpenAI">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {renderInput('Endpoint URL', 'azureOpenaiEndpoint', 'text', 'https://your-resource.openai.azure.com/')}
                                {renderInput('API Key', 'azureOpenaiApiKey', 'password')}
                                {renderInput('Deployment Name', 'azureOpenaiDeployment', 'text', 'gpt-4o-mini')}
                            </div>
                        </SubSection>

                        <SubSection label="🎙️ OpenAI (Whisper STT + GPT)">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {renderInput('OpenAI API Key', 'openaiApiKey', 'password')}
                            </div>
                        </SubSection>

                        <SubSection label="📞 OpenAI Call Center Agent (Realtime Booking)">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {renderInput('Call Center API Key', 'openaiCallCenterApiKey', 'password')}
                            </div>
                        </SubSection>

                        <SubSection label="🎥 LiveKit (WebRTC Video Avatar)">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {renderInput('API Key', 'livekitApiKey', 'password')}
                                {renderInput('API Secret', 'livekitApiSecret', 'password')}
                                {renderInput('WebSocket URL', 'livekitUrl', 'text', 'wss://your-app.livekit.cloud')}
                            </div>
                        </SubSection>

                        <SubSection label="🤖 LiveAvatar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {renderInput('API Key', 'liveAvatarApiKey', 'password')}
                                {renderInput('Avatar ID', 'liveAvatarAvatarId')}
                                {renderInput('Mode', 'liveAvatarMode', 'text', 'LITE')}
                            </div>
                        </SubSection>
                    </div>
                </Section>

                {/* ── 4. Social Media & Marketing ── */}
                <Section icon={<Megaphone className="w-5 h-5 text-pink-600" />} title="Social Media & Marketing">
                    <div className="space-y-8">
                        <SubSection label="📊 Metricool (Analytics & Social Inbox)">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {renderInput('API Token', 'metricoolApiToken', 'password')}
                                {renderInput('User ID', 'metricoolUserId')}
                                {renderInput('Blog ID', 'metricoolBlogId')}
                            </div>
                        </SubSection>

                        <SubSection label="📱 Meta Ads (Facebook / Instagram Ads)">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {renderInput('Ads Account ID', 'metaAdsAccountId')}
                                {renderInput('Ads Access Token', 'metaAdsAccessToken', 'password')}
                            </div>
                        </SubSection>

                        <SubSection label="📱 Meta / Facebook (Messenger, DMs & Webhooks)">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {renderInput('App ID', 'metaAppId')}
                                {renderInput('App Secret', 'metaAppSecret', 'password')}
                                {renderInput('Page ID', 'metaPageId', 'text', 'Your Facebook Page ID')}
                                {renderInput('IG Business User ID', 'metaIgUserId', 'text', 'Instagram Business Account ID')}
                                {renderInput('Page Access Token (Messenger)', 'messengerAccessToken', 'password')}
                                {renderInput('Webhook Verify Token', 'verifyToken')}
                            </div>
                            <p className="text-xs text-gray-400 mt-2">
                                Page ID and IG User ID are required for Facebook Messenger & Instagram DMs in the inbox.
                            </p>
                        </SubSection>

                        <SubSection label="📣 Google Ads">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {renderInput('Customer ID', 'googleAdsCustomerId', 'text', '370-832-5833')}
                            </div>
                        </SubSection>

                        <SubSection label="🗺️ Google Maps & Places">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {renderInput('API Key', 'googleMapsApiKey', 'password')}
                            </div>
                        </SubSection>

                        {/* Google Review URLs */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Star className="w-4 h-4 text-yellow-500" /> Google Review URLs
                            </h3>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                                Set the Google review page URL for each branch. Customers will see these links in their dashboard.
                            </p>
                            <div className="space-y-3">
                                {allClinics.map(clinic => (
                                    <div key={clinic.id} className="mb-3">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{clinic.name}</label>
                                        <input
                                            type="text"
                                            value={formData.googleReviewUrls?.[clinic.id] || ''}
                                            onChange={e => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    googleReviewUrls: {
                                                        ...prev.googleReviewUrls,
                                                        [clinic.id]: e.target.value,
                                                    },
                                                }));
                                            }}
                                            placeholder="https://g.page/r/your-branch/review"
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </Section>

                {/* ── 5. Payments ── */}
                <Section icon={<CreditCard className="w-5 h-5 text-green-600" />} title="Payments">
                    <SubSection label="💳 Stripe">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {renderInput('Publishable Key', 'stripePublishableKey')}
                            {renderInput('Secret Key', 'stripeSecretKey', 'password')}
                        </div>
                    </SubSection>
                </Section>

                {/* ── 6. CRM & EMR ── */}
                <Section icon={<Activity className="w-5 h-5 text-teal-600" />} title="CRM & EMR">
                    <div className="space-y-8">
                        <SubSection label="📋 CRM / High Level">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {renderInput('API Key', 'crmApiKey', 'password')}
                                {renderInput('Endpoint URL', 'crmEndpoint', 'text', 'https://api.gohighlevel.com/v1')}
                            </div>
                        </SubSection>

                        {/* EMR Integration (inline block) */}
                        {(() => {
                            const saveEmrConfig = async () => {
                                await fetch('/api/admin/emr', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ action: 'updateConfig', updates: { endpointUrl: emrUrl, apiKey: emrKey, enabled: emrEnabled, maskContacts: emrMaskContacts } }),
                                });
                                alert('EMR configuration saved!');
                            };

                            const testEmrConnection = async () => {
                                setEmrTesting(true);
                                setEmrTestResult(null);
                                await fetch('/api/admin/emr', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ action: 'updateConfig', updates: { endpointUrl: emrUrl, apiKey: emrKey } }),
                                });
                                const res = await fetch('/api/admin/emr', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ action: 'testConnection' }),
                                });
                                const result = await res.json();
                                setEmrTestResult(result);
                                setEmrTesting(false);
                            };

                            return (
                                <div>
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">🏥 EMR Integration</h3>
                                        <div className="flex items-center gap-3">
                                            <button type="button" onClick={testEmrConnection} disabled={emrTesting || !emrUrl}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm disabled:opacity-40 transition-colors">
                                                {emrTesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                                                Test Connection
                                            </button>
                                            <button type="button" onClick={saveEmrConfig}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm">
                                                <Save className="w-3 h-3" /> Save EMR
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
                                                    When enabled, mobile, WhatsApp, and email will be masked when sending to external systems.
                                                </p>
                                            </div>
                                        </label>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="mb-4">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">EMR Endpoint URL</label>
                                            <input type="text" value={emrUrl} onChange={e => setEmrUrl(e.target.value)}
                                                placeholder="https://emr-api.example.com/api/patients"
                                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 dark:bg-gray-700 dark:text-white sm:text-sm" />
                                        </div>
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

                                    <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600">
                                        <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">Client Export Webhook</h4>
                                        <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-teal-700 dark:text-teal-400 block overflow-x-auto">
                                            GET /api/admin/clients/export?apiKey=YOUR_KEY
                                        </code>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </Section>

                {/* ── 7. Cloud Infrastructure ── */}
                <Section icon={<Cloud className="w-5 h-5 text-sky-600" />} title="Cloud Infrastructure">
                    <SubSection label="☁️ Azure Blob Storage">
                        <div className="grid grid-cols-1 gap-6">
                            {renderInput('Connection String', 'azureStorageConnectionString', 'password')}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                            {renderInput('Container Name', 'azureStorageContainer', 'text', 'fmc-documents')}
                        </div>
                    </SubSection>
                </Section>

                {/* ── 8. Attendance & Devices ── */}
                <Section icon={<Fingerprint className="w-5 h-5 text-orange-600" />} title="Attendance & Devices">
                    <div className="space-y-8">
                        <SubSection label="📷 ZKTeco SpeedFace-V5L">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {renderInput('Device Host IP', 'zktecoHost', 'text', '192.168.1.200')}
                                {renderInput('Port', 'zktecoPort')}
                                {renderInput('Username', 'zktecoUsername')}
                                {renderInput('Password', 'zktecoPassword', 'password')}
                                {renderInput('Device Serial No', 'zktecoDeviceSn')}
                            </div>
                        </SubSection>

                        <SubSection label="⏰ Work Policy">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {renderInput('Work Start Time', 'workStartTime', 'text', '09:00')}
                                {renderInput('Late Threshold (min)', 'lateThresholdMinutes')}
                                {renderInput('Half Day Hours', 'halfDayHours')}
                                {renderInput('Full Day Hours', 'fullDayHours')}
                            </div>
                        </SubSection>
                    </div>
                </Section>

                {/* ── 9. Booking Restrictions ── */}
                {(() => {
                    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

                    const toggleDay = (day: number) => {
                        setLocalPeakDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
                    };
                    const toggleSlot = (slot: string) => {
                        setLocalPeakSlots(prev => prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot]);
                    };
                    const savePeakConfig = async () => {
                        await fetch('/api/admin/restrictions', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'setPeakConfig', days: localPeakDays, slots: localPeakSlots }),
                        });
                        await fetch('/api/admin/restrictions', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'setNoShowRestrictionDays', days: localRestrictionDays }),
                        });
                        alert('Peak schedule & restrictions saved!');
                    };

                    return (
                        <Section
                            icon={<ShieldAlert className="w-5 h-5 text-orange-600" />}
                            title="Booking Restrictions"
                            extra={
                                <button type="button" onClick={savePeakConfig} className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm">
                                    <Save className="w-3 h-3" /> Save Peak Config
                                </button>
                            }
                        >
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
                        </Section>
                    );
                })()}

                {/* ── 10. Call Agent ── */}
                <Section icon={<Server className="w-5 h-5 text-gray-600" />} title="External Call Agent">
                    <SubSection label="🔑 Call Agent Summary API">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            API key used by the external call agent to submit call summaries to this system.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {renderInput('Call Agent API Key', 'callAgentApiKey', 'password')}
                        </div>
                    </SubSection>
                </Section>

            </form>
        </div>
    );
}

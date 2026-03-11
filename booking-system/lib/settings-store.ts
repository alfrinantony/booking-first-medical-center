// ─────────────────────────────────────────────────────────────
// Settings Store — App-wide settings with Azure Blob persistence
// ─────────────────────────────────────────────────────────────

import { loadFromBlob, saveToBlob } from './blob-persistence';

export interface AppSettings {
    companyName: string;
    contactEmail: string;

    // Email (SMTP)
    emailHost: string;
    emailPort: number;
    emailUser: string;
    emailPass: string;

    // SMS (Twilio)
    twilioSid: string;
    twilioAuthToken: string;
    twilioFrom: string;

    // Meta / Facebook
    metaAppId: string;
    metaAppSecret: string;
    metaPhoneId: string;
    metaPageId: string;          // Facebook Page ID for Messenger DMs
    metaIgUserId: string;        // Instagram Business User ID for IG DMs
    messengerAccessToken: string;
    whatsappAccessToken: string;
    verifyToken: string;

    // Stripe (Payments)
    stripePublishableKey: string;
    stripeSecretKey: string;

    // OpenAI (Whisper STT + GPT)
    openaiApiKey: string;

    // CRM / High Level
    crmApiKey: string;
    crmEndpoint: string;

    // Google Maps
    googleMapsApiKey: string;

    // ZKTeco SpeedFace-V5L
    zktecoHost: string;
    zktecoPort: number;
    zktecoUsername: string;
    zktecoPassword: string;
    zktecoDeviceSn: string;

    // Attendance Work Policy
    workStartTime: string;
    lateThresholdMinutes: number;
    halfDayHours: number;
    fullDayHours: number;

    // Google Review URLs (per clinic/branch)
    googleReviewUrls: Record<string, string>;

    // ── New fields ──

    // Metricool (Social Media Analytics & Inbox)
    metricoolApiToken: string;
    metricoolUserId: string;
    metricoolBlogId: string;

    // LiveKit (WebRTC Video Avatar)
    livekitApiKey: string;
    livekitApiSecret: string;
    livekitUrl: string;

    // LiveAvatar
    liveAvatarApiKey: string;
    liveAvatarAvatarId: string;
    liveAvatarMode: string;

    // Azure OpenAI
    azureOpenaiEndpoint: string;
    azureOpenaiApiKey: string;
    azureOpenaiDeployment: string;

    // Azure Blob Storage
    azureStorageConnectionString: string;
    azureStorageContainer: string;

    // Google Ads
    googleAdsCustomerId: string;

    // Meta Ads (Facebook/Instagram Ads)
    metaAdsAccountId: string;
    metaAdsAccessToken: string;

    // OpenAI Call Center Agent (Realtime booking)
    openaiCallCenterApiKey: string;

    // External Call Agent API
    callAgentApiKey: string;
}

const DEFAULT_SETTINGS: AppSettings = {
    companyName: 'First Medical Center LLC',
    contactEmail: 'admin@bookingfirst.com',

    emailHost: 'smtp.gmail.com',
    emailPort: 587,
    emailUser: '',
    emailPass: '',

    twilioSid: '',
    twilioAuthToken: '',
    twilioFrom: '',

    metaAppId: '',
    metaAppSecret: '',
    metaPhoneId: '',
    metaPageId: '',
    metaIgUserId: '',
    messengerAccessToken: '',
    whatsappAccessToken: '',
    verifyToken: 'my_secure_verify_token',

    stripePublishableKey: '',
    stripeSecretKey: '',

    openaiApiKey: '',

    crmApiKey: '',
    crmEndpoint: '',

    googleMapsApiKey: '',

    zktecoHost: '192.168.1.200',
    zktecoPort: 4370,
    zktecoUsername: 'admin',
    zktecoPassword: '',
    zktecoDeviceSn: 'SFVL-2024-00001',

    workStartTime: '09:00',
    lateThresholdMinutes: 15,
    halfDayHours: 4,
    fullDayHours: 8,

    googleReviewUrls: {
        'clinic-1': 'https://maps.google.com/?cid=7431063405124527074',
        'clinic-2': 'https://maps.google.com/?cid=6599779727377220868',
        'clinic-3': 'https://maps.google.com/?cid=13746671430218161081',
    },

    // New defaults
    metricoolApiToken: '',
    metricoolUserId: '',
    metricoolBlogId: '',

    livekitApiKey: '',
    livekitApiSecret: '',
    livekitUrl: '',

    liveAvatarApiKey: '',
    liveAvatarAvatarId: '',
    liveAvatarMode: 'LITE',

    azureOpenaiEndpoint: '',
    azureOpenaiApiKey: '',
    azureOpenaiDeployment: 'gpt-4o-mini',

    azureStorageConnectionString: '',
    azureStorageContainer: 'fmc-documents',

    googleAdsCustomerId: '',

    metaAdsAccountId: '',
    metaAdsAccessToken: '',

    openaiCallCenterApiKey: '',

    callAgentApiKey: '',
};

// ── In-memory store ──
let settings: AppSettings = { ...DEFAULT_SETTINGS };
let settingsLoaded = false;

async function ensureSettingsLoaded() {
    if (!settingsLoaded) {
        const data = await loadFromBlob<{ settings: AppSettings }>('settings', { settings: DEFAULT_SETTINGS });
        settings = data.settings;
        settingsLoaded = true;
    }
}

async function saveSettings() {
    await saveToBlob('settings', { settings });
}

export const SettingsStore = {
    getSettings: async (): Promise<AppSettings> => {
        await ensureSettingsLoaded();
        return { ...settings };
    },

    updateSettings: async (updates: Partial<AppSettings>) => {
        await ensureSettingsLoaded();
        settings = { ...settings, ...updates };
        await saveSettings();
    },
};

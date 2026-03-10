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

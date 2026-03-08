import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

interface SettingsState {
    settings: AppSettings;
    updateSettings: (updates: Partial<AppSettings>) => void;
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
        'clinic-1': 'https://g.page/r/first-medical-muraqabat/review',
        'clinic-2': 'https://g.page/r/first-medical-qiyadah/review',
        'clinic-3': 'https://g.page/r/first-medical-silicon/review',
    },
};

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            settings: DEFAULT_SETTINGS,
            updateSettings: (updates) => set((state) => ({
                settings: { ...state.settings, ...updates }
            })),
        }),
        {
            name: 'app-settings-storage', // unique name
        }
    )
);

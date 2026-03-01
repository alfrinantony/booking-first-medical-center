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

import { loadFromBlob, saveToBlob } from './blob-persistence';

export interface NotificationConfig {
    id: string;
    type: 'email' | 'sms' | 'whatsapp';
    timing: number; // hours before appointment
    enabled: boolean;
    template: string;
}

const initialConfigs: NotificationConfig[] = [
    {
        id: 'notif-1',
        type: 'email',
        timing: 24,
        enabled: true,
        template: "Hi {name}, this is a reminder for your appointment tomorrow at {time} with Dr. {doctor}."
    },
    {
        id: 'notif-2',
        type: 'sms',
        timing: 2,
        enabled: true,
        template: "Reminder: Appt with Dr. {doctor} at {time}. Reply C to confirm."
    }
];

let configs: NotificationConfig[] = [...initialConfigs];
async function ensureNotifLoaded() {
    
        configs = await loadFromBlob<NotificationConfig[]>('notifications', initialConfigs);
        
}

export const NotificationStore = {
    getAll: async () => { await ensureNotifLoaded(); return configs; },

    update: async (id: string, updates: Partial<NotificationConfig>) => {
        await ensureNotifLoaded();
        const index = configs.findIndex(c => c.id === id);
        if (index !== -1) {
            configs[index] = { ...configs[index], ...updates };
            await saveToBlob('notifications', configs);
            return configs[index];
        }
        return null;
    },

    add: async (config: Omit<NotificationConfig, 'id'>) => {
        await ensureNotifLoaded();
        const newConfig = {
            ...config,
            id: `notif-${Date.now()}`
        };
        configs.push(newConfig);
        await saveToBlob('notifications', configs);
        return newConfig;
    },

    delete: async (id: string) => {
        await ensureNotifLoaded();
        configs = configs.filter(c => c.id !== id);
        await saveToBlob('notifications', configs);
    }
};

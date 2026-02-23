export interface NotificationConfig {
    id: string;
    type: 'email' | 'sms' | 'whatsapp';
    timing: number; // hours before appointment
    enabled: boolean;
    template: string;
}

let configs: NotificationConfig[] = [
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

export const NotificationStore = {
    getAll: () => configs,

    update: (id: string, updates: Partial<NotificationConfig>) => {
        const index = configs.findIndex(c => c.id === id);
        if (index !== -1) {
            configs[index] = { ...configs[index], ...updates };
            return configs[index];
        }
        return null;
    },

    add: (config: Omit<NotificationConfig, 'id'>) => {
        const newConfig = {
            ...config,
            id: `notif-${Date.now()}`
        };
        configs.push(newConfig);
        return newConfig;
    },

    delete: (id: string) => {
        configs = configs.filter(c => c.id !== id);
    }
};

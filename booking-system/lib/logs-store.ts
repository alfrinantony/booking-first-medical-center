export interface LogEntry {
    id: string;
    timestamp: string;
    userId: string; // ID of the user performing the action
    userName?: string; // Optional readable name
    action: string; // e.g., 'CREATE_BOOKING', 'UPDATE_CLIENT', 'MERGE_CLIENTS'
    details: string; // Description of the change
    entityId?: string; // ID of the affected object (Booking ID, Client ID)
    entityType?: string; // 'Booking', 'Client', 'System'
}

// In-memory store for logs (mocking a database)
// In a real app, this would be a database table
const logs: LogEntry[] = [
    {
        id: 'log-1',
        timestamp: new Date(Date.now() - 10000000).toISOString(),
        userId: 'admin-1',
        userName: 'System Admin',
        action: 'SYSTEM_INIT',
        details: 'System initialized',
        entityType: 'System'
    }
];

export const LogsStore = {
    getAll: () => {
        return [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    },

    add: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
        const newLog: LogEntry = {
            id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            timestamp: new Date().toISOString(),
            ...entry
        };
        logs.unshift(newLog); // Add to beginning
        return newLog;
    }
};

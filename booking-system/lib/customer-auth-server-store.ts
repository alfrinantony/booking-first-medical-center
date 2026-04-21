// ─────────────────────────────────────────────────────────────
// Server-Side Customer Auth Store — Azure Blob Persistence
// ─────────────────────────────────────────────────────────────
// Mirrors the pattern from users-store.ts.  Stores registered
// customer accounts in blob key "registered-customers".
// ─────────────────────────────────────────────────────────────

import { loadFromBlob, saveToBlob } from './blob-persistence';

export interface RegisteredCustomer {
    id: string;
    name: string;
    email: string;
    phone: string;
    gender?: string;
    dateOfBirth?: string;
    passwordHash: string;
    emailVerified: boolean;
    blocked: boolean;
    createdAt: string;
    connectedPatients?: { patientPhone: string; relationship: string }[];
    // Migration tracking
    source?: 'app' | 'simplybook'; // origin of the account
    sbClientId?: string;           // SimplyBook client ID for traceability
}

// In-memory cache — loaded from blob on first access
let customers: RegisteredCustomer[] = [];
let loaded = false;

async function ensureLoaded() {
    if (!loaded) {
        customers = await loadFromBlob<RegisteredCustomer[]>('registered-customers', []);
        loaded = true;
    }
}

export const CustomerAuthServerStore = {
    getAll: async (): Promise<RegisteredCustomer[]> => {
        await ensureLoaded();
        return customers;
    },

    getById: async (id: string): Promise<RegisteredCustomer | undefined> => {
        await ensureLoaded();
        return customers.find(c => c.id === id);
    },

    getByEmail: async (email: string): Promise<RegisteredCustomer | undefined> => {
        await ensureLoaded();
        return customers.find(c => c.email === email);
    },

    getByPhone: async (phone: string): Promise<RegisteredCustomer | undefined> => {
        await ensureLoaded();
        return customers.find(c => c.phone === phone);
    },

    getByIdentifier: async (identifier: string): Promise<RegisteredCustomer | undefined> => {
        await ensureLoaded();
        return customers.find(c => c.email === identifier || c.phone === identifier);
    },

    register: async (data: {
        name: string;
        email: string;
        phone: string;
        password: string;
        gender?: string;
        dateOfBirth?: string;
    }): Promise<{ success: boolean; message: string; user?: RegisteredCustomer }> => {
        await ensureLoaded();

        // Check duplicates
        if (customers.some(c => c.email === data.email)) {
            return { success: false, message: 'A user with this email already exists.' };
        }
        if (customers.some(c => c.phone === data.phone)) {
            return { success: false, message: 'A user with this phone number already exists.' };
        }

        const newUser: RegisteredCustomer = {
            id: `cust-${Date.now()}`,
            name: data.name,
            email: data.email,
            phone: data.phone,
            gender: data.gender,
            dateOfBirth: data.dateOfBirth || '',
            passwordHash: Buffer.from(data.password).toString('base64'), // same as btoa()
            emailVerified: false,
            blocked: false,
            createdAt: new Date().toISOString(),
        };

        customers.push(newUser);
        await saveToBlob('registered-customers', customers);
        return { success: true, message: 'Registration successful.', user: newUser };
    },

    login: async (identifier: string, password: string): Promise<{ success: boolean; message: string; user?: RegisteredCustomer }> => {
        await ensureLoaded();
        const user = customers.find(c => c.email === identifier || c.phone === identifier);

        if (!user) {
            return { success: false, message: 'User not found.' };
        }
        if (!user.emailVerified) {
            return { success: false, message: 'Please verify your email before logging in. Check your inbox for the verification code.' };
        }
        if (user.blocked) {
            return { success: false, message: 'Your account has been suspended. Please contact support.' };
        }
        if (user.passwordHash !== Buffer.from(password).toString('base64')) {
            return { success: false, message: 'Invalid password.' };
        }

        return { success: true, message: 'Login successful.', user };
    },

    verifyEmail: async (email: string): Promise<boolean> => {
        await ensureLoaded();
        const idx = customers.findIndex(c => c.email === email);
        if (idx === -1) return false;
        customers[idx] = { ...customers[idx], emailVerified: true };
        await saveToBlob('registered-customers', customers);
        return true;
    },

    resetPassword: async (identifier: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
        await ensureLoaded();
        const idx = customers.findIndex(c => c.email === identifier || c.phone === identifier);
        if (idx === -1) {
            return { success: false, message: 'No account found with this email or phone number.' };
        }
        customers[idx] = { ...customers[idx], passwordHash: Buffer.from(newPassword).toString('base64') };
        await saveToBlob('registered-customers', customers);
        return { success: true, message: 'Password has been reset successfully.' };
    },

    updateUser: async (id: string, updates: Partial<Omit<RegisteredCustomer, 'id' | 'createdAt'>>): Promise<RegisteredCustomer | null> => {
        await ensureLoaded();
        const idx = customers.findIndex(c => c.id === id);
        if (idx === -1) return null;
        customers[idx] = { ...customers[idx], ...updates };
        await saveToBlob('registered-customers', customers);
        return customers[idx];
    },

    blockUser: async (id: string): Promise<boolean> => {
        await ensureLoaded();
        const idx = customers.findIndex(c => c.id === id);
        if (idx === -1) return false;
        customers[idx] = { ...customers[idx], blocked: true };
        await saveToBlob('registered-customers', customers);
        return true;
    },

    unblockUser: async (id: string): Promise<boolean> => {
        await ensureLoaded();
        const idx = customers.findIndex(c => c.id === id);
        if (idx === -1) return false;
        customers[idx] = { ...customers[idx], blocked: false };
        await saveToBlob('registered-customers', customers);
        return true;
    },

    removeUser: async (id: string): Promise<boolean> => {
        await ensureLoaded();
        const initialLen = customers.length;
        customers = customers.filter(c => c.id !== id);
        if (customers.length < initialLen) {
            await saveToBlob('registered-customers', customers);
            return true;
        }
        return false;
    },

    adminResetPassword: async (id: string, newPassword: string): Promise<boolean> => {
        await ensureLoaded();
        const idx = customers.findIndex(c => c.id === id);
        if (idx === -1) return false;
        customers[idx] = { ...customers[idx], passwordHash: Buffer.from(newPassword).toString('base64') };
        await saveToBlob('registered-customers', customers);
        return true;
    },

    mergeUsers: async (targetId: string, sourceId: string): Promise<boolean> => {
        await ensureLoaded();
        const target = customers.find(c => c.id === targetId);
        const source = customers.find(c => c.id === sourceId);
        if (!target || !source) return false;

        const merged: RegisteredCustomer = {
            ...target,
            phone: target.phone || source.phone,
            email: target.email || source.email,
            name: target.name || source.name,
            dateOfBirth: target.dateOfBirth || source.dateOfBirth,
        };

        customers = customers
            .map(c => c.id === targetId ? merged : c)
            .filter(c => c.id !== sourceId);
        await saveToBlob('registered-customers', customers);
        return true;
    },
};

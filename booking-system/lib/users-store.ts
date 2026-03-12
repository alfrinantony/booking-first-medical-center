import { loadFromBlob, saveToBlob } from './blob-persistence';

// Re-export all types, constants, and helpers from the client-safe file
// so existing server-side imports from '@/lib/users-store' keep working.
export {
    type UserRole,
    type AssignedScope,
    type PermissionAction,
    PERMISSION_ACTIONS,
    PERMISSION_LABELS,
    type ModulePermissions,
    type ModuleDefinition,
    MODULE_GROUPS,
    MODULES,
    getDefaultPermissions,
    getFullPermissions,
    DESIGNATIONS_BY_DEPARTMENT,
    ALL_DESIGNATIONS,
    DEPARTMENTS,
    type Department,
    CLINICS,
    type User,
} from './users-types';

import type { User, ModulePermissions, PermissionAction } from './users-types';
import { getDefaultPermissions, getFullPermissions } from './users-types';

// Initial Seed Data
const initialUsers: User[] = [
    {
        id: 'user-admin-01',
        username: 'admin',
        password: 'password123',
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
        designation: 'Operations Manager',
        department: 'Operation',
        clinicIds: ['clinic-1', 'clinic-2', 'clinic-3', 'head-office'],
        isActive: true,
        permissions: getFullPermissions(),
        canManagePermissions: true,
    },
    {
        id: 'user-recep-01',
        username: 'reception1',
        password: 'password123',
        name: 'Sara Al Hammadi',
        role: 'STAFF',
        designation: 'Receptionist',
        department: 'Administration',
        clinicIds: ['clinic-1'],
        isActive: true,
        permissions: {
            ...getDefaultPermissions(),
            appointments: ['read', 'create', 'edit'],
            clients: ['read', 'create', 'edit'],
            billing: ['read', 'create', 'print'],
        },
        canManagePermissions: false,
    },
    {
        id: 'user-nurse-01',
        username: 'nurse1',
        password: 'password123',
        name: 'Maria Santos',
        role: 'STAFF',
        designation: 'Nurse',
        department: 'Clinical',
        clinicIds: ['clinic-1', 'clinic-2'],
        isActive: true,
        permissions: {
            ...getDefaultPermissions(),
            appointments: ['read', 'create', 'edit'],
            clients: ['read', 'edit'],
            schedule: ['read', 'edit'],
            doctors: ['read'],
        },
        canManagePermissions: false,
    },
    {
        id: 'user-doc-01',
        username: 'drkhan',
        password: 'password123',
        name: 'Dr. Imran Khan',
        role: 'DOCTOR',
        designation: 'Doctor',
        department: 'Clinical',
        clinicIds: ['clinic-1'],
        isActive: true,
        scope: { doctorId: 'doc-gp-1' },
        permissions: {
            ...getDefaultPermissions(),
            appointments: ['read', 'create', 'edit', 'print'],
            clients: ['read', 'edit'],
            schedule: ['read'],
            doctors: ['read', 'edit'],
            services: ['read'],
        },
        canManagePermissions: false,
    },
    {
        id: 'user-admin-02',
        username: 'branchmgr',
        password: 'password123',
        name: 'Ali Rashed',
        role: 'ADMIN',
        designation: 'Office Manager',
        department: 'Administration',
        clinicIds: ['clinic-3'],
        isActive: true,
        permissions: getFullPermissions(),
        canManagePermissions: true,
    },
    {
        id: 'user-lab-01',
        username: 'labtech1',
        password: 'password123',
        name: 'Priya Sharma',
        role: 'STAFF',
        designation: 'Lab Technician',
        department: 'Clinical',
        clinicIds: ['clinic-2'],
        isActive: false,
        permissions: {
            ...getDefaultPermissions(),
            inventory: ['read', 'create', 'edit'],
        },
        canManagePermissions: false,
    },
];

// In-memory cache — loaded from blob on first access
let users: User[] = [...initialUsers];
let loaded = false;

async function ensureLoaded() {
    if (!loaded) {
        users = await loadFromBlob<User[]>('users', initialUsers);
        loaded = true;
    }
}

export const UsersStore = {
    getUsers: async () => {
        await ensureLoaded();
        return users;
    },

    getUserById: async (id: string) => {
        await ensureLoaded();
        return users.find(u => u.id === id);
    },

    getUserByUsername: async (username: string) => {
        await ensureLoaded();
        return users.find(u => u.username === username);
    },

    addUser: async (user: Omit<User, 'id'>) => {
        await ensureLoaded();
        const newUser: User = {
            ...user,
            id: `user-${Date.now()}`
        };
        users.push(newUser);
        await saveToBlob('users', users);
        return newUser;
    },

    updateUser: async (id: string, updates: Partial<Omit<User, 'id'>>) => {
        await ensureLoaded();
        const index = users.findIndex(u => u.id === id);
        if (index === -1) return null;

        const updatedUser = { ...users[index], ...updates };
        users[index] = updatedUser;
        await saveToBlob('users', users);
        return updatedUser;
    },

    deleteUser: async (id: string) => {
        await ensureLoaded();
        const initialLen = users.length;
        users = users.filter(u => u.id !== id);
        if (users.length < initialLen) {
            await saveToBlob('users', users);
            return true;
        }
        return false;
    },

    // Simple mock authentication
    login: async (username: string, password: string): Promise<User | null> => {
        await ensureLoaded();
        const user = users.find(u => u.username === username && u.password === password);
        if (user && !user.isActive) return null;
        return user || null;
    },

    // Permission helpers
    hasPermission: async (userId: string, moduleKey: string, action: PermissionAction): Promise<boolean> => {
        await ensureLoaded();
        const user = users.find(u => u.id === userId);
        if (!user) return false;
        if (user.role === 'SUPER_ADMIN') return true;
        if (!user.permissions[moduleKey]) return false;
        return user.permissions[moduleKey].includes(action);
    },

    updatePermissions: async (userId: string, permissions: ModulePermissions) => {
        await ensureLoaded();
        const index = users.findIndex(u => u.id === userId);
        if (index === -1) return null;
        users[index] = { ...users[index], permissions };
        await saveToBlob('users', users);
        return users[index];
    },
};


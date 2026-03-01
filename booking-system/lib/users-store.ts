
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'DOCTOR' | 'STAFF';

export interface AssignedScope {
    clinicId?: string;
    departmentId?: string;
    doctorId?: string;
}

// ── Permission System ──
export type PermissionAction = 'read' | 'create' | 'edit' | 'delete' | 'download' | 'print';

export const PERMISSION_ACTIONS: PermissionAction[] = ['read', 'create', 'edit', 'delete', 'download', 'print'];

export const PERMISSION_LABELS: Record<PermissionAction, string> = {
    read: 'Read',
    create: 'Create',
    edit: 'Edit',
    delete: 'Delete',
    download: 'Download',
    print: 'Print',
};

export interface ModulePermissions {
    [moduleKey: string]: PermissionAction[];
}

export interface ModuleDefinition {
    key: string;
    label: string;
    group: string;
}

export const MODULE_GROUPS = [
    'Core',
    'Clinical',
    'Inventory & Supply',
    'Finance',
    'Communication',
    'HR & Admin',
    'System',
] as const;

export const MODULES: ModuleDefinition[] = [
    // Core
    { key: 'dashboard', label: 'Dashboard', group: 'Core' },
    { key: 'appointments', label: 'Appointments', group: 'Core' },
    { key: 'clients', label: 'Clients', group: 'Core' },
    { key: 'registered_users', label: 'Registered Users', group: 'Core' },
    // Clinical
    { key: 'schedule', label: 'Staff Schedule', group: 'Clinical' },
    { key: 'doctors', label: 'Doctors', group: 'Clinical' },
    { key: 'services', label: 'Services', group: 'Clinical' },
    // Inventory & Supply
    { key: 'inventory', label: 'Inventory', group: 'Inventory & Supply' },
    { key: 'branches', label: 'Branches & Contracts', group: 'Inventory & Supply' },
    { key: 'packages', label: 'Packages', group: 'Inventory & Supply' },
    // Finance
    { key: 'loyalty', label: 'Loyalty Points', group: 'Finance' },
    { key: 'billing', label: 'Billing', group: 'Finance' },
    { key: 'accounting', label: 'Accounting', group: 'Finance' },
    // Communication
    { key: 'client_grouping', label: 'Client Grouping', group: 'Communication' },
    { key: 'inbox', label: 'Inbox', group: 'Communication' },
    { key: 'promos', label: 'Promo Codes', group: 'Communication' },
    { key: 'call_agent', label: 'Call Agent Summary', group: 'Communication' },
    // HR & Admin
    { key: 'hr', label: 'HR Management', group: 'HR & Admin' },
    { key: 'staff_access', label: 'Staff Access', group: 'HR & Admin' },
    // System
    { key: 'settings', label: 'Settings & Notifications', group: 'System' },
    { key: 'audit_logs', label: 'Audit Logs', group: 'System' },
    { key: 'reports', label: 'Reports', group: 'System' },
];

// Helper to create default read-only permissions
export function getDefaultPermissions(): ModulePermissions {
    const perms: ModulePermissions = {};
    MODULES.forEach(m => {
        perms[m.key] = ['read'];
    });
    return perms;
}

// Helper to create full-access permissions
export function getFullPermissions(): ModulePermissions {
    const perms: ModulePermissions = {};
    MODULES.forEach(m => {
        perms[m.key] = [...PERMISSION_ACTIONS];
    });
    return perms;
}

// ── Designations grouped by department ──
export const DESIGNATIONS_BY_DEPARTMENT: Record<string, string[]> = {
    Clinical: [
        'Doctor',
        'Nurse',
        'Lab Technician',
        'Pharmacist',
        'Physiotherapist',
        'Radiologist',
        'Dental Hygienist',
    ],
    Administration: [
        'Receptionist',
        'Office Manager',
        'Billing Coordinator',
        'HR Coordinator',
        'IT Support',
    ],
    Operation: [
        'Operations Manager',
        'Facility Coordinator',
        'Procurement Officer',
        'Driver',
    ],
};

export const ALL_DESIGNATIONS = Object.values(DESIGNATIONS_BY_DEPARTMENT).flat();

export const DEPARTMENTS = ['Clinical', 'Administration', 'Operation'] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const CLINICS = [
    { id: 'clinic-1', name: 'Al Muraqabat Branch' },
    { id: 'clinic-2', name: 'Al Qiyadah Branch' },
    { id: 'clinic-3', name: 'Silicon Oasis Branch' },
    { id: 'head-office', name: 'Head Office' },
] as const;

export interface User {
    id: string;
    username: string;
    password?: string;
    name: string;
    role: UserRole;
    designation?: string;
    department?: string;
    clinicIds: string[];
    isActive: boolean;
    scope?: AssignedScope;
    permissions: ModulePermissions;
    canManagePermissions: boolean;  // ADMIN users with this flag can assign perms to STAFF/DOCTOR
}

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

// In-memory store
let users: User[] = [...initialUsers];

export const UsersStore = {
    getUsers: () => {
        return users;
    },

    getUserById: (id: string) => {
        return users.find(u => u.id === id);
    },

    getUserByUsername: (username: string) => {
        return users.find(u => u.username === username);
    },

    addUser: (user: Omit<User, 'id'>) => {
        const newUser: User = {
            ...user,
            id: `user-${Date.now()}`
        };
        users.push(newUser);
        return newUser;
    },

    updateUser: (id: string, updates: Partial<Omit<User, 'id'>>) => {
        const index = users.findIndex(u => u.id === id);
        if (index === -1) return null;

        const updatedUser = { ...users[index], ...updates };
        users[index] = updatedUser;
        return updatedUser;
    },

    deleteUser: (id: string) => {
        const initialLen = users.length;
        users = users.filter(u => u.id !== id);
        return users.length < initialLen;
    },

    // Simple mock authentication
    login: (username: string, password: string): User | null => {
        const user = users.find(u => u.username === username && u.password === password);
        if (user && !user.isActive) return null;
        return user || null;
    },

    // Permission helpers
    hasPermission: (userId: string, moduleKey: string, action: PermissionAction): boolean => {
        const user = users.find(u => u.id === userId);
        if (!user) return false;
        if (user.role === 'SUPER_ADMIN') return true; // SUPER_ADMIN always has full access
        if (!user.permissions[moduleKey]) return false;
        return user.permissions[moduleKey].includes(action);
    },

    updatePermissions: (userId: string, permissions: ModulePermissions) => {
        const index = users.findIndex(u => u.id === userId);
        if (index === -1) return null;
        users[index] = { ...users[index], permissions };
        return users[index];
    },
};

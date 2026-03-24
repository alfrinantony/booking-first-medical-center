/**
 * Client-safe types, constants, and helpers from the users/permissions system.
 * Import this file in client components instead of users-store.ts,
 * which pulls in server-only blob-persistence code.
 */

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
    { key: 'reassign_doctor', label: 'Re-assign Doctor (Appointments)', group: 'Core' },
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

// ── Login Restrictions ──
export interface LoginRestrictions {
    enabled: boolean;
    allowedCountries?: string[];          // ISO 3166-1 alpha-2 codes (e.g. ['AE'])
    allowedIPs?: string[];                // Exact IP addresses
    geofence?: {
        enabled: boolean;
        radiusMeters: number;             // Max distance from branch
        branchId: string;                 // Branch to anchor the fence
    };
    timeWindow?: {
        enabled: boolean;
        startTime: string;                // HH:mm (24h)
        endTime: string;                  // HH:mm (24h)
        allowedDays: number[];            // 0=Sun .. 6=Sat
    };
    requireAttendance?: boolean;          // Must have punched in today
}

export const CLINICS = [
    { id: 'clinic-1', name: 'Al Muraqabat Branch', lat: 25.2697, lng: 55.3095 },
    { id: 'clinic-2', name: 'Al Qiyadah Branch', lat: 25.2756, lng: 55.3364 },
    { id: 'clinic-3', name: 'Silicon Oasis Branch', lat: 25.1264, lng: 55.3849 },
    { id: 'head-office', name: 'Head Office', lat: 25.2048, lng: 55.2708 },
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
    canManagePermissions: boolean;
    sessionToken?: string;               // Active session token for single-device enforcement
    employeeId?: string;                 // Link to HR employee record for attendance check
    loginRestrictions?: LoginRestrictions;
}

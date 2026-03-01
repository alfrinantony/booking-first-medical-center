
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'DOCTOR' | 'STAFF';

export interface AssignedScope {
    clinicId?: string;
    departmentId?: string;
    doctorId?: string; // If the user is a doctor, link to the doctor profile
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
    clinicIds: string[];   // supports multiple branches
    isActive: boolean;
    scope?: AssignedScope;
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
        if (user && !user.isActive) return null; // Inactive users can't login
        return user || null;
    }
};

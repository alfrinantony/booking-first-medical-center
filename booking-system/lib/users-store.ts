
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'DOCTOR' | 'STAFF';

export interface AssignedScope {
    clinicId?: string;
    departmentId?: string;
    doctorId?: string; // If the user is a doctor, link to the doctor profile
}

export interface User {
    id: string;
    username: string;
    password?: string; // In a real app, this would be hashed. For mock, we might store plain or simple hash.
    name: string;
    role: UserRole;
    scope?: AssignedScope;
}

// Initial Seed Data
const initialUsers: User[] = [
    {
        id: 'user-admin-01',
        username: 'admin',
        password: 'password123', // Default password
        name: 'Super Admin',
        role: 'SUPER_ADMIN'
    }
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
        return user || null;
    }
};

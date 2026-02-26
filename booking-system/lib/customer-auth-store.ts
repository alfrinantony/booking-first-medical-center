import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserProfile } from './store'; // Import existing UserProfile type

export interface RegisteredUser extends UserProfile {
    id: string;
    passwordHash: string; // Simulated hash
    emailVerified: boolean;
    blocked: boolean;
    createdAt: string;
}

interface CustomerAuthDatabase {
    users: RegisteredUser[];

    // Actions
    register: (user: Omit<UserProfile, 'dateOfBirth'> & { password: string, dateOfBirth?: string }) => { success: boolean, message: string, user?: RegisteredUser };
    login: (identifier: string, password: string) => { success: boolean, message: string, user?: RegisteredUser };
    getUserByPhone: (phone: string) => RegisteredUser | undefined;
    updateUser: (id: string, updates: Partial<UserProfile>) => void;
    resetPassword: (identifier: string, newPassword: string) => { success: boolean; message: string };
    verifyEmail: (email: string) => boolean;
    // Admin methods
    blockUser: (id: string) => boolean;
    unblockUser: (id: string) => boolean;
    removeUser: (id: string) => boolean;
    adminResetPassword: (id: string, newPassword: string) => boolean;
    adminUpdateUser: (id: string, updates: Partial<UserProfile>) => boolean;
    mergeUsers: (targetId: string, sourceId: string) => boolean;
}

export const useCustomerAuthStore = create<CustomerAuthDatabase>()(
    persist(
        (set, get) => ({
            users: [],

            register: (userData) => {
                const { password, ...profile } = userData;
                const state = get();

                // Check if user exists
                if (state.users.some(u => u.phone === profile.phone || u.email === profile.email)) {
                    return { success: false, message: 'User with this phone or email already exists.' };
                }

                const newUser: RegisteredUser = {
                    ...profile,
                    dateOfBirth: profile.dateOfBirth || '',
                    id: `cust-${Date.now()}`,
                    passwordHash: btoa(password), // Simple base64 "hash" for demo
                    emailVerified: false, // Must verify email before login
                    blocked: false,
                    createdAt: new Date().toISOString()
                };

                set(state => ({
                    users: [...state.users, newUser]
                }));

                return { success: true, message: 'Registration successful', user: newUser };
            },

            login: (identifier, password) => {
                const state = get();
                const user = state.users.find(u => u.email === identifier || u.phone === identifier);

                if (!user) {
                    return { success: false, message: 'User not found.' };
                }

                if (!user.emailVerified) {
                    return { success: false, message: 'Please verify your email before logging in. Check your inbox for the verification code.' };
                }

                if (user.blocked) {
                    return { success: false, message: 'Your account has been suspended. Please contact support.' };
                }

                if (user.passwordHash !== btoa(password)) {
                    return { success: false, message: 'Invalid password.' };
                }

                return { success: true, message: 'Login successful', user };
            },

            getUserByPhone: (phone) => {
                return get().users.find(u => u.phone === phone);
            },

            updateUser: (id, updates) => {
                set(state => ({
                    users: state.users.map(u => u.id === id ? { ...u, ...updates } : u)
                }));
            },

            resetPassword: (identifier, newPassword) => {
                const state = get();
                const user = state.users.find(u => u.email === identifier || u.phone === identifier);

                if (!user) {
                    return { success: false, message: 'No account found with this email or phone number.' };
                }

                set(state => ({
                    users: state.users.map(u =>
                        u.id === user.id ? { ...u, passwordHash: btoa(newPassword) } : u
                    )
                }));

                return { success: true, message: 'Password has been reset successfully. You can now log in.' };
            },

            verifyEmail: (email) => {
                const state = get();
                const user = state.users.find(u => u.email === email);
                if (!user) return false;

                set(state => ({
                    users: state.users.map(u =>
                        u.email === email ? { ...u, emailVerified: true } : u
                    )
                }));
                return true;
            },

            // ── Admin methods ──

            blockUser: (id) => {
                const user = get().users.find(u => u.id === id);
                if (!user) return false;
                set(state => ({ users: state.users.map(u => u.id === id ? { ...u, blocked: true } : u) }));
                return true;
            },

            unblockUser: (id) => {
                const user = get().users.find(u => u.id === id);
                if (!user) return false;
                set(state => ({ users: state.users.map(u => u.id === id ? { ...u, blocked: false } : u) }));
                return true;
            },

            removeUser: (id) => {
                const user = get().users.find(u => u.id === id);
                if (!user) return false;
                set(state => ({ users: state.users.filter(u => u.id !== id) }));
                return true;
            },

            adminResetPassword: (id, newPassword) => {
                const user = get().users.find(u => u.id === id);
                if (!user) return false;
                set(state => ({
                    users: state.users.map(u => u.id === id ? { ...u, passwordHash: btoa(newPassword) } : u)
                }));
                return true;
            },

            adminUpdateUser: (id, updates) => {
                const user = get().users.find(u => u.id === id);
                if (!user) return false;
                set(state => ({
                    users: state.users.map(u => u.id === id ? { ...u, ...updates } : u)
                }));
                return true;
            },

            mergeUsers: (targetId, sourceId) => {
                const state = get();
                const target = state.users.find(u => u.id === targetId);
                const source = state.users.find(u => u.id === sourceId);
                if (!target || !source) return false;

                // Merge: keep target, fill in missing fields from source, remove source
                const merged: RegisteredUser = {
                    ...target,
                    phone: target.phone || source.phone,
                    email: target.email || source.email,
                    name: target.name || source.name,
                    dateOfBirth: target.dateOfBirth || source.dateOfBirth,
                };

                set(state => ({
                    users: state.users
                        .map(u => u.id === targetId ? merged : u)
                        .filter(u => u.id !== sourceId)
                }));
                return true;
            }
        }),
        {
            name: 'customer-db-storage'
        }
    )
);

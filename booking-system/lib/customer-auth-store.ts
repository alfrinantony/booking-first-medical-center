import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserProfile } from './store'; // Import existing UserProfile type

export interface RegisteredUser extends UserProfile {
    id: string;
    passwordHash: string; // Simulated hash
    createdAt: string;
}

interface CustomerAuthDatabase {
    users: RegisteredUser[];

    // Actions
    register: (user: Omit<UserProfile, 'dateOfBirth'> & { password: string, dateOfBirth?: string }) => { success: boolean, message: string, user?: RegisteredUser };
    login: (identifier: string, password: string) => { success: boolean, message: string, user?: RegisteredUser };
    getUserByPhone: (phone: string) => RegisteredUser | undefined;
    updateUser: (id: string, updates: Partial<UserProfile>) => void;
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
            }
        }),
        {
            name: 'customer-db-storage'
        }
    )
);

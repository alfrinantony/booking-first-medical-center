import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PatientRelationship = 'spouse' | 'parent' | 'child' | 'sibling' | 'friend' | 'business_associate' | 'other';

export interface ConnectedPatient {
    patientPhone: string;
    relationship: PatientRelationship;
}

export interface UserProfile {
    name: string;
    // age: number; // Removed in favor of DOB
    dateOfBirth: string; // YYYY-MM-DD
    gender: 'male' | 'female' | 'other';
    email: string;
    phone: string;
    loyaltyPoints?: number;
    connectedPatients?: ConnectedPatient[];
}

interface AuthState {
    user: UserProfile | null;
    isAuthenticated: boolean;
    login: (user: UserProfile) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            isAuthenticated: false,
            login: (user) => set({ user, isAuthenticated: true }),
            logout: () => set({ user: null, isAuthenticated: false }),
        }),
        {
            name: 'booking-auth-storage',
        }
    )
);

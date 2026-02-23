import { clinics as initialClinics, Clinic } from './data';

// In-memory store for clinics
// Initialized with data from lib/data.ts
let clinicStore: Clinic[] = JSON.parse(JSON.stringify(initialClinics));

export const ClinicsStore = {
    // Get all clinics
    getClinics: () => {
        return clinicStore;
    },

    // Get a single clinic by ID
    getClinic: (id: string) => {
        return clinicStore.find(c => c.id === id);
    },

    // Add a new clinic
    addClinic: (clinic: Omit<Clinic, 'id' | 'departments'>) => {
        const newClinic: Clinic = {
            ...clinic,
            id: `clinic-${Date.now()}`,
            departments: [] // Initialize with empty departments
        };
        clinicStore.push(newClinic);
        return newClinic;
    },

    // Update a clinic
    updateClinic: (id: string, updates: Partial<Clinic>) => {
        const index = clinicStore.findIndex(c => c.id === id);
        if (index === -1) return null;

        // Merge updates, but preserve departments if not explicitly updated (usually they aren't in this view)
        const updatedClinic = { ...clinicStore[index], ...updates };
        clinicStore[index] = updatedClinic;
        return updatedClinic;
    },

    // Remove a clinic
    removeClinic: (id: string) => {
        const initialLength = clinicStore.length;
        clinicStore = clinicStore.filter(c => c.id !== id);
        return clinicStore.length < initialLength;
    }
};

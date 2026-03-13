import { Clinic } from './data';
import { ensureClinicsLoaded, getClinicStore, setClinicStore, saveClinicStore } from './services-store';

// Uses the SHARED clinic cache from services-store to prevent stale-cache overwrites

export const ClinicsStore = {
    // Get all clinics
    getClinics: async () => {
        await ensureClinicsLoaded();
        return getClinicStore();
    },

    // Get a single clinic by ID
    getClinic: async (id: string) => {
        await ensureClinicsLoaded();
        return getClinicStore().find(c => c.id === id);
    },

    // Add a new clinic
    addClinic: async (clinic: Omit<Clinic, 'id' | 'departments'>) => {
        await ensureClinicsLoaded();
        const newClinic: Clinic = {
            ...clinic,
            id: `clinic-${Date.now()}`,
            departments: [] // Initialize with empty departments
        };
        getClinicStore().push(newClinic);
        await saveClinicStore();
        return newClinic;
    },

    // Update a clinic
    updateClinic: async (id: string, updates: Partial<Clinic>) => {
        await ensureClinicsLoaded();
        const store = getClinicStore();
        const index = store.findIndex(c => c.id === id);
        if (index === -1) return null;

        // Merge updates, but preserve departments if not explicitly updated
        const updatedClinic = { ...store[index], ...updates };
        store[index] = updatedClinic;
        await saveClinicStore();
        return updatedClinic;
    },

    // Remove a clinic
    removeClinic: async (id: string) => {
        await ensureClinicsLoaded();
        const store = getClinicStore();
        const initialLength = store.length;
        const filtered = store.filter(c => c.id !== id);
        if (filtered.length < initialLength) {
            setClinicStore(filtered);
            await saveClinicStore();
            return true;
        }
        return false;
    }
};

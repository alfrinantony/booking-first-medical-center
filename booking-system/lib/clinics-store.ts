import { clinics as initialClinics, Clinic } from './data';
import { loadFromBlob, saveToBlob } from './blob-persistence';

// In-memory cache for clinics — loaded from Azure Blob on first access
let clinicStore: Clinic[] = JSON.parse(JSON.stringify(initialClinics));
let loaded = false;

async function ensureLoaded() {
    if (!loaded) {
        clinicStore = await loadFromBlob<Clinic[]>('clinics', clinicStore);
        loaded = true;
    }
}

export const ClinicsStore = {
    // Get all clinics
    getClinics: async () => {
        await ensureLoaded();
        return clinicStore;
    },

    // Get a single clinic by ID
    getClinic: async (id: string) => {
        await ensureLoaded();
        return clinicStore.find(c => c.id === id);
    },

    // Add a new clinic
    addClinic: async (clinic: Omit<Clinic, 'id' | 'departments'>) => {
        await ensureLoaded();
        const newClinic: Clinic = {
            ...clinic,
            id: `clinic-${Date.now()}`,
            departments: [] // Initialize with empty departments
        };
        clinicStore.push(newClinic);
        await saveToBlob('clinics', clinicStore);
        return newClinic;
    },

    // Update a clinic
    updateClinic: async (id: string, updates: Partial<Clinic>) => {
        await ensureLoaded();
        const index = clinicStore.findIndex(c => c.id === id);
        if (index === -1) return null;

        // Merge updates, but preserve departments if not explicitly updated
        const updatedClinic = { ...clinicStore[index], ...updates };
        clinicStore[index] = updatedClinic;
        await saveToBlob('clinics', clinicStore);
        return updatedClinic;
    },

    // Remove a clinic
    removeClinic: async (id: string) => {
        await ensureLoaded();
        const initialLength = clinicStore.length;
        clinicStore = clinicStore.filter(c => c.id !== id);
        if (clinicStore.length < initialLength) {
            await saveToBlob('clinics', clinicStore);
            return true;
        }
        return false;
    }
};

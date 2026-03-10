import { clinics as initialClinics, Clinic, Doctor } from './data';
import { loadFromBlob, saveToBlob } from './blob-persistence';

// In-memory cache for clinics (which contain doctors)
// Shares the same 'clinics' blob key as services-store for unified persistence
let clinicStore: Clinic[] = JSON.parse(JSON.stringify(initialClinics));
let loaded = false;

async function ensureLoaded() {
    if (!loaded) {
        clinicStore = await loadFromBlob<Clinic[]>('clinics', clinicStore);
        loaded = true;
    }
}

export const DoctorsStore = {
    // Get all clinics to browse doctors
    getClinics: async () => {
        await ensureLoaded();
        return clinicStore;
    },

    // Add a doctor to a department
    addDoctor: async (clinicId: string, departmentId: string, doctor: Omit<Doctor, 'id'>) => {
        await ensureLoaded();
        const clinic = clinicStore.find(c => c.id === clinicId);
        if (!clinic) return null;

        const department = clinic.departments.find(d => d.id === departmentId);
        if (!department) return null;

        const newDoctor: Doctor = {
            ...doctor,
            id: `${departmentId}-doc-${Date.now()}` // Unique ID
        };

        department.doctors.push(newDoctor);
        await saveToBlob('clinics', clinicStore);
        return newDoctor;
    },

    // Remove a doctor
    removeDoctor: async (clinicId: string, departmentId: string, doctorId: string) => {
        await ensureLoaded();
        const clinic = clinicStore.find(c => c.id === clinicId);
        if (!clinic) return false;

        const department = clinic.departments.find(d => d.id === departmentId);
        if (!department) return false;

        const initialLength = department.doctors.length;
        department.doctors = department.doctors.filter(d => d.id !== doctorId);

        if (department.doctors.length < initialLength) {
            await saveToBlob('clinics', clinicStore);
            return true;
        }
        return false;
    },

    // Update a doctor
    updateDoctor: async (clinicId: string, departmentId: string, doctorId: string, updates: Partial<Omit<Doctor, 'id'>>) => {
        await ensureLoaded();
        const clinic = clinicStore.find(c => c.id === clinicId);
        if (!clinic) return null;

        const department = clinic.departments.find(d => d.id === departmentId);
        if (!department) return null;

        const doctorIndex = department.doctors.findIndex(d => d.id === doctorId);
        if (doctorIndex === -1) return null;

        const updatedDoctor = { ...department.doctors[doctorIndex], ...updates };
        department.doctors[doctorIndex] = updatedDoctor;

        await saveToBlob('clinics', clinicStore);
        return updatedDoctor;
    }
};

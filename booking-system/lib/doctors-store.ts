import { Doctor } from './data';
import { ensureClinicsLoaded, getClinicStore, saveClinicStore } from './services-store';

// Uses the SHARED clinic cache from services-store to prevent stale-cache overwrites

export const DoctorsStore = {
    // Get all clinics to browse doctors
    getClinics: async () => {
        await ensureClinicsLoaded();
        return getClinicStore();
    },

    // Add a doctor to a department (pass id to reuse an existing doctor's ID for multi-branch)
    addDoctor: async (clinicId: string, departmentId: string, doctor: Omit<Doctor, 'id'> & { id?: string }) => {
        await ensureClinicsLoaded();
        const clinic = getClinicStore().find(c => c.id === clinicId);
        if (!clinic) return null;

        const department = clinic.departments.find(d => d.id === departmentId);
        if (!department) return null;

        const newDoctor: Doctor = {
            ...doctor,
            id: doctor.id || `${departmentId}-doc-${Date.now()}` // reuse ID or generate new
        };

        department.doctors.push(newDoctor);
        await saveClinicStore();
        return newDoctor;
    },

    // Remove a doctor
    removeDoctor: async (clinicId: string, departmentId: string, doctorId: string) => {
        await ensureClinicsLoaded();
        const clinic = getClinicStore().find(c => c.id === clinicId);
        if (!clinic) return false;

        const department = clinic.departments.find(d => d.id === departmentId);
        if (!department) return false;

        const initialLength = department.doctors.length;
        department.doctors = department.doctors.filter(d => d.id !== doctorId);

        if (department.doctors.length < initialLength) {
            await saveClinicStore();
            return true;
        }
        return false;
    },

    // Update a doctor
    updateDoctor: async (clinicId: string, departmentId: string, doctorId: string, updates: Partial<Omit<Doctor, 'id'>>) => {
        await ensureClinicsLoaded();
        const clinic = getClinicStore().find(c => c.id === clinicId);
        if (!clinic) return null;

        const department = clinic.departments.find(d => d.id === departmentId);
        if (!department) return null;

        const doctorIndex = department.doctors.findIndex(d => d.id === doctorId);
        if (doctorIndex === -1) return null;

        const updatedDoctor = { ...department.doctors[doctorIndex], ...updates };
        department.doctors[doctorIndex] = updatedDoctor;

        await saveClinicStore();
        return updatedDoctor;
    },

    // Find all branch/department combos where a doctor exists (by ID)
    findDoctorBranches: async (doctorId: string) => {
        await ensureClinicsLoaded();
        const branches: { clinicId: string; clinicName: string; departmentId: string; departmentName: string }[] = [];
        for (const clinic of getClinicStore()) {
            for (const dept of clinic.departments) {
                if (dept.doctors.some(d => d.id === doctorId)) {
                    branches.push({ clinicId: clinic.id, clinicName: clinic.name, departmentId: dept.id, departmentName: dept.name });
                }
            }
        }
        return branches;
    }
};

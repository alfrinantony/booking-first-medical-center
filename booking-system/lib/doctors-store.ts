import { clinics as initialClinics, Clinic, Doctor } from './data';

// In-memory store for clinics (which contain doctors)
// We share the same source of truth as services if possible, but since these are separate modules 
// and we are mocking a DB, we'll initialize a separate clone.
// In a real app, this would be a DB connection.
// Note: Changes here won't reflect in ServicesStore unless we unify them. 
// For this demo, let's assume they are independent or we just manage doctors here.
let clinicStore: Clinic[] = JSON.parse(JSON.stringify(initialClinics));

export const DoctorsStore = {
    // Get all clinics to browse doctors
    getClinics: () => {
        return clinicStore;
    },

    // Add a doctor to a department
    addDoctor: (clinicId: string, departmentId: string, doctor: Omit<Doctor, 'id'>) => {
        const clinic = clinicStore.find(c => c.id === clinicId);
        if (!clinic) return null;

        const department = clinic.departments.find(d => d.id === departmentId);
        if (!department) return null;

        const newDoctor: Doctor = {
            ...doctor,
            id: `${departmentId}-doc-${Date.now()}` // Unique ID
        };

        department.doctors.push(newDoctor);
        return newDoctor;
    },

    // Remove a doctor
    removeDoctor: (clinicId: string, departmentId: string, doctorId: string) => {
        const clinic = clinicStore.find(c => c.id === clinicId);
        if (!clinic) return false;

        const department = clinic.departments.find(d => d.id === departmentId);
        if (!department) return false;

        const initialLength = department.doctors.length;
        department.doctors = department.doctors.filter(d => d.id !== doctorId);

        return department.doctors.length < initialLength;
    },

    // Update a doctor
    updateDoctor: (clinicId: string, departmentId: string, doctorId: string, updates: Partial<Omit<Doctor, 'id'>>) => {
        const clinic = clinicStore.find(c => c.id === clinicId);
        if (!clinic) return null;

        const department = clinic.departments.find(d => d.id === departmentId);
        if (!department) return null;

        const doctorIndex = department.doctors.findIndex(d => d.id === doctorId);
        if (doctorIndex === -1) return null;

        const updatedDoctor = { ...department.doctors[doctorIndex], ...updates };
        department.doctors[doctorIndex] = updatedDoctor;

        return updatedDoctor;
    }
};

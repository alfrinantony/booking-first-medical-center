"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoctorsStore = void 0;
const services_store_1 = require("./services-store");
// Uses the SHARED clinic cache from services-store to prevent stale-cache overwrites
exports.DoctorsStore = {
    // Get all clinics to browse doctors
    getClinics: async () => {
        await (0, services_store_1.ensureClinicsLoaded)();
        return (0, services_store_1.getClinicStore)();
    },
    // Add a doctor to a department (pass id to reuse an existing doctor's ID for multi-branch)
    addDoctor: async (clinicId, departmentId, doctor) => {
        await (0, services_store_1.ensureClinicsLoaded)();
        const clinic = (0, services_store_1.getClinicStore)().find(c => c.id === clinicId);
        if (!clinic)
            return null;
        const department = clinic.departments.find(d => d.id === departmentId);
        if (!department)
            return null;
        const newDoctor = {
            ...doctor,
            id: doctor.id || `${departmentId}-doc-${Date.now()}` // reuse ID or generate new
        };
        department.doctors.push(newDoctor);
        await (0, services_store_1.saveClinicStore)();
        return newDoctor;
    },
    // Remove a doctor
    removeDoctor: async (clinicId, departmentId, doctorId) => {
        await (0, services_store_1.ensureClinicsLoaded)();
        const clinic = (0, services_store_1.getClinicStore)().find(c => c.id === clinicId);
        if (!clinic)
            return false;
        const department = clinic.departments.find(d => d.id === departmentId);
        if (!department)
            return false;
        const initialLength = department.doctors.length;
        department.doctors = department.doctors.filter(d => d.id !== doctorId);
        if (department.doctors.length < initialLength) {
            await (0, services_store_1.saveClinicStore)();
            return true;
        }
        return false;
    },
    // Update a doctor
    updateDoctor: async (clinicId, departmentId, doctorId, updates) => {
        await (0, services_store_1.ensureClinicsLoaded)();
        const clinic = (0, services_store_1.getClinicStore)().find(c => c.id === clinicId);
        if (!clinic)
            return null;
        const department = clinic.departments.find(d => d.id === departmentId);
        if (!department)
            return null;
        const doctorIndex = department.doctors.findIndex(d => d.id === doctorId);
        if (doctorIndex === -1)
            return null;
        const updatedDoctor = { ...department.doctors[doctorIndex], ...updates };
        department.doctors[doctorIndex] = updatedDoctor;
        await (0, services_store_1.saveClinicStore)();
        return updatedDoctor;
    },
    // Find all branch/department combos where a doctor exists (by ID)
    findDoctorBranches: async (doctorId) => {
        await (0, services_store_1.ensureClinicsLoaded)();
        const branches = [];
        for (const clinic of (0, services_store_1.getClinicStore)()) {
            for (const dept of clinic.departments) {
                if (dept.doctors.some(d => d.id === doctorId)) {
                    branches.push({ clinicId: clinic.id, clinicName: clinic.name, departmentId: dept.id, departmentName: dept.name });
                }
            }
        }
        return branches;
    }
};

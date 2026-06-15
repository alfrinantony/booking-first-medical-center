"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const doctors_store_1 = require("../lib/doctors-store");
async function run() {
    const clinics = await doctors_store_1.DoctorsStore.getClinics();
    const allDocs = clinics.flatMap(c => c.departments.flatMap(d => d.doctors));
    const laserDocs = allDocs.filter(d => (d.departmentName?.toLowerCase().includes('laser') || d.allowedServiceNames?.some((s) => s.toLowerCase().includes('laser'))) &&
        !d.name.startsWith('Dr.'));
    console.log('Laser Techs:', laserDocs.map(d => d.name));
}
run();

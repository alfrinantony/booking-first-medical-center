"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const doctors_store_1 = require("../lib/doctors-store");
async function run() {
    const clinics = await doctors_store_1.DoctorsStore.getClinics();
    const docs = clinics.flatMap(c => c.departments.flatMap(d => d.doctors));
    const laserDocs = docs.filter(d => (d.departmentName && d.departmentName.toLowerCase().includes('laser')) ||
        (d.allowedServiceNames && d.allowedServiceNames.some((s) => s.toLowerCase().includes('laser'))));
    console.log('Laser Docs:', laserDocs.map(d => d.name));
}
run();

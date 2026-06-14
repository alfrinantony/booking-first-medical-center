import { DoctorsStore } from '../lib/doctors-store';

async function run() {
    const clinics = await DoctorsStore.getClinics();
    const docs = clinics.flatMap(c => c.departments.flatMap(d => d.doctors));
    const laserDocs = docs.filter(d => 
        ((d as any).departmentName && (d as any).departmentName.toLowerCase().includes('laser')) || 
        (d.allowedServiceNames && d.allowedServiceNames.some((s: string) => s.toLowerCase().includes('laser')))
    );
    console.log('Laser Docs:', laserDocs.map(d => d.name));
}

run();

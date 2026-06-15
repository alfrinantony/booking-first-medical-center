import { DoctorsStore } from '../lib/doctors-store';
async function run() {
    const clinics = await DoctorsStore.getClinics();
    const allDocs = clinics.flatMap(c => c.departments.flatMap(d => d.doctors));
    const laserDocs = allDocs.filter(d => 
        ((d as any).departmentName?.toLowerCase().includes('laser') || d.allowedServiceNames?.some((s: string) => s.toLowerCase().includes('laser'))) && 
        !d.name.startsWith('Dr.')
    );
    console.log('Laser Techs:', laserDocs.map(d => d.name));
}
run();

import { DoctorsStore } from '../lib/doctors-store';
async function run() {
    const clinics = await DoctorsStore.getClinics();
    const allDoctors = clinics.flatMap(c => c.departments.flatMap(d => d.doctors));
    const kristinas = allDoctors.filter(d => d.name.toLowerCase().includes('kristina'));
    console.log(JSON.stringify(kristinas, null, 2));
}
run();

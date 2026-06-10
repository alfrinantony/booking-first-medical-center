import { loadFromBlob } from '../lib/blob-persistence';

async function main() {
    console.log("Loading clinics from blob...");
    const clinics = await loadFromBlob('clinics', null);
    if (!clinics) {
        console.log("Clinics blob not found or empty.");
        return;
    }
    console.log("Clinics count:", clinics.length);
    for (const c of clinics) {
        console.log(`Clinic: ${c.name} (${c.id})`);
        console.log(`  Departments: ${c.departments.length}`);
        for (const d of c.departments) {
            console.log(`    - ${d.name}: ${d.services.length} services, ${d.doctors.length} doctors`);
            if (d.services.length > 0) {
                console.log(`      Sample Service: ${d.services[0].name}`);
            }
        }
    }
}

main().catch(console.error);

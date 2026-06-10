import { loadFromBlob } from '../lib/blob-persistence';

async function main() {
    const clinics = await loadFromBlob('clinics', null);
    const d1 = clinics[0].departments.find(d => d.name === 'Aesthetic Dermatology');
    console.log("Docs in Aesthetic Dermatology:", d1.doctors.map(d => d.name));
    console.log("Services in Aesthetic Dermatology (first 5):", d1.services.slice(0, 5).map(s => s.name));
}

main().catch(console.error);

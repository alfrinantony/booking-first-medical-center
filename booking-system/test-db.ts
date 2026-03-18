import { loadFromBlob } from './lib/blob-persistence';

async function fetchLiveDB() {
    console.log("--- Fetching Live Clinics DB ---");
    const clinics = await loadFromBlob('clinics', []);
    for (const clinic of clinics) {
        for (const dept of clinic.departments) {
            if (dept.name.includes("Hair Removal")) {
                console.log(`\nClinic: ${clinic.name} | Dept: ${dept.name}`);
                for (const svc of dept.services) {
                    console.log(`Service Name: ${svc.name} | ID: ${svc.id} | Duration: ${svc.duration}`);
                }
            }
        }
    }
}

fetchLiveDB().then(() => {
    console.log("Done");
    process.exit(0);
});

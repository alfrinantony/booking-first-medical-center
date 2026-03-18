import { ServicesStore } from './app/api/admin/schedule/route'; // No, wait, import from lib
import { ServicesStore as Store} from './lib/services-store';

async function dumpServices() {
    console.log("--- Dumping Service IDs ---");
    const clinics = await Store.getClinics();
    let serviceIds: string[] = [];
    for (const clinic of clinics) {
        for (const dept of clinic.departments) {
            console.log(`Dept:`, dept.name);
            for (const svc of dept.services) {
                serviceIds.push(svc.id);
            }
        }
    }
    console.log("Sample IDs:", serviceIds.slice(0, 20));
    
    // Test the specific IDs
    console.log("Found c1-Hair Removal-svc-1?", await Store.getServiceById("c1-Hair Removal-svc-1") !== null);
    console.log("Found derm-svc-6?", await Store.getServiceById("derm-svc-6") !== null);
}

dumpServices().then(() => {
    console.log("\nDone");
    process.exit(0);
});

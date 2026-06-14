import { ServicesStore } from './lib/services-store';

async function fixVisibility() {
    console.log("Loading clinics...");
    const clinics = await ServicesStore.getClinics();
    
    const hiddenServices = new Set<string>();

    // Pass 1: Find all service names that are hidden in ANY clinic
    for (const clinic of clinics) {
        for (const dept of clinic.departments) {
            for (const svc of dept.services) {
                if (svc.isVisible === false) {
                    hiddenServices.add(svc.name);
                }
            }
        }
    }

    console.log("Services hidden in at least one branch:");
    console.log(Array.from(hiddenServices));

    // Pass 2: Force isVisible: false for these services globally using the updated store function
    for (const serviceName of hiddenServices) {
        console.log(`Fixing visibility globally for: ${serviceName}`);
        
        // Find one serviceId that belongs to this service name to use as parameter
        let sampleId = null;
        for (const clinic of clinics) {
            for (const dept of clinic.departments) {
                const s = dept.services.find(s => s.name === serviceName);
                if (s) {
                    sampleId = s.id;
                    break;
                }
            }
            if (sampleId) break;
        }

        if (sampleId) {
            await ServicesStore.updateServiceGlobally(sampleId, { isVisible: false });
        }
    }

    console.log("Visibility sync completed!");
}

fixVisibility().catch(console.error);

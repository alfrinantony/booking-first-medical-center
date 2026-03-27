import { ServicesStore } from './lib/services-store';

async function checkClinic() {
    const clinics = await ServicesStore.getClinics();
    console.log("=== LIVE CLINICS.JSON ===");
    clinics.forEach(c => {
        console.log({
            id: c.id,
            name: c.name,
            openingTime: c.openingTime,
            closingTime: c.closingTime
        });
    });
}

checkClinic().catch(console.error);

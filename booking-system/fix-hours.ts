import { ServicesStore } from './lib/services-store';
import { loadFromBlob, saveToBlob } from './lib/blob-persistence';

async function fixHours() {
    console.log("Downloading clinics.json from Blob...");
    const clinics = await loadFromBlob<any[]>('clinics', []);

    let modified = 0;
    for (const clinic of clinics) {
        if (clinic.closingTime === '10:00') {
            console.log(`Fixing ${clinic.name}: changing closingTime from 10:00 to 22:00`);
            clinic.closingTime = '22:00';
            modified++;
        }
    }

    if (modified > 0) {
        await saveToBlob('clinics', clinics);
        console.log(`Successfully fixed ${modified} clinics.`);
    } else {
        console.log("No clinics needed fixing.");
    }
}

fixHours().catch(console.error);

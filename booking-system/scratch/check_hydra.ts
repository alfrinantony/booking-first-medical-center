import { ServicesStore } from '../lib/services-store';

async function run() {
    const services = await ServicesStore.getAllServices();
    const hydra = services.find(s => s.name && s.name.includes('HydraFacial-Classic'));
    console.log(JSON.stringify(hydra?.availability, null, 2));
}
run();

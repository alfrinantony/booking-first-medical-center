"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const services_store_1 = require("../lib/services-store");
async function run() {
    const services = await services_store_1.ServicesStore.getAllServices();
    const hydra = services.find(s => s.name && s.name.includes('HydraFacial-Classic'));
    console.log(JSON.stringify(hydra?.availability, null, 2));
}
run();

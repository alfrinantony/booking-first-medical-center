const { ServicesStore } = require('./lib/services-store');

async function main() {
    const clinics = await ServicesStore.getClinics();
    console.log(JSON.stringify(clinics.map(c => ({id: c.id, name: c.name})), null, 2));
}

main().catch(console.error);

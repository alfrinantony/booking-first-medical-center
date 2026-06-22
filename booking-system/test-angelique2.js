const { BookingsStore } = require('./lib/bookings-store');

async function main() {
    const bookings = await BookingsStore.getByFilters({ patientName: "ANGELIQUE" });
    console.log(JSON.stringify(bookings.slice(0, 2), null, 2));
}

main().catch(console.error);

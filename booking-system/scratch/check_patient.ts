import { BookingsStore } from '../lib/bookings-store';

async function run() {
    const allBookings = await BookingsStore.getAll();
    const overlaps = allBookings.filter(b => b.patientName === 'Alfrin Antony' && b.date === '2026-06-15');
    console.log(overlaps);
}
run();

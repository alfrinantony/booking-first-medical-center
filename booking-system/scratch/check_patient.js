"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bookings_store_1 = require("../lib/bookings-store");
async function run() {
    const allBookings = await bookings_store_1.BookingsStore.getAll();
    const overlaps = allBookings.filter(b => b.patientName === 'Alfrin Antony' && b.date === '2026-06-15');
    console.log(overlaps);
}
run();

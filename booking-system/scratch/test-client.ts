import { getAdminBookings } from '../lib/simplybook-client';

async function test() {
    try {
        console.log('Testing getAdminBookings...');
        const bookings = await getAdminBookings('2026-05-01', '2026-05-05');
        console.log('Got bookings:', bookings.length);
    } catch(e) {
        console.error(e);
    }
}

test();

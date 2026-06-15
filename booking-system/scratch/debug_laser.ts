import { BookingsStore } from '../lib/bookings-store';
import { SimplybookStore } from '../lib/simplybook-store';

async function run() {
    const allBookings = await BookingsStore.getAll();
    const allSb = await SimplybookStore.getAll();
    const sbMap = new Map(allSb.map(sb => [sb.sbId, sb]));
    
    const anyDoctorBookings = allBookings.filter(b => b.anyDoctor === true);
    
    console.log("Sample service names:");
    const names = anyDoctorBookings.slice(0, 20).map(b => sbMap.get(b.sbId!)?.serviceName);
    console.log(names);
    
    // Check how many actually have 'laser'
    const laserCount = anyDoctorBookings.filter(b => {
        const sb = sbMap.get(b.sbId!);
        return sb && sb.serviceName && sb.serviceName.toLowerCase().includes('laser');
    }).length;
    
    console.log("Count with laser:", laserCount);
}

run().catch(console.error);

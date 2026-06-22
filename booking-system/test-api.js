async function main() {
    const res = await fetch('http://localhost:3000/api/bookings/1arfskox9', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            status: 'arrived',
            date: '2026-06-20',
            slot: '10:00',
            clinicId: 'clinic-2',
            deptId: 'c2-Nursing-Hair Removal',
            serviceId: 'c2-Laser & Electrolysis Hair Removal-svc-1773406452340',
            doctorId: 'doc-1773474584179',
            duration: 30,
            patientName: 'ANGELIQUE',
            whatsappNumber: '+971507851712',
            email: 'geni1022@gmail.com',
            staffName: 'Admin'
        })
    });
    
    console.log("Status:", res.status);
    const json = await res.json();
    console.log("Response:", JSON.stringify(json, null, 2));
}

main().catch(console.error);

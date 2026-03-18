import { GET } from './app/api/admin/schedule/route';

async function testDurations() {
    console.log("--- Testing Service Durations ---");

    const tests = [
        { name: "30 min Service", serviceId: "c1-Hair Removal-svc-1", duration: 30 },
        { name: "45 min Service", serviceId: "c1-Hair Removal-svc-2", duration: 45 },
        { name: "60 min Service", serviceId: "c1-Hair Removal-svc-3", duration: 60 },
        { name: "15 min Service", serviceId: "c1-Hair Removal-svc-0", duration: 15 },
    ];

    for (const test of tests) {
        console.log(`\n\n>> Testing ${test.name} (ID: ${test.serviceId})...`);
        const req = new Request(`http://localhost:3000/api/admin/schedule?doctorId=doc-1&date=2026-03-20&serviceId=${encodeURIComponent(test.serviceId)}&clinicId=clinic-1`);
        try {
            const res = await GET(req);
            const data = await res.json();
            console.log(`Reported Duration: ${data.serviceDuration} mins`);
            console.log("Generated Slots:", data.slots.slice(0, 5));
        } catch (err) {
            console.error("Error:", err);
        }
    }
}

testDurations().then(() => {
    console.log("\nDone");
    process.exit(0);
});

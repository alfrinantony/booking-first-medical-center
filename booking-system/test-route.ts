import { GET } from './app/api/admin/schedule/route';

async function test() {
    console.log("Starting test...");
    const req = new Request("http://localhost:3000/api/admin/schedule?doctorId=doc-1&date=2026-03-20&serviceId=c1-Hair%20Removal-svc-2&clinicId=clinic-1");
    try {
        const res = await GET(req);
        console.log("Response status:", res.status);
        const data = await res.json();
        console.log("Data:", data);
    } catch(err) {
        console.error("Error:", err);
    }
}

test().then(() => {
    console.log("Done");
    process.exit(0);
});

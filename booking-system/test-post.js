import fs from 'fs';
import path from 'path';

async function run() {
    try {
        const adminUrl = "http://localhost:3000/api/admin/bookings";
        const body = {
            clinicId: "clinic-1",
            deptId: "dept-1",
            doctorId: "doc-1",
            serviceId: "svc-1",
            date: "2026-03-22",
            slot: "10:30 AM",
            duration: 30,
            patientName: "Test Patient",
            patientPhone: "12345678"
        };
        const res = await fetch("http://localhost:3000/api/admin/bookings", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json().catch(e => ({ error: "Could not parse JSON", text: res.statusText }));
        console.log("Status:", res.status);
        console.log("Response:", data);
    } catch (err) {
        console.error("Fetch failed:", err);
    }
}
run();

import { GET } from './app/api/admin/schedule/route';

async function testApi() {
    // We mock the Request object to hit the API with a generic doctor
    // Let's first extract a real clinic and doctor
    const { clinics } = require('./lib/data');
    const clinic = clinics[0];
    const doctor = clinic.departments[0].doctors[0];
    
    // Simulate API request for Friday March 27
    const url = `http://localhost:3000/api/admin/schedule?doctorId=${doctor.id}&date=2026-03-27&clinicId=${clinic.id}`;
    const req = new Request(url);
    
    try {
        const res = await GET(req);
        const data = await res.json();
        console.log("=== API RESPONSE FOR MARCH 27 ===");
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("API Error", e);
    }
}

testApi().catch(console.error);

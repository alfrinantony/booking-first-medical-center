const body = { 
    patientName: 'Alfrin Antony', 
    serviceId: 'srv-hydra', 
    doctorId: 'any-doctor', 
    deptId: 'dept-1',
    clinicId: 'clinic-1', 
    date: '2026-06-15', 
    slot: '19:00', 
    duration: 45, 
    anyDoctor: true 
}; 

fetch('http://localhost:3000/api/admin/bookings', { 
    method: 'POST', 
    body: JSON.stringify(body), 
    headers: { 'Content-Type': 'application/json' } 
})
.then(async r => {
    console.log(r.status);
    console.log(await r.text());
})
.catch(console.error);

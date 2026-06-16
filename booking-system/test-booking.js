fetch("http://localhost:3000/api/admin/bookings", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    clinicId: "cl_123",
    deptId: "dept_123",
    serviceId: "srv_123",
    doctorId: "any-doctor",
    date: "2026-06-15",
    slot: "07:00 PM",
    duration: 45,
    patientName: "Alfrin Antony",
    patientPhone: "+1234567890",
    amount: 103.95,
    anyDoctor: true
  })
}).then(r => r.json()).then(console.log);
